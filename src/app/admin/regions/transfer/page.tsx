import TransferRegionsForm from "@/components/admin/regions/TransferRegionsForm";
import { ArrowRightLeftIcon } from "lucide-react";

export default function AdminRegionsTransferPage() {
    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <ArrowRightLeftIcon className="size-5 text-primary" />
                    <h1 className="text-2xl font-bold">Regionen übertragen</h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    Alle Regionen eines Spielers auf einen anderen übertragen. Plot- und Eventregionen verlieren dabei ihre Ersteller- und Builder-Zuordnung.
                </p>
            </div>

            <TransferRegionsForm />
        </div>
    );
}
