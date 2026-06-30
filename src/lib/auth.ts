import { AuthOptions, Session, getServerSession } from 'next-auth';
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
        if (!token.refreshToken) {
            console.error('[Auth] Missing refresh token');
            throw new Error('Missing refresh token');
        }

        if (token.refreshTokenExpired && Date.now() >= token.refreshTokenExpired) {
            console.error('[Auth] Refresh token has expired');
            throw new Error('Refresh token expired');
        }

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

        if (!response.ok) {
            // Never log the raw token response — it can contain access/refresh tokens.
            console.error('[Auth] Failed to refresh token, status:', response.status);
            throw new Error(`Token refresh failed (${response.status})`);
        }

        const refreshedAccessExpiresIn = refreshedTokens.expires_in ?? 0;
        const refreshedRefreshExpiresIn = refreshedTokens.refresh_expires_in ?? 0;

        const nextRefreshExpiry = refreshedRefreshExpiresIn
            ? Date.now() + (refreshedRefreshExpiresIn - 15) * 1000
            : token.refreshTokenExpired;

        console.log('[Auth] Token refreshed successfully');

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpired: Date.now() + (refreshedAccessExpiresIn - 15) * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
            refreshTokenExpired: nextRefreshExpiry,
            error: undefined,
        };
    } catch (error) {
        console.error('[Auth] Error refreshing access token:', error);
        return {
            ...token,
            error: 'RefreshAccessTokenError',
        };
    }
};

const isSecureCookies = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');

export const authOptions: AuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    useSecureCookies: isSecureCookies,
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

        jwt: async ({ token, account, user, trigger }) => {
            // Session update triggered by useSession().update()
            if (trigger === "update" && token.accessToken) {
                try {
                    const userInfoRes = await fetch(
                        `${process.env.KEYCLOAK_URL}/protocol/openid-connect/userinfo`,
                        { headers: { Authorization: `Bearer ${token.accessToken}` } }
                    );
                    if (userInfoRes.ok) {
                        const userInfo = await userInfoRes.json();
                        token.user = { ...(token.user as object), ...userInfo };
                    }
                } catch (e) {
                    console.error('[Auth] Failed to refresh user info on update:', e);
                }
                return token;
            }

            // Initial sign in
            if (account && user) {
                // Add access_token, refresh_token and expirations to the token right after signin
                const accessExpiresIn = account.expires_in ?? 0;
                const refreshExpiresIn = account.refresh_expires_in ?? 0;

                console.log('[Auth] Initial sign in, setting up tokens');

                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpired = Date.now() + (accessExpiresIn - 15) * 1000;
                token.refreshTokenExpired = refreshExpiresIn
                    ? Date.now() + (refreshExpiresIn - 15) * 1000
                    : undefined;
                token.user = user;
                return token;
            }

            // Return previous token if the access token has not expired yet
            if (token.accessTokenExpired && Date.now() < token.accessTokenExpired) {
                return token;
            }

            // Access token has expired, try to update it
            console.log('[Auth] Access token expired, attempting refresh');
            return refreshAccessToken(token);
        },
        session: async ({ session, token }: { session: Session; token: JWT }) => {
            if (token) {
                // If refresh token failed, force logout by setting error
                if (token.error === 'RefreshAccessTokenError') {
                    console.error('[Auth] Refresh token error detected, forcing logout');
                    session.error = 'RefreshAccessTokenError';
                    return session;
                }

                // token.user carries the full Keycloak profile at runtime; its
                // static type (next-auth's User) under-describes those claims,
                // so we assert the richer session-user shape here at the boundary.
                if (token.user) {
                    session.user = token.user as unknown as Session["user"];
                }
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

