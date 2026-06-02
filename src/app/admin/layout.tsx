import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { redirect } from "next/navigation";
import AdminNavigationBar from "@/components/admin/NavigationBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();

    if (!session || !hasPermission(session.user.realm_access?.roles ?? [], PERMISSIONS.ADMIN_ACCESS)) {
        redirect("/");
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <AdminNavigationBar />
            <main className="flex-1 p-8 overflow-auto">
                {children}
            </main>
        </div>
    );
}
