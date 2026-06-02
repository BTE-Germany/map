"use server";

import { getSession } from "@/lib/auth";

export async function checkMinecraftLinked(): Promise<{ error: string } | { success: true }> {
    const session = await getSession();

    if (!session?.accessToken) {
        return { error: "Nicht angemeldet" };
    }

    const res = await fetch(
        `${process.env.KEYCLOAK_URL}/protocol/openid-connect/userinfo`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!res.ok) {
        return { error: "Fehler beim Abrufen der Benutzerdaten. Bitte versuche es erneut." };
    }

    const userInfo = await res.json();

    if (!userInfo.minecraft_uuid) {
        return {
            error: "Dein Minecraft Account ist noch nicht verknüpft. Bitte folge den Anweisungen und versuche es erneut.",
        };
    }

    return { success: true };
}
