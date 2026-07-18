import { redirect } from "next/navigation";
import { PlusIcon } from "lucide-react";
import CreateRegionForm from "@/components/admin/regions/CreateRegionForm";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function AdminRegionsCreatePage() {
    const session = await getSession();
    if (!hasPermission(session?.user.realm_access?.roles ?? [], PERMISSIONS.REGIONS_EDIT)) {
        redirect("/admin/regions");
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <PlusIcon className="size-5 text-primary" />
                    <h1 className="text-2xl font-bold">Region erstellen</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Zeichne das Polygon auf der Karte, wähle einen Ersteller und lege Typ &amp; Status fest.
                </p>
            </div>

            <CreateRegionForm />
        </div>
    );
}
