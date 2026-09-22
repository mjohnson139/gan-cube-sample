
import { useCallback, useEffect, useRef, useState } from 'react';

import { cubeTimestampLinearFit, GanCubeMove, makeTimeFromTimestamp, now } from 'gan-web-bluetooth';

type TimerState = 'IDLE' | 'READY' | 'RUNNING' | 'STOPPED';

/** `1:23.456`, the format every speedcubing timer uses. */
function formatTime(milliseconds: number): string {
    var t = makeTimeFromTimestamp(milliseconds);
    return `${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`;
}

/**
 * The solve timer.
 *
 * Two clocks, and the distinction is the whole reason this is worth writing
 * carefully. While the solve is running the display counts the host clock,
 * because that is what a human watching wants. The *recorded* time comes from
 * `cubeTimestampLinearFit` over the moves of the solve, which fits the cube's
 * own clock against the host's and takes the last fitted move as the finish.
 * That is the accurate number: it does not include Bluetooth latency, and it
 * does not depend on when a notification happened to be delivered.
 *
 * The state machine matches the hardware's reality: READY is armed and waiting,
 * and the first move of the solve is what starts it — not a button, because the
 * cube is already in the solver's hands.
 */
function useSolveTimer(isConnected: boolean) {

    var [state, setState] = useState<TimerState>('IDLE');
    var [elapsed, setElapsed] = useState(0);

    /*
     * The state is mirrored into a ref, and every transition goes through
     * `transition`.
     *
     * The tempting shape — `setState(current => ...)` with the clock started
     * inside the updater — is wrong: React may invoke an updater more than once
     * (StrictMode does so deliberately), and an updater that starts an interval
     * would leave one running with no handle to it. Updaters must be pure, so
     * the side effects live out here where they run exactly once.
     */
    var stateRef = useRef<TimerState>('IDLE');

    var moves = useRef<Array<GanCubeMove>>([]);
    var startedAt = useRef(0);
    var ticker = useRef<ReturnType<typeof setInterval> | null>(null);

    var stopTicking = useCallback(() => {
        if (ticker.current !== null) {
            clearInterval(ticker.current);
            ticker.current = null;
        }
    }, []);

    var transition = useCallback((next: TimerState) => {
        stateRef.current = next;
        setState(next);
    }, []);

    /** Space, or a touch on the cube: arm the timer, or stand it down. */
    var toggle = useCallback(() => {
        if (stateRef.current == 'IDLE' && isConnected) {
            setElapsed(0);
            transition('READY');
        } else {
            stopTicking();
            transition('IDLE');
        }
    }, [isConnected, stopTicking, transition]);

    /** Feed a move in. The first one while armed starts the clock. */
    var recordMove = useCallback((move: GanCubeMove) => {
        if (stateRef.current == 'READY') {
            moves.current = [move];
            startedAt.current = now();
            stopTicking();
            ticker.current = setInterval(() => setElapsed(now() - startedAt.current), 30);
            transition('RUNNING');
        } else if (stateRef.current == 'RUNNING') {
            moves.current.push(move);
        }
    }, [stopTicking, transition]);

    /** The cube reached solved. */
    var finish = useCallback(() => {
        if (stateRef.current != 'RUNNING') return;
        stopTicking();
        var fitted = cubeTimestampLinearFit(moves.current);
        var last = fitted.slice(-1).pop();
        setElapsed(last?.cubeTimestamp ?? 0);
        transition('STOPPED');
    }, [stopTicking, transition]);

    /** An armed timer with no cube attached is a lie. */
    useEffect(() => {
        if (!isConnected) {
            stopTicking();
            transition('IDLE');
        }
    }, [isConnected, stopTicking, transition]);

    useEffect(() => stopTicking, [stopTicking]);

    return { state, elapsed, display: formatTime(elapsed), toggle, recordMove, finish };
}

export type { TimerState };
export { formatTime, useSolveTimer };
