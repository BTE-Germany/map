import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import QueryWrapper from "@/components/common/QueryWrapper";
import { getSession } from "@/lib/auth";
import { getSiteUrl } from "@/lib/siteUrl";
import AuthProvider from "@/components/common/AuthProvider";
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from "@/components/ui/sonner"
import SearchDialog from "@/components/search/SearchDialog";
import SearchShortcut from "@/components/search/SearchShortcut";
import CookieBanner from "@/components/common/CookieBanner";


const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const outfit = Outfit({
    variable: "--font-outfit",
    subsets: ["latin"],
})


export const metadata: Metadata = {
    // Resolves file-based/relative metadata URLs (e.g. the region opengraph-image
    // route) to absolute URLs on the deployed domain instead of localhost.
    metadataBase: new URL(getSiteUrl()),
    title: "BTE Germany Map",
    description: "Finde heraus, wo auf BTE Germany bereits gebaut wurde.",
};


export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    const session = await getSession();

    return (
        <html lang="en" className="dark bg-background text-foreground">
            <body
                className={`${geistSans.variable} ${outfit.variable} ${geistMono.variable} antialiased bg-background`}
            >
                <NextTopLoader color="#2476f7" height={2} />
                <AuthProvider session={session}>
                    <QueryWrapper>
                        {children}
                        <SearchDialog />
                        <SearchShortcut />
                    </QueryWrapper>
                </AuthProvider>
                <Toaster />
                <CookieBanner />
                <Script
                    defer
                    src="https://umami.app.k8s.bteger.dev/script.js"
                    data-website-id="9cfe6709-83ab-4950-806d-a1cb3bd4a8d8"
                />
            </body>
        </html>
    );
}
