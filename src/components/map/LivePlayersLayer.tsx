"use client";

import { Marker } from "@vis.gl/react-maplibre";
import { useLivePlayers } from "@/dataHooks/players/useLivePlayers";
import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import useMapOverlayStore from "@/stores/MapOverlayStore";

/**
 * Renders one marker per online player. Plugin must populate `lat`/`lng` on
 * each position upload — players without geo coordinates are skipped because
 * we can't place them on the map.
 */
export default function LivePlayersLayer() {
    const { data: players } = useLivePlayers();
    const hidePlayers = useMapOverlayStore((s) => s.hidePlayers);
    if (hidePlayers) return null;
    if (!players?.length) return null;

    return (
        <>
            {players
                .filter((p) => p.lat !== null && p.lng !== null)
                .map((p) => (
                    <Marker
                        key={p.uuid}
                        longitude={p.lng!}
                        latitude={p.lat!}
                        anchor="bottom"
                    >
                        <PlayerMarker uuid={p.uuid} username={p.username} />
                    </Marker>
                ))}
        </>
    );
}

function PlayerMarker({ uuid, username }: { uuid: string; username: string }) {
    const { data } = useMcUser(uuid);
    const avatar = data?.avatar;
    return (
        <div className="group relative flex flex-col items-center pointer-events-auto">
            <div
                className="size-7 rounded-full ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30 bg-neutral-900 overflow-hidden"
                title={username}
            >
                {avatar ? (
                    <img src={avatar} alt={username} className="size-full object-cover" />
                ) : (
                    <div className="size-full bg-neutral-800" />
                )}
            </div>
            {/* tail */}
            <div className="size-1.5 rounded-full bg-emerald-400 mt-0.5" />
            {/* hover label */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-neutral-950/90 text-[11px] font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {username}
            </div>
        </div>
    );
}
