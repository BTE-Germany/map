import type {Metadata} from "next";
import {Geist, Geist_Mono, Outfit} from "next/font/google";
import "./globals.css";
import '@mantine/core/styles.css';

import {ColorSchemeScript, mantineHtmlProps, MantineProvider} from '@mantine/core';
import mantineTheme from "@/lib/mantineTheme";
import QueryWrapper from "@/components/common/QueryWrapper";
import {getSession} from "@/lib/auth";
import AuthProvider from "@/components/common/AuthProvider";


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
        <html lang="en" {...mantineHtmlProps}>
        <head>
            <ColorSchemeScript/>
        </head>
        <body
            className={`${geistSans.variable} ${outfit.variable} ${geistMono.variable} antialiased dark`}
        >
        <AuthProvider session={session}>
        <QueryWrapper>

            <MantineProvider theme={mantineTheme}>{children}</MantineProvider>
        </QueryWrapper>
        </AuthProvider>

        </body>
        </html>
    );
}
