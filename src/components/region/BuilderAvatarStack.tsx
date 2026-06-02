"use client";

import { useState } from "react";
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
            {/* Overlapping avatars */}
            <div className="flex items-center">
                {all.map((p, i) => (
                    <div
                        key={p.raw_id}
                        className="relative"
                        style={{ marginLeft: i === 0 ? 0 : -10, zIndex: all.length - i }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={p.avatar}
                            alt={p.username}
                            className="size-9 rounded-full"
                        />
                    </div>
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
                                <span
                                    key={p.raw_id}
                                    className={`text-sm font-semibold ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}
                                >
                                    {p.username}
                                </span>
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
