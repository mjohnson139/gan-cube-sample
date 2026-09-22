
import { CubeInfo } from '../hooks/useGanCube';
import { GyroReadout } from '../hooks/useGyro';

const UNKNOWN = '- n/a -';

function Field({ label, value }: { label: string; value?: string }) {
    return (
        <>
            <span className="info-label">{label}</span>
            <span className="info-value">{value || UNKNOWN}</span>
        </>
    );
}

/** Everything the cube has said about itself, and its current orientation. */
function InfoPanel({ info, gyro }: { info: CubeInfo; gyro: GyroReadout | null }) {

    var quaternion = gyro && (({ x, y, z, w }) =>
        `x: ${x.toFixed(3)}, y: ${y.toFixed(3)}, z: ${z.toFixed(3)}, w: ${w.toFixed(3)}`
    )(gyro.quaternion);

    var velocity = gyro?.velocity && `x: ${gyro.velocity.x}, y: ${gyro.velocity.y}, z: ${gyro.velocity.z}`;

    return (
        <div className="info">
            <Field label="Device Name" value={info.deviceName} />
            <Field label="Device MAC" value={info.deviceMAC} />
            <Field label="Hardware Name" value={info.hardwareName} />
            <Field label="Hardware Version" value={info.hardwareVersion} />
            <Field label="Software Version" value={info.softwareVersion} />
            <Field label="Product Date" value={info.productDate} />
            <Field label="Gyro Supported" value={info.gyroSupported == null ? undefined : info.gyroSupported ? 'YES' : 'NO'} />
            <Field label="Battery" value={info.batteryLevel == null ? undefined : `${info.batteryLevel}%`} />
            <Field label="Clock Skew" value={info.skew == null ? undefined : `${info.skew}%`} />
            <Field label="Quaternion" value={quaternion ?? undefined} />
            <Field label="Angular Velocity" value={velocity ?? undefined} />
        </div>
    );
}

export { InfoPanel };
