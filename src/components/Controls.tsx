
import { ConnectionKind } from '../hooks/useGanCube';

type ControlsProps = {
    kind: ConnectionKind;
    connecting: boolean;
    onConnect(): void;
    onConnectSimulated(): void;
    onDisconnect(): void;
    onResetState(): void;
    onResetGyro(): void;
};

/** Web Bluetooth is Chromium-only, and saying so beats a button that does nothing. */
const BLUETOOTH_AVAILABLE = typeof navigator != 'undefined' && 'bluetooth' in navigator;

function Controls(props: ControlsProps) {

    var connected = props.kind != 'none';

    return (
        <div className="controls">

            <button
                onClick={connected ? props.onDisconnect : props.onConnect}
                disabled={props.connecting || (!connected && !BLUETOOTH_AVAILABLE)}
                title={BLUETOOTH_AVAILABLE ? undefined : 'This browser has no Web Bluetooth'}
            >
                {connected && props.kind == 'bluetooth' ? 'Disconnect' : 'Connect'}
            </button>

            <button
                onClick={connected ? props.onDisconnect : props.onConnectSimulated}
                disabled={props.connecting}
            >
                {connected && props.kind == 'simulated' ? 'Disconnect Simulated' : 'Connect Simulated'}
            </button>

            <button onClick={props.onResetState} disabled={!connected}>Reset State</button>
            <button onClick={props.onResetGyro} disabled={!connected}>Reset Gyro</button>

        </div>
    );
}

export { Controls, BLUETOOTH_AVAILABLE };
