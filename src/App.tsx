
import { useCallback, useEffect, useRef } from 'react';

import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { GanCubeEvent } from 'gan-web-bluetooth';

import { CubeHandle, CubeView, SOLVED_STATE } from './components/CubeView';
import { Controls } from './components/Controls';
import { InfoPanel } from './components/InfoPanel';
import { SimulatorPanel } from './components/SimulatorPanel';
import { Timer } from './components/Timer';
import { useGanCube } from './hooks/useGanCube';
import { useGyro } from './hooks/useGyro';
import { useSolveTimer } from './hooks/useSolveTimer';
import { faceletsToPattern } from './utils';

/**
 * The sample, as a React tree.
 *
 * The shape worth noticing: nothing below here knows whether the cube is real.
 * `useGanCube` hands back the same connection either way, because the library's
 * transport seam means the difference stops at the bytes — the encryption, the
 * protocol driver and `events$` are the same code for a cube on the desk and a
 * cube that does not exist.
 */
function App() {

    var cubeRef = useRef<CubeHandle>(null);

    /** Set once per connection: the first FACELETS tells us where the cube is. */
    var stateApplied = useRef(false);

    var gyro = useGyro();

    /*
     * Handlers are declared before the hook that calls them and reach the timer
     * through refs, because the timer needs to know about moves and the cube
     * needs to know about the timer. Wiring it any other way means a cycle.
     */
    var timerRef = useRef<ReturnType<typeof useSolveTimer> | null>(null);

    var onMove = useCallback((event: Extract<GanCubeEvent, { type: 'MOVE' }>) => {
        timerRef.current?.recordMove(event);
        cubeRef.current?.addMove(event.move);
    }, []);

    /**
     * Show the position the cube is actually in.
     *
     * A cube is rarely solved when it connects, and `TwistyPlayer` renders a
     * sequence rather than a state — so the position is turned into a solution
     * and the *inverse* of that solution is set as the alg. Only the first
     * FACELETS of a connection is used; after that the move stream is the
     * source of truth, and re-applying a state would fight with it.
     */
    var onFacelets = useCallback(async (event: Extract<GanCubeEvent, { type: 'FACELETS' }>) => {
        if (stateApplied.current) return;
        stateApplied.current = true;
        if (event.facelets == SOLVED_STATE) {
            cubeRef.current?.setAlg('');
            return;
        }
        var solution = await experimentalSolve3x3x3IgnoringCenters(faceletsToPattern(event.facelets));
        cubeRef.current?.setAlg(solution.invert().toString());
    }, []);

    var onGyro = useCallback((event: Extract<GanCubeEvent, { type: 'GYRO' }>) => {
        cubeRef.current?.setOrientation(gyro.apply(event));
    }, [gyro]);

    var onDisconnect = useCallback(() => {
        stateApplied.current = false;
        gyro.clear();
        cubeRef.current?.setAlg('');
    }, [gyro]);

    var cube = useGanCube({ onMove, onFacelets, onGyro, onDisconnect });
    var timer = useSolveTimer(cube.connected);

    // Published from an effect rather than assigned during render: mutating a
    // ref while rendering is not safe under concurrent rendering, and effects
    // have long since run by the time a cube event arrives.
    useEffect(() => { timerRef.current = timer; });

    /** A fresh connection means a fresh state to pick up. */
    useEffect(() => {
        if (!cube.connected) stateApplied.current = false;
    }, [cube.connected]);

    /** Space arms and disarms the timer, as it does on every stackmat. */
    useEffect(() => {
        var onKeyDown = (event: KeyboardEvent) => {
            if (event.code == 'Space') {
                event.preventDefault();
                timerRef.current?.toggle();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    var onSolved = useCallback(() => {
        timerRef.current?.finish();
        cubeRef.current?.setAlg('');
    }, []);

    var onActivate = useCallback(() => timerRef.current?.toggle(), []);

    return (
        <div className="app">

            <div className="help">
                Scramble the cube to an arbitrary state, then press SPACE or touch the cube
                to arm the timer. The first turn starts it; solving the cube stops it.
            </div>

            <div className="stage">
                <CubeView ref={cubeRef} onSolved={onSolved} onActivate={onActivate} />
                <Timer state={timer.state} display={timer.display} />
            </div>

            <Controls
                kind={cube.kind}
                connecting={cube.connecting}
                onConnect={cube.connect}
                onConnectSimulated={cube.connectSimulated}
                onDisconnect={cube.disconnect}
                onResetState={() => { void cube.resetState(); cubeRef.current?.setAlg(''); }}
                onResetGyro={gyro.resetBasis}
            />

            {cube.error && <div className="error">{cube.error}</div>}

            {cube.simulated && <SimulatorPanel cube={cube.simulated} />}

            <InfoPanel info={cube.info} gyro={gyro.readout} />

        </div>
    );
}

export { App };
