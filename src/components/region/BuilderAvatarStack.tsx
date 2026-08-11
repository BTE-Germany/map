"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

interface BuilderProfile {
    raw_id: string;
    username: string;
    avatar: string;
}

interface Props {
    owner: BuilderProfile;
    builders: BuilderProfile[];
}

export default function BuilderAvatarStack({ owner, builders }: Props) {
    const [hovered, setHovered] = useState(false);
    const all = [owner, ...builders];

    return (
        <div
            className="flex items-center gap-3 w-fit"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Overlapping avatars — jeder führt aufs Builderprofil. Am Zeigegerät
                sind sie der einzige stabile Klickpunkt: die Namensliste darunter
                erscheint erst beim Hovern und existiert auf Touch gar nicht. */}
            <div className="flex items-center">
                {all.map((p, i) => (
                    <Link
                        key={p.raw_id}
                        href={`/builder/${p.raw_id}`}
                        prefetch={false}
                        title={`Statistiken von ${p.username}`}
                        aria-label={`Builderprofil von ${p.username} öffnen`}
                        className="relative rounded-full ring-2 ring-transparent transition-[ring-color,transform] hover:z-10 hover:ring-sky-400/70 focus-visible:outline-none focus-visible:ring-sky-400"
                        style={{ marginLeft: i === 0 ? 0 : -10, zIndex: all.length - i }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={p.avatar}
                            alt=""
                            className="size-9 rounded-full"
                        />
                    </Link>
                ))}
            </div>

            {/* Name area */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                    {hovered ? "Team" : "Erstellt von"}
                </p>
                <AnimatePresence mode="wait">
                    {hovered ? (
                        <motion.div
                            key="all"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-wrap gap-x-1.5 gap-y-0.5"
                        >
                            {all.map((p, i) => (
                                <Link
                                    key={p.raw_id}
                                    href={`/builder/${p.raw_id}`}
                                    prefetch={false}
                                    className={`text-sm font-semibold underline-offset-4 transition-colors hover:text-sky-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 ${i === 0 ? "text-foreground" : "text-muted-foreground"
                                        }`}
                                >
                                    {p.username}
                                </Link>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.p
                            key="creator"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="text-sm font-semibold text-foreground"
                        >
                            {owner.username}
                            {builders.length > 0 && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    +{builders.length}
                                </span>
                            )}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
