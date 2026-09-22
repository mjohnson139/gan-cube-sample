
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { TwistyPlayer } from 'cubing/twisty';

import { patternToFacelets } from '../utils';

const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * What the rest of the app is allowed to do to the 3D cube.
 *
 * `TwistyPlayer` is a custom element driven by mutation — you add a move to it,
 * you assign it an alg — and none of that fits React's model of rendering from
 * state. Rather than pretend otherwise, the player is created once, kept in a
 * ref, and reached through this handle. The alternative, rebuilding it from
 * props, resets the 3D scene on every render and is visibly wrong within a
 * second of use.
 */
type CubeHandle = {
    /** Apply one move, animating it. */
    addMove(move: string): void;
    /** Replace the whole sequence — used to show the state a cube connected in. */
    setAlg(alg: string): void;
    /** Aim the cube at an orientation. The render loop eases towards it. */
    setOrientation(quaternion: THREE.Quaternion): void;
};

type CubeViewProps = {
    /** Called when the displayed cube reaches the solved state. */
    onSolved(): void;
    /** Called on touch, which is the phone equivalent of pressing space. */
    onActivate(): void;
};

/**
 * The 3D cube.
 *
 * It owns three pieces of imperative machinery and every one of them has to be
 * cleaned up, which StrictMode's double-mount makes impossible to forget: the
 * custom element itself, the `requestAnimationFrame` loop that eases the cube
 * towards its target orientation, and the pattern listener that notices a solve.
 */
const CubeView = forwardRef<CubeHandle, CubeViewProps>(function CubeView(props, ref) {

    var containerRef = useRef<HTMLDivElement | null>(null);
    var playerRef = useRef<TwistyPlayer | null>(null);

    /** The orientation the render loop is easing towards, mutated in place. */
    var targetQuaternion = useRef(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0)
    ));

    /*
     * Callbacks live in a ref so that a parent re-render with fresh closures
     * does not tear down and rebuild the player. This is the standard escape
     * hatch for long-lived imperative objects, and without it the 3D scene
     * would reset whenever a cube event updated the parent's state — which is
     * several times a second.
     */
    var callbacks = useRef(props);
    callbacks.current = props;

    useImperativeHandle(ref, (): CubeHandle => ({
        addMove(move: string) {
            playerRef.current?.experimentalAddMove(move, { cancel: false });
        },
        setAlg(alg: string) {
            if (playerRef.current) playerRef.current.alg = alg;
        },
        setOrientation(quaternion: THREE.Quaternion) {
            targetQuaternion.current.copy(quaternion);
        }
    }), []);

    useEffect(() => {

        var container = containerRef.current;
        if (!container) return;

        var player = new TwistyPlayer({
            puzzle: '3x3x3',
            visualization: 'PG3D',
            alg: '',
            experimentalSetupAnchor: 'start',
            background: 'none',
            controlPanel: 'none',
            hintFacelets: 'none',
            experimentalDragInput: 'none',
            cameraLatitude: 0,
            cameraLongitude: 0,
            cameraLatitudeLimit: 0,
            tempoScale: 5
        });
        container.appendChild(player);
        playerRef.current = player;

        /*
         * `addFreshListener` has no matching remove, so the listener outlives
         * the component. `disposed` is what keeps a torn-down player from
         * reporting a solve into a dead tree — which StrictMode causes on every
         * dev reload, not as a rare edge case.
         */
        var disposed = false;

        player.experimentalModel.currentPattern.addFreshListener((kpattern) => {
            if (disposed) return;
            if (patternToFacelets(kpattern) == SOLVED_STATE) {
                callbacks.current.onSolved();
            }
        });

        var frame = 0;
        var scene: THREE.Scene | null = null;
        var vantage: { render(): void; scene: { scene(): Promise<THREE.Scene> } } | null = null;

        var animate = async () => {
            if (disposed) return;
            if (!scene || !vantage) {
                // The vantage does not exist until the player has rendered
                // once, so this cannot be hoisted out of the loop.
                var vantages = await player.experimentalCurrentVantages();
                vantage = [...vantages][0] as typeof vantage;
                if (!vantage || disposed) {
                    frame = requestAnimationFrame(animate);
                    return;
                }
                scene = await vantage.scene.scene();
            }
            if (disposed) return;
            scene!.quaternion.slerp(targetQuaternion.current, 0.25);
            vantage!.render();
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            player.remove();
            playerRef.current = null;
        };

    }, []);

    return (
        <div
            className="cube"
            ref={containerRef}
            onTouchStart={() => callbacks.current.onActivate()}
        />
    );

});

export type { CubeHandle };
export { CubeView, SOLVED_STATE };
