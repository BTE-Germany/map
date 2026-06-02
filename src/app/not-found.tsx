import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {

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


            <h1 className="text-2xl md:text-5xl font-bold mb-1 mt-8">404 - Seite nicht gefunden</h1>
            <p className="text-muted-foreground">Die angeforderte Seite existiert nicht. Das Kompetenzteam arbeitet bereits an einer Lösung.</p>

            <Link href="/">
                <Button variant="secondary" className="mt-6">
                    Zur Startseite
                </Button>
            </Link>
        </div>
    );
}