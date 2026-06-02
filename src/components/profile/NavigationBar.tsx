"use client"

import { HomeIcon, LandPlotIcon, SettingsIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import Link from "next/link";

export default function NavigationBar() {
    const navItems = [
        {
            label: "Übersicht",
            href: "/profile",
            icon: HomeIcon
        },
        {
            label: "Meine Regionen",
            href: "/profile/regions",
            icon: LandPlotIcon
        },
        {
            label: "Einstellungen",
            href: "/profile/settings",
            icon: SettingsIcon
        }
    ]


    const pathname = usePathname();
    return (
        <div className="bg-card">
            <div className="container mx-auto flex gap-2 overflow-x-auto px-4 py-2 md:px-0">
                {
                    navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link className="relative flex shrink-0 items-center justify-center transition-transform active:scale-[98%]" key={item.href} href={item.href}>
                                <div className="flex items-center justify-between px-3 py-4 sm:px-4">
                                    <h2 className={cn("z-10 flex items-center whitespace-nowrap text-sm", {
                                        "text-muted-foreground": !isActive,
                                        "text-foreground": isActive,
                                    })}>
                                        {item.icon && <item.icon className="size-4 mr-2" />}
                                        {item.label}
                                    </h2>
                                </div>
                                {isActive && (
                                    <motion.div className="absolute w-full bg-primary/50 h-[70%] bottom-[15%] rounded-lg " layoutId="activeIndicator" id="bg"></motion.div>
                                )}
                            </Link>
                        )
                    })
                }
                <div className="flex min-w-fit flex-1 items-center justify-end pl-2">
                    <LogoutButton />
                </div>
            </div>

        </div>
    );
}
