"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LandPlot, Shield, ListIcon, RefreshCwIcon, ArrowRightLeftIcon, ServerIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    {
        href: "/admin/regions",
        label: "Regionen",
        icon: LandPlot,
        exact: true,
        children: [
            { href: "/admin/regions", label: "Liste", icon: ListIcon, exact: true },
            { href: "/admin/regions/create", label: "Erstellen", icon: PlusIcon },
            { href: "/admin/regions/transfer", label: "Übertragen", icon: ArrowRightLeftIcon },
            { href: "/admin/regions/refresh", label: "Metadaten", icon: RefreshCwIcon },
        ],
    },
    { href: "/admin/servers", label: "Server", icon: ServerIcon },
];

export default function AdminNavigationBar() {
    const pathname = usePathname();

    function isActive(href: string, exact?: boolean) {
        return exact ? pathname === href : pathname.startsWith(href);
    }

    return (
        <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col">
            <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Shield className="size-4 text-primary" />
                </div>
                <span className="font-semibold text-sm">Admin</span>
            </div>

            <nav className="flex-1 p-3 space-y-0.5">
                {NAV_ITEMS.map(({ href, label, icon: Icon, children }) => {
                    const sectionActive = pathname.startsWith(href);
                    return (
                        <div key={href}>
                            <Link
                                href={href}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                                    sectionActive
                                        ? "text-foreground bg-muted/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <Icon className="size-4 shrink-0" />
                                {label}
                            </Link>
                            {children && sectionActive && (
                                <div className="mt-0.5 ml-4 pl-3 border-l border-border space-y-0.5">
                                    {children.map(({ href: ch, label: cl, icon: CI, exact: ce }) => (
                                        <Link
                                            key={ch}
                                            href={ch}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                                                isActive(ch, ce)
                                                    ? "text-foreground bg-muted/50"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                            )}
                                        >
                                            <CI className="size-3.5 shrink-0" />
                                            {cl}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className="px-4 py-4 border-t border-border">
                <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    ← Zurück zur Karte
                </Link>
            </div>
        </aside>
    );
}
