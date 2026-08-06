import { redirect } from "next/navigation";
import { getBteSyncOverview } from "@/actions/sync/BteSync";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import BteSyncPanel from "@/components/admin/sync/BteSyncPanel";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
    const session = await getSession();
    if (!session || !hasPermission(session.user.realm_access?.roles ?? [], PERMISSIONS.SYNC_MANAGE)) {
        redirect("/admin");
    }

    const overview = await getBteSyncOverview();

    return <BteSyncPanel initialOverview={overview} />;
}
