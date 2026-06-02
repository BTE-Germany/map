import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

import QueryWrapper from "@/components/common/QueryWrapper";
import { getSession } from "@/lib/auth";
import AuthProvider from "@/components/common/AuthProvider";
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from "@/components/ui/sonner"


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
})


export const metadata: Metadata = {
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
                    </QueryWrapper>
                </AuthProvider>
                <Toaster />
            </body>
        </html>
    );
}
