"use client"
import Link from "next/link";

import {SearchIcon} from "@/components/ui/search";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {usePathname} from "next/navigation";
import {cx} from "class-variance-authority";
import {LockIcon} from "@/components/ui/lock";
import {HomeIcon} from "@/components/ui/home";
import {ChartPieIcon} from "@/components/ui/chart-pie";
import {useState} from "react";
import { motion } from "motion/react";
import {ChartColumnIncreasingIcon} from "@/components/ui/chart-column-increasing";
import {signIn, useSession} from "next-auth/react";
import {UserIcon} from "@/components/animate-ui/icons/user";

interface NavigationButtonProps {
    iconOnly?: boolean;
    icon?: React.JSXElementConstructor<any>;
    label?: string;
    pathname?: string;
    onClick?: () => void;
}

const NavigationButton = ({iconOnly, label, icon, onClick, pathname}: NavigationButtonProps) => {

    const path = usePathname();

    if (iconOnly) {
        let Icon = icon as any;

        return (
            <Tooltip>
                <TooltipTrigger>
                    {
                        pathname ? <Link href={pathname ?? "/"}>
                            <div
                                className={cx("p-2 bg-neutral-800/30 rounded-xl hover:bg-neutral-800/60 cursor-pointer active:scale-[95%] transition", {
                                    "bg-primary hover:bg-primary/90 text-primary-foreground": path === pathname,
                                })} onClick={onClick}>
                                <Icon size={18} animateOnHover />
                            </div>
                        </Link> : <div
                            className={cx("p-2 bg-neutral-800/30 rounded-xl hover:bg-neutral-800/60 active:scale-[95%] transition cursor-pointer", {
                                "bg-primary hover:bg-primary/90": path === pathname,
                            })} onClick={onClick}>
                            <Icon size={18}/>

                        </div>
                    }
                </TooltipTrigger>
                <TooltipContent side={"bottom"}>
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>

        )
    } else {
        return (
            <Link
                className={cx("text-sm bg-neutral-800/30 hover:bg-neutral-800/60 rounded-xl px-3 py-1 transition-colors", {
                    "bg-primary hover:bg-primary/90": path === pathname,
                })} href={pathname ?? "/"} onClick={onClick}>
                {label}
            </Link>
        )
    }
}

export function FloatingNavigationBar() {

    const [isCollapsed, setIsCollapsed] = useState(false);
    const {status, data} = useSession()

    const HEADER_HEIGHT = 100;

    return (
        <motion.div className={"absolute top-0 right-0 flex justify-center items-center w-full z-50"}  style={{height: HEADER_HEIGHT}}
                    initial={{y: 0}}
                    animate={{y: isCollapsed ? (-HEADER_HEIGHT + 10) : 0}}
                    transition={{type: "spring", stiffness: 100, damping: 20}}
        >
            <div
                className={"py-3 px-8 bg-neutral-950/30 backdrop-blur-xl z-50 rounded-full m-8 mb-3 text-white"}>
                <div className={"flex items-center gap-3"}>
                    <img src="https://cdn.bte-germany.de/general/logos/Logo.png" alt="BTE Germany Logo"
                         className={"w-8 mr-4"}/>

                    <NavigationButton iconOnly={true} icon={HomeIcon} label={"Map"} pathname={"/"}/>
                    <NavigationButton iconOnly={true} icon={ChartColumnIncreasingIcon} label={"Statistiken"} pathname={"/stats"}/>

                    <NavigationButton iconOnly={true} icon={SearchIcon} label={"Suchen"}/>
                    {
                        status === "unauthenticated" && <NavigationButton iconOnly={true} icon={LockIcon} label={"Anmelden"} onClick={async () => {
                            await signIn("keycloak")
                        }}/>
                    }
                    {
                        status === "authenticated" && <NavigationButton iconOnly={true} icon={UserIcon} label={"Dein Profil"} pathname={"/profile"}/>
                    }
                </div>
            </div>
            <div className={"h-1.5 w-8 bg-white/70 rounded-full absolute bottom-0 left-1/2 transform -translate-x-1/2 z-40 cursor-pointer hover:bg-white/90 transition-colors"} onClick={() => {
                setIsCollapsed((c) => !c);
            }}></div>
        </motion.div>
    )
}
