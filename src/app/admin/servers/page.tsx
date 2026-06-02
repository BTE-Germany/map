import { ServerIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listServers } from "@/actions/servers/McServers";
import ServersTable from "@/components/admin/servers/ServersTable";

export const dynamic = "force-dynamic";

export default async function AdminServersPage() {
    const session = await getSession();
    if (!hasPermission(session?.user?.realm_access?.roles ?? [], PERMISSIONS.SERVERS_MANAGE)) {
        redirect("/admin");
    }
    const servers = await listServers();

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <ServerIcon className="size-5 text-primary" />
                    <h1 className="text-2xl font-bold">Minecraft-Server</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Paper- und Velocity-Instanzen, die Positionen melden und Teleport-Anfragen entgegennehmen.
                </p>
            </div>

            <ServersTable initial={servers} />
        </div>
    );
}
