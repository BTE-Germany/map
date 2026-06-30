"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { McServerSummary } from "@/actions/servers/McServers";

const STATES: { code: string; label: string }[] = [
    { code: "BW", label: "Baden-Württemberg" },
    { code: "BY", label: "Bayern" },
    { code: "BE", label: "Berlin" },
    { code: "BB", label: "Brandenburg" },
    { code: "HB", label: "Bremen" },
    { code: "HH", label: "Hamburg" },
    { code: "HE", label: "Hessen" },
    { code: "MV", label: "Mecklenburg-Vorpommern" },
    { code: "NI", label: "Niedersachsen" },
    { code: "NW", label: "Nordrhein-Westfalen" },
    { code: "RP", label: "Rheinland-Pfalz" },
    { code: "SL", label: "Saarland" },
    { code: "SN", label: "Sachsen" },
    { code: "ST", label: "Sachsen-Anhalt" },
    { code: "SH", label: "Schleswig-Holstein" },
    { code: "TH", label: "Thüringen" },
];

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    server: McServerSummary | null;
    onSaved: () => void;
    onSubmit: (input: { key: string; name: string; states: string[] }) => Promise<void>;
}

export default function ServerEditDialog({ open, onOpenChange, server, onSaved, onSubmit }: Props) {
    const isCreate = server === null;
    const [key, setKey] = useState("");
    const [name, setName] = useState("");
    const [states, setStates] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!open) return;
        setKey(server?.key ?? "");
        setName(server?.name ?? "");
        setStates(new Set(server?.states ?? []));
    }, [open, server]);

    function toggleState(code: string) {
        setStates((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            try {
                await onSubmit({ key, name, states: Array.from(states) });
                onSaved();
            } catch (err: any) {
                toast.error(err?.message ?? "Speichern fehlgeschlagen");
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isCreate ? "Server hinzufügen" : "Server bearbeiten"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Schlüssel</label>
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            disabled={!isCreate}
                            placeholder="z. B. terra-ost"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono disabled:opacity-60"
                            required
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Wird im Plugin als <code>api-token</code>-Identität verwendet. Nach Anlage nicht änderbar.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z. B. Terra Ost"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Bundesländer</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {STATES.map((s) => {
                                const active = states.has(s.code);
                                return (
                                    <button
                                        key={s.code}
                                        type="button"
                                        onClick={() => toggleState(s.code)}
                                        className={cn(
                                            "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                                            active
                                                ? "bg-primary/10 border border-primary/30 text-foreground"
                                                : "bg-muted/30 border border-border text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        <span className="font-mono font-semibold w-6">{s.code}</span>
                                        <span className="truncate">{s.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Für Area-Splitted-Server: welche Bundesländer dieser Server verwaltet. Leer lassen
                            für Proxy oder generische Server.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Abbrechen
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Speichern…" : (isCreate ? "Anlegen" : "Speichern")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
