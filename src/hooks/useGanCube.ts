
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    connectGanCube,
    cubeTimestampCalcSkew,
    GanCubeConnection,
    GanCubeEvent,
    GanCubeMove,
    MacAddressProvider
} from 'gan-web-bluetooth';
import { createSimulatedGanCube, SimulatedGanCube } from 'gan-web-bluetooth/simulation';

/** What the cube has told us about itself. Every field is unknown until it does. */
type CubeInfo = {
    deviceName?: string;
    deviceMAC?: string;
    hardwareName?: string;
    hardwareVersion?: string;
    softwareVersion?: string;
    productDate?: string;
    gyroSupported?: boolean;
    batteryLevel?: number;
    /** Percentage drift between the cube's clock and ours, once enough moves exist. */
    skew?: number;
};

type ConnectionKind = 'none' | 'bluetooth' | 'simulated';

type CubeEventHandlers = {
    onMove(event: Extract<GanCubeEvent, { type: 'MOVE' }>): void;
    onFacelets(event: Extract<GanCubeEvent, { type: 'FACELETS' }>): void;
    onGyro(event: Extract<GanCubeEvent, { type: 'GYRO' }>): void;
    onDisconnect(): void;
};

/**
 * Asked for a MAC address the browser will not give up.
 *
 * The GAN encryption key is salted with the cube's MAC, so a connection without
 * one decrypts to plausible-looking garbage rather than failing cleanly. Chrome
 * can read it from the advertisement, but only behind a flag.
 */
const macAddressProvider: MacAddressProvider = async (device, isFallbackCall) => {
    if (isFallbackCall) {
        return prompt('Unable to determine cube MAC address!\nPlease enter MAC address manually:');
    }
    return typeof device.watchAdvertisements == 'function' ? null : prompt(
        'Seems like your browser does not support Web Bluetooth watchAdvertisements() API. '
        + 'Enable the following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features'
        + '\n\nor enter the cube MAC address manually:'
    );
};

/**
 * The cube connection, as React state.
 *
 * The whole point of the transport seam is that the two ways in are the same
 * thing above it: `connectGanCube()` produces a connection over Web Bluetooth,
 * `createSimulatedGanCube()` produces one over a transport with nothing behind
 * it, and everything from the decryption onwards is identical code. This hook
 * is where that shows — `connect` and `connectSimulated` differ in one line and
 * agree on all the rest.
 *
 * Handlers are passed once and read through a ref. Re-subscribing whenever a
 * parent re-rendered would drop events between the unsubscribe and the new
 * subscription, and over Bluetooth a dropped MOVE is not recoverable — the
 * serial numbers move on without it.
 */
function useGanCube(handlers: CubeEventHandlers) {

    var [kind, setKind] = useState<ConnectionKind>('none');
    var [connecting, setConnecting] = useState(false);
    var [info, setInfo] = useState<CubeInfo>({});
    var [error, setError] = useState<string | null>(null);

    /*
     * The simulated cube is state rather than a ref because the UI renders from
     * it — the hand-driving controls only exist when there is one.
     */
    var [simulated, setSimulated] = useState<SimulatedGanCube | null>(null);

    var connectionRef = useRef<GanCubeConnection | null>(null);
    var movesRef = useRef<Array<GanCubeMove>>([]);

    var handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    var handleEvent = useCallback((event: GanCubeEvent) => {
        switch (event.type) {
            case 'MOVE':
                movesRef.current.push(event);
                if (movesRef.current.length > 256)
                    movesRef.current = movesRef.current.slice(-256);
                if (movesRef.current.length > 10)
                    setInfo((current) => ({ ...current, skew: cubeTimestampCalcSkew(movesRef.current) }));
                handlersRef.current.onMove(event);
                break;
            case 'FACELETS':
                handlersRef.current.onFacelets(event);
                break;
            case 'GYRO':
                handlersRef.current.onGyro(event);
                break;
            case 'HARDWARE':
                setInfo((current) => ({
                    ...current,
                    hardwareName: event.hardwareName,
                    hardwareVersion: event.hardwareVersion,
                    softwareVersion: event.softwareVersion,
                    productDate: event.productDate,
                    gyroSupported: event.gyroSupported
                }));
                break;
            case 'BATTERY':
                setInfo((current) => ({ ...current, batteryLevel: event.batteryLevel }));
                break;
            case 'DISCONNECT':
                connectionRef.current = null;
                setSimulated(null);
                movesRef.current = [];
                setKind('none');
                setInfo({});
                handlersRef.current.onDisconnect();
                break;
        }
    }, []);

    /** Wire a freshly built connection up and ask it to introduce itself. */
    var adopt = useCallback(async (connection: GanCubeConnection, connectionKind: ConnectionKind) => {
        connectionRef.current = connection;
        connection.events$.subscribe(handleEvent);
        setKind(connectionKind);
        setInfo({ deviceName: connection.deviceName, deviceMAC: connection.deviceMAC });
        await connection.sendCubeCommand({ type: 'REQUEST_HARDWARE' });
        await connection.sendCubeCommand({ type: 'REQUEST_FACELETS' });
        await connection.sendCubeCommand({ type: 'REQUEST_BATTERY' });
    }, [handleEvent]);

    var connect = useCallback(async () => {
        setError(null);
        setConnecting(true);
        try {
            await adopt(await connectGanCube(macAddressProvider), 'bluetooth');
        } catch (e) {
            // A user dismissing the chooser lands here too, which is why this
            // reports rather than throws.
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setConnecting(false);
        }
    }, [adopt]);

    var connectSimulated = useCallback(async () => {
        setError(null);
        setConnecting(true);
        try {
            var cube = await createSimulatedGanCube();
            setSimulated(cube);
            await adopt(cube.connection, 'simulated');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setConnecting(false);
        }
    }, [adopt]);

    var disconnect = useCallback(async () => {
        await connectionRef.current?.disconnect();
    }, []);

    /** Ask the cube to call its current position solved. */
    var resetState = useCallback(async () => {
        await connectionRef.current?.sendCubeCommand({ type: 'REQUEST_RESET' });
    }, []);

    /*
     * A connection that outlives the component keeps the Bluetooth device busy
     * and keeps delivering events into a tree that no longer exists. StrictMode
     * exercises this on every dev reload.
     */
    useEffect(() => () => { void connectionRef.current?.disconnect(); }, []);

    return {
        /** The cube being driven by hand, when this is a simulated connection. */
        simulated,
        connected: kind != 'none',
        kind,
        connecting,
        info,
        error,
        connect,
        connectSimulated,
        disconnect,
        resetState
    };
}

export type { CubeInfo, ConnectionKind };
export { useGanCube };
