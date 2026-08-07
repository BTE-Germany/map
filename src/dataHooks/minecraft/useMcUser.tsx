import { useQuery } from "@tanstack/react-query";
import getUser from "@/actions/minecraft/user";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Minecraft usernames: 1–16 characters, letters/digits/underscore only. */
const USERNAME_RE = /^[a-zA-Z0-9_]{1,16}$/;

/** Whether `value` could be a Minecraft username at all — worth looking up. */
function isMcUsername(value: string): boolean {
    return USERNAME_RE.test(value.trim());
}

const useMcUser = (mcUuid: string) => useQuery({
    queryKey: ['mcUser', mcUuid],
    queryFn: () => getUser(mcUuid),
    enabled: !!mcUuid,
});

/**
 * Resolves a Minecraft profile from an exact username.
 *
 * playerdb only knows complete names, so this is a lookup rather than a search:
 * a partial name yields `null` exactly like a name that doesn't exist. Callers
 * get `undefined` while the request is in flight and `null` for "no such
 * player", so the two states stay distinguishable.
 */
const useMcUserByName = (username: string) => useQuery({
    queryKey: ['mcUser', 'byName', username.trim().toLowerCase()],
    queryFn: () => getUser(username.trim()),
    enabled: isMcUsername(username),
    // `getUser` reports failures as `null` instead of throwing, so a retry
    // would only repeat a lookup that already answered.
    retry: false,
    staleTime: DAY_MS,
});

export { useMcUser, useMcUserByName, isMcUsername };
