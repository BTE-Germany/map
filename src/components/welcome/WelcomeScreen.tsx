"use client";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import Image from "next/image";

import blue from "./assets/blue.png";
import orange from "./assets/orange.png";
import green from "./assets/green.png";
import red from "./assets/red.png";
import { Button } from "@/components/ui/button";
import React, { useEffect } from "react";

export default function WelcomeScreen() {

    const [open, setOpen] = React.useState(false);

    useEffect(() => {
        const hasSeenWelcomeScreen = localStorage.getItem("hasSeenWelcomeScreen");
        if (!hasSeenWelcomeScreen) {
            setOpen(true);
            localStorage.setItem("hasSeenWelcomeScreen", "true");
        }
    }, []);

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Willkommen auf der BTE Germany Map.</DialogTitle>
                        <div className="text-sm text-muted-foreground">
                            Auf dieser Karte kannst du alle Regionen, welche aktuell auf unserem Server gebaut werden, sehen. Klicke auf die Regionen, um mehr Informationen zu erhalten.
                            <br /><br />
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <Image src={green} alt="Grüne Region" className="size-16 rounded-xl" />
                                    <div>
                                        <p className="text-foreground">Fertiggestellte Regionen</p>
                                        <span>Diese Regionen sind bereits vollständig gebaut.</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Image src={orange} alt="Orange Region" className="size-16 rounded-xl" />
                                    <div>
                                        <p className="text-foreground">In Bearbeitung</p>
                                        <span>In diesen Regionen wird aktuell noch gebaut.</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Image src={blue} alt="Blaue Region" className="size-16 rounded-xl" />
                                    <div>
                                        <p className="text-foreground">Plotregionen</p>
                                        <span>Diese Regionen sind für Plots vorgesehen. Sie sind noch nicht vollständig gebaut.</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Image src={red} alt="Rote Region" className="size-16 rounded-xl" />
                                    <div>
                                        <p className="text-foreground">Eventregionen</p>
                                        <span>In diesen Regionen haben Bauevents stattgefunden. Sie sind bereits vollständig gebaut.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Verstanden</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}