"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    PlusIcon, KeyRoundIcon, PencilIcon, Trash2Icon, ServerIcon, CheckCircle2Icon,
    AlertTriangleIcon, ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    listServers, createServer, updateServer, deleteServer, rotateServerToken,
    type McServerSummary,
} from "@/actions/servers/McServers";
import ServerEditDialog from "./ServerEditDialog";
import TokenRevealDialog from "./TokenRevealDialog";

interface Props {
    initial: McServerSummary[];
}

function formatDate(iso: string | null): string {
    if (!iso) return "–";
    return new Date(iso).toLocaleDateString("de-DE", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

export default function ServersTable({ initial }: Props) {
    const [servers, setServers] = useState(initial);
    const [editing, setEditing] = useState<McServerSummary | null | "new">(null);
    const [pendingDelete, setPendingDelete] = useState<McServerSummary | null>(null);
    const [revealed, setRevealed] = useState<{ server: McServerSummary; token: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    async function refresh() {
        const fresh = await listServers();
        setServers(fresh);
    }

    function handleSaved() {
        setEditing(null);
        startTransition(refresh);
    }

    function handleRotate(server: McServerSummary) {
        startTransition(async () => {
            try {
                const { token } = await rotateServerToken(server.id);
                setRevealed({ server, token });
                await refresh();
            } catch (e: any) {
                toast.error(e?.message ?? "Token konnte nicht rotiert werden");
            }
        });
    }

    function handleDelete() {
        if (!pendingDelete) return;
        const target = pendingDelete;
        setPendingDelete(null);
        startTransition(async () => {
            try {
                await deleteServer(target.id);
                toast.success(`Server „${target.name}“ gelöscht.`);
                await refresh();
            } catch (e: any) {
                toast.error(e?.message ?? "Löschen fehlgeschlagen");
            }
        });
    }

    return (
        <>
            <div className="flex justify-end">
                <Button onClick={() => setEditing("new")} className="gap-2">
                    <PlusIcon className="size-4" /> Server hinzufügen
                </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Schlüssel</TableHead>
                            <TableHead>Bundesländer</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead>Erstellt</TableHead>
                            <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {servers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                                    <ServerIcon className="size-8 mx-auto mb-2 opacity-40" />
                                    Noch kein Server konfiguriert.
                                </TableCell>
                            </TableRow>
                        )}
                        {servers.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.key}</code>
                                </TableCell>
                                <TableCell>
                                    {s.states.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">–</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {s.states.map((code) => (
                                                <span
                                                    key={code}
                                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                                >
                                                    {code}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {s.hasToken ? (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                                            <CheckCircle2Icon className="size-3.5" />
                                            <span>Aktiv</span>
                                            {s.tokenRotatedAt && (
                                                <span className="text-muted-foreground inline-flex items-center gap-1 ml-1">
                                                    <ClockIcon className="size-3" /> {formatDate(s.tokenRotatedAt)}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                                            <AlertTriangleIcon className="size-3.5" /> Kein Token
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatDate(s.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="inline-flex gap-1">
                                        <Button
                                            variant="ghost" size="sm"
                                            disabled={isPending}
                                            onClick={() => handleRotate(s)}
                                            title={s.hasToken ? "Token rotieren" : "Token erzeugen"}
                                        >
                                            <KeyRoundIcon className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => setEditing(s)}
                                            title="Bearbeiten"
                                        >
                                            <PencilIcon className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => setPendingDelete(s)}
                                            title="Löschen"
                                        >
                                            <Trash2Icon className="size-4 text-red-400" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ServerEditDialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                server={editing === "new" ? null : editing}
                onSaved={handleSaved}
                onSubmit={async (input) => {
                    if (editing === "new") {
                        await createServer(input);
                        toast.success("Server angelegt.");
                    } else if (editing) {
                        await updateServer({ id: editing.id, name: input.name, states: input.states });
                        toast.success("Server aktualisiert.");
                    }
                }}
            />

            <TokenRevealDialog
                open={revealed !== null}
                token={revealed?.token ?? ""}
                serverName={revealed?.server.name ?? ""}
                serverKey={revealed?.server.key ?? ""}
                onClose={() => setRevealed(null)}
            />

            <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Server löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{pendingDelete?.name}</strong> ({pendingDelete?.key}) wird unwiderruflich entfernt.
                            Bestehende Token sind danach ungültig. Aktive Plugins können sich nicht mehr authentifizieren.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
