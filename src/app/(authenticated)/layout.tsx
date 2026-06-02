import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session) {
        redirect("/");
    }

    if (!session?.user?.minecraft_uuid) {
        redirect("/onboarding");
    }

    return children;
}