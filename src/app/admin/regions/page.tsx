import { getAllRegions } from "@/actions/region/GetRegions";
import RegionsTable from "@/components/admin/regions/RegionsTable";
import { LandPlot } from "lucide-react";

export default async function AdminRegionsListPage() {
    const regions = await getAllRegions();

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <LandPlot className="size-5 text-primary" />
                    <h1 className="text-2xl font-bold">Regionen</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Alle {regions.length} Regionen verwalten, suchen und bearbeiten.
                </p>
            </div>

            <RegionsTable regions={regions} />
        </div>
    );
}
