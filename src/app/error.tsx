'use client'

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {

    const gifs = [
        "JIX9t2j0ZTN9S",
        "kHU8W94VS329y",
        "ThrM4jEi2lBxd7X2yz",
        "abhMNHCMnbhV7Ad0Ij",
        "ijvngPcd8kNOha4Se1"
    ]

    const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

    return (
        <div className="p-8 min-h-screen flex flex-col items-center justify-center">
            <div className="w-64">
                <div
                    style={{
                        width: "100%",
                        height: 0,
                        paddingBottom: "100%",
                        position: "relative"
                    }}
                >
                    <iframe
                        src={`https://giphy.com/embed/${randomGif}`}
                        width="100%"
                        height="100%"
                        style={{ position: "absolute" }}
                        frameBorder={0}

                    />
                </div>
                <p>
                    <a href={`https://giphy.com/gifs/${randomGif}`} className="text-muted-foreground text-xs">via GIPHY</a>
                </p>
            </div>


            <h1 className="text-2xl md:text-5xl font-bold mb-1 mt-8">Es ist ein Fehler aufgetreten</h1>
            <p className="text-muted-foreground">Das Kompetenzteam arbeitet bereits an einer Lösung.</p>
            <pre className="text-xs mt-4 bg-card rounded-lg p-2">{error.message}</pre>

            <div className="flex gap-3 mt-6">
                <Button variant="default" onClick={() => reset()}>
                    Erneut versuchen
                </Button>
                <Link href="/">
                    <Button variant="secondary">
                        Zur Startseite
                    </Button>
                </Link>
            </div>
        </div>
    );
}