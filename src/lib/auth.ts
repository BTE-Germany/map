import NextAuth, { AuthOptions, Session, getServerSession } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import KeycloakProvider from 'next-auth/providers/keycloak';
import process from 'process';

/**
 * Refreshes access token to continue the session after token expiration
 * @param token Currently valid access token
 * @returns a new access token with refreshed information
 */
const refreshAccessToken = async (token: JWT) => {
    try {
        if (Date.now() < token.refreshTokenExpired) throw Error;
        const details = {
            client_id: process.env.KEYCLOAK_CLIENT_ID,
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
        };
        const formBody: string[] = [];
        Object.entries(details).forEach(([key, value]: [string, string | undefined]) => {
            const encodedKey = encodeURIComponent(key);
            const encodedValue = encodeURIComponent(value ?? '');
            formBody.push(encodedKey + '=' + encodedValue);
        });
        const formData = formBody.join('&');
        const url = `${process.env.KEYCLOAK_URL}/protocol/openid-connect/token`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
            body: formData,
        });
        const refreshedTokens = await response.json();
        if (!response.ok) throw refreshedTokens;
        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpired: Date.now() + (refreshedTokens.expires_in - 15) * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
            refreshTokenExpired: Date.now() + (refreshedTokens.refresh_expires_in - 15) * 1000,
        };
    } catch (error) {
        console.log(error);
        return {
            ...token,
            error: 'RefreshAccessTokenError',
        };
    }
};

export const authOptions: AuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/auth/signin",
    },
    providers: [
        KeycloakProvider({
            clientId: process.env.KEYCLOAK_CLIENT_ID || '',
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
            issuer: process.env.KEYCLOAK_URL || '',
            profile: (profile) => {
                return {
                    ...profile,
                    username: profile.preferred_username,
                    id: profile.sub,
                };
            },
        }),
    ],
    callbacks: {
        signIn: async ({ user, account }) => {
            if (account && user) {
                return true;
            } else {
                // TODO : Add unauthorized page
                return '/unauthorized';
            }
        },

        jwt: async ({ token, account, user }) => {
            // Initial sign in
            if (account && user) {
                // Add access_token, refresh_token and expirations to the token right after signin
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpired = Date.now() + (account.expires_in - 15) * 1000;
                token.refreshTokenExpired = Date.now() + (account.refresh_expires_in - 15) * 1000;
                token.user = user;
                return token;
            }
            // Return previous token if the access token has not expired yet
            if (Date.now() < token.accessTokenExpired || token.accessTokenExpired == null) return token;

            console.log('Access token has expired, trying to refresh it');

            // Access token has expired, try to update it
            return refreshAccessToken(token);
        },
        session: async ({ session, token }: { session: Session; token: JWT }) => {
            if (token) {
                // @ts-expect-error shut up typescript
                session.user = token.user;
                session.error = token.error;
                session.accessToken = token.accessToken;
            }
            return session;
        },
    },
};

/**
 * Helper function to get the session on the server without having to import the authOptions object every single time
 * @returns The session object or null
 */
export const getSession = () => getServerSession(authOptions);

