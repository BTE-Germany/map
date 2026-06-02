import { getRegionsByCreator } from "@/actions/region/GetRegions";
import RegionsTable from "@/components/profile/RegionsTable";
import { getSession } from "@/lib/auth";
import { LandPlot } from "lucide-react";

export default async function ProfileRegionsPage() {
    const session = await getSession();
    const uuid = session?.user.minecraft_uuid ?? "";

    const regions = await getRegionsByCreator(uuid) ?? [];

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <LandPlot className="size-5 text-primary" />
                    <h2 className="text-xl font-semibold">Meine Regionen</h2>
                </div>
                <p className="text-muted-foreground text-sm">
                    Alle Regionen, die du auf der Karte erstellt hast.
                </p>
            </div>

            {regions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-3">
                    <LandPlot className="size-10 text-muted-foreground/30" />
                    <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Noch keine Regionen</p>
                        <p className="text-sm text-muted-foreground/60">Erstelle deine erste Region auf der Karte.</p>
                    </div>
                </div>
            ) : (
                <RegionsTable regions={regions} />
            )}
        </div>
    );
}
