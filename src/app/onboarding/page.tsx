"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { checkMinecraftLinked } from "./actions";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function OnboardingPage() {
    const { update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDone = async () => {
        setLoading(true);

        const result = await checkMinecraftLinked();

        if ("error" in result) {
            toast.error(result.error)
            setLoading(false);
            return;
        }

        await update();
        router.push("/profile");
    };

    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">Willkommen auf der BTE Germany Map!</h1>
                <p className="text-lg text-muted-foreground mb-8">Um dein Profil zu sehen, musst du deinen Minecraft Account verknüpfen.</p>

                <video src="/minecraft_linking.mp4" autoPlay controls className="rounded-lg shadow-lg "></video>

                <p className="mt-4">
                    Joine auf den Server, gebe den Befehl <code className="bg-muted px-1 rounded">/accountlink</code> ein und klicke auf den Link im Chat, um deinen Account zu verknüpfen.
                </p>



                <Button className="mt-6" onClick={handleDone} disabled={loading}>
                    Erledigt
                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                </Button>
            </div>
        </div>
    );
}
