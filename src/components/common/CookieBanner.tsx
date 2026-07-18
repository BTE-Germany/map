"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CookieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConsent, setConsent } from "@/lib/consent";
import { initSentry } from "@/lib/sentryClient";

/**
 * Opt-in consent banner for the Sentry monitoring cookies / session replay.
 * Shown until the user makes a choice; the decision is stored in localStorage.
 * On accept, Sentry is initialized immediately (no reload). Umami analytics is
 * cookieless and loads independently, so it is not gated here.
 */
export default function CookieBanner() {
    // Render nothing on first paint (SSR + hydration) and only reveal after we
    // have read localStorage on the client — avoids a hydration mismatch.
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (getConsent() === null) setVisible(true);
    }, []);

    function accept() {
        setConsent("accepted");
        initSentry();
        setVisible(false);
    }

    function decline() {
        setConsent("declined");
        setVisible(false);
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    role="dialog"
                    aria-label="Cookie-Hinweis"
                    aria-live="polite"
                    className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 pointer-events-none"
                >
                    <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-5 sm:p-6">
                        <div className="flex items-start gap-3">
                            <div className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                <CookieIcon size={18} />
                            </div>
                            <div className="flex-1 space-y-3">
                                <div className="space-y-1">
                                    <h2 className="text-sm font-semibold">Cookies &amp; Fehleranalyse</h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Wir setzen Sentry ein, um Fehler zu erkennen und die Stabilität der Karte zu
                                        verbessern. Dabei können Cookies gesetzt und Session-Aufzeichnungen erstellt
                                        werden. Diese Analyse läuft nur mit deiner Zustimmung.{" "}
                                        <a
                                            href="https://bte-germany.de/privacy"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline hover:text-foreground"
                                        >
                                            Mehr im Datenschutz
                                        </a>
                                    </p>
                                </div>
                                {/* Equal-weight buttons: accept and decline share the same
                                    variant/size so neither is visually favoured (GDPR — no dark pattern). */}
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <Button variant="outline" size="sm" onClick={decline} className="min-w-[130px]">
                                        Nur notwendige
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={accept} className="min-w-[130px]">
                                        Akzeptieren
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
