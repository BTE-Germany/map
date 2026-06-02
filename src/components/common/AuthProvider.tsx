'use client';

import type { Session } from 'next-auth';
import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { useEffect } from 'react';

function SessionErrorHandler({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();

    useEffect(() => {
        if (session?.error === 'RefreshAccessTokenError') {
            console.error('Session refresh failed - logging out');
            signOut({ callbackUrl: '/' });
        }
    }, [session?.error]);

    return <>{children}</>;
}

export default function AuthProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
    return (
        <SessionProvider session={session}>
            <SessionErrorHandler>{children}</SessionErrorHandler>
        </SessionProvider>
    );
}