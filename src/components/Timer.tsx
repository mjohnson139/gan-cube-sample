
import { TimerState } from '../hooks/useSolveTimer';

/**
 * The timer readout.
 *
 * Green while armed, grey while running, white once stopped — the convention
 * every speedcubing timer uses, so it reads without a legend.
 */
function Timer({ state, display }: { state: TimerState; display: string }) {
    if (state == 'IDLE') return null;
    return <div className={`timer timer-${state.toLowerCase()}`}>{display}</div>;
}

export { Timer };
