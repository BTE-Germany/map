"use client"

import { useEffect } from "react";
import useSearchStore from "@/stores/SearchStore";

export default function SearchShortcut() {
    const toggle = useSearchStore((s) => s.toggle);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggle();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [toggle]);

    return null;
}
