"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CopyIcon, CheckIcon, KeyRoundIcon, AlertTriangleIcon } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
    open: boolean;
    token: string;
    serverName: string;
    serverKey: string;
    onClose: () => void;
}

export default function TokenRevealDialog({ open, token, serverName, serverKey, onClose }: Props) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            toast.success("Token kopiert.");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Kopieren fehlgeschlagen — bitte manuell markieren.");
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRoundIcon className="size-4" /> Neuer Token für „{serverName}“
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300 flex gap-2">
                        <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                        <div>
                            Dieser Token wird <strong>nur jetzt</strong> angezeigt. Speichere ihn jetzt sicher —
                            wir speichern in der Datenbank nur einen Hash und können ihn nicht erneut anzeigen.
                            Falls verloren: rotiere ihn einfach erneut.
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Token</label>
                        <div className="flex gap-2">
                            <code className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
                                {token}
                            </code>
                            <Button variant="outline" size="icon" onClick={handleCopy}>
                                {copied ? <CheckIcon className="size-4 text-emerald-400" /> : <CopyIcon className="size-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Plugin-Config</label>
                        <pre className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] font-mono whitespace-pre-wrap break-all">
{`# plugins/Mapv3Paper/config.yml (oder plugins/mapv3/config.yml auf Velocity)
api-base: "https://map.bte-germany.de"
api-token: "${token}"
# Server-Schlüssel in der DB: ${serverKey}`}
                        </pre>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={onClose}>Verstanden</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
