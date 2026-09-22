
import { useEffect, useRef, useState } from 'react';

import { SimulatedGanCube } from 'gan-web-bluetooth/simulation';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Random-move, not random-state: enough to show the app working, not a real scramble. */
function randomMoves(count: number): string {
    var moves: Array<string> = [];
    var previous = -1;
    while (moves.length < count) {
        let face = Math.floor(Math.random() * 6);
        if (face == previous) continue;
        previous = face;
        moves.push(FACES[face] + ['', "'", '2'][Math.floor(Math.random() * 3)]);
    }
    return moves.join(' ');
}

/**
 * Hand controls for a cube that isn't there.
 *
 * Every button here goes through the same path a real cube's turn does: the
 * move is bit-packed into a Gen2 frame, AES-encrypted with a MAC-salted key,
 * handed to the transport, decrypted by the connection and parsed by the
 * protocol driver. Nothing above the transport knows the difference, which is
 * the point — this exercises the library rather than mocking it.
 */
function SimulatorPanel({ cube }: { cube: SimulatedGanCube }) {

    var [tumbling, setTumbling] = useState(false);
    var [busy, setBusy] = useState(false);

    /*
     * Tumbling emits GYRO frames on a timer. The angle lives in a ref rather
     * than state so the effect does not restart on every frame — restarting it
     * would reset the rotation and the cube would judder in place.
     */
    var angle = useRef(0);

    useEffect(() => {
        if (!tumbling) return;
        var timer = setInterval(() => {
            angle.current += 0.05;
            // A rotation about the Y axis, as a unit quaternion.
            void cube.sendGyro({
                x: 0,
                y: Math.sin(angle.current / 2),
                z: 0,
                w: Math.cos(angle.current / 2)
            }, { x: 0, y: 2, z: 0 });
        }, 50);
        return () => clearInterval(timer);
    }, [tumbling, cube]);

    var run = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="simulator">

            <div className="simulator-title">Simulated cube</div>

            <div className="simulator-row">
                {FACES.map((face) => (
                    <span key={face} className="simulator-face">
                        <button disabled={busy} onClick={() => run(() => cube.turn(face))}>{face}</button>
                        <button disabled={busy} onClick={() => run(() => cube.turn(face + "'"))}>{face}'</button>
                    </span>
                ))}
            </div>

            <div className="simulator-row">
                <button disabled={busy} onClick={() => run(() => cube.turns(randomMoves(20)))}>Scramble</button>
                <button disabled={busy} onClick={() => run(() => cube.sendBattery(Math.floor(Math.random() * 101)))}>
                    Battery
                </button>
                <button onClick={() => setTumbling((t) => !t)}>
                    {tumbling ? 'Stop Gyro' : 'Start Gyro'}
                </button>
            </div>

            <div className="help">
                A cube that isn't there — real frames, real encryption, real driver.
                Scramble it, arm the timer with SPACE, then turn it back to solved.
            </div>

        </div>
    );
}

export { SimulatorPanel };
