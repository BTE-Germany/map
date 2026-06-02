"use client";

import { useEffect, useState } from "react";

export interface LivePlayer {
    uuid: string;
    username: string;
    serverKey: string;
    world: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    lat: number | null;
    lng: number | null;
    lastSeenAt: string;
}

interface State {
    data: LivePlayer[] | undefined;
    isConnected: boolean;
    error: Error | null;
}

/**
 * Subscribes to /api/players/stream (SSE) and exposes the latest snapshot.
 * The browser's EventSource handles reconnection automatically; the server
 * suggests a 5 s `retry:` interval and emits keep-alive comments to keep
 * intermediaries from closing the connection.
 */
export function useLivePlayers(): State {
    const [state, setState] = useState<State>({
        data: undefined,
        isConnected: false,
        error: null,
    });

    useEffect(() => {
        if (typeof window === "undefined" || typeof EventSource === "undefined") {
            return;
        }

        const es = new EventSource("/api/players/stream");

        const onSnapshot = (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data) as { players: LivePlayer[] };
                setState((s) => ({
                    ...s,
                    data: parsed.players,
                    isConnected: true,
                    error: null,
                }));
            } catch (err) {
                setState((s) => ({ ...s, error: err as Error }));
            }
        };

        const onOpen = () => {
            setState((s) => ({ ...s, isConnected: true, error: null }));
        };

        const onError = () => {
            // EventSource will auto-reconnect; surface a transient state.
            setState((s) => ({ ...s, isConnected: false }));
        };

        es.addEventListener("snapshot", onSnapshot as EventListener);
        es.addEventListener("open", onOpen);
        es.addEventListener("error", onError);

        return () => {
            es.removeEventListener("snapshot", onSnapshot as EventListener);
            es.removeEventListener("open", onOpen);
            es.removeEventListener("error", onError);
            es.close();
        };
    }, []);

    return state;
}
