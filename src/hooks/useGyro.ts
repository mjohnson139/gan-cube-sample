
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { GanCubeEvent } from 'gan-web-bluetooth';

/** Where the cube sits with no tilt applied — matches `CubeView`'s home. */
const HOME_ORIENTATION = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0));

type GyroReadout = {
    quaternion: { x: number; y: number; z: number; w: number };
    velocity?: { x: number; y: number; z: number };
};

/**
 * Turn the cube's orientation reports into a scene orientation.
 *
 * Two things are going on. The axis swap `(qx, qz, -qy, qw)` moves from the
 * cube's frame to three.js's; getting it wrong produces a cube that tilts
 * convincingly in the wrong direction, which is much harder to spot than one
 * that does not move at all.
 *
 * The basis is the first orientation seen, conjugated, so that however the cube
 * happens to be lying when it connects becomes "straight ahead". Without it the
 * cube would snap to whatever attitude it was left in. "Reset Gyro" clears it,
 * which re-homes the cube to how it is being held right now.
 *
 * The numeric readout is sampled rather than rendered per event: the cube
 * reports orientation at around 50 Hz, and re-rendering the panel that often to
 * change text nobody can read at that speed is waste. The 3D cube still moves
 * at full rate — it is driven through a ref, not through state.
 */
function useGyro() {

    var basis = useRef<THREE.Quaternion | null>(null);
    var latest = useRef<GyroReadout | null>(null);
    var [readout, setReadout] = useState<GyroReadout | null>(null);

    var orientation = useRef(new THREE.Quaternion());

    /**
     * Fold one GYRO event in, returning the orientation the cube should take,
     * or `null` if this was not a GYRO event.
     */
    var apply = useCallback((event: Extract<GanCubeEvent, { type: 'GYRO' }>): THREE.Quaternion => {
        var { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
        var quaternion = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
        if (!basis.current) {
            basis.current = quaternion.clone().conjugate();
        }
        orientation.current.copy(quaternion.premultiply(basis.current).premultiply(HOME_ORIENTATION));
        latest.current = { quaternion: event.quaternion, velocity: event.velocity };
        return orientation.current;
    }, []);

    /** Re-home the cube to however it is being held now. */
    var resetBasis = useCallback(() => {
        basis.current = null;
    }, []);

    var clear = useCallback(() => {
        basis.current = null;
        latest.current = null;
        setReadout(null);
    }, []);

    useEffect(() => {
        var timer = setInterval(() => setReadout(latest.current), 100);
        return () => clearInterval(timer);
    }, []);

    return { apply, resetBasis, clear, readout };
}

export type { GyroReadout };
export { useGyro };
