export const PERMISSIONS = {
    ADMIN_ACCESS: "admin:access",
    REGIONS_VIEW: "regions:view",
    REGIONS_REFRESH_METADATA: "regions:refresh_metadata",
    REGIONS_EDIT: "regions:edit",
    USERS_VIEW: "users:view",
    SERVERS_MANAGE: "servers:manage",
    MAP_3D_VIEW: "map:3d_view",
    MAP_STYLES: "map:styles",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Map Keycloak realm roles → permissions (easily extensible)
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    admin: [
        PERMISSIONS.ADMIN_ACCESS,
        PERMISSIONS.REGIONS_VIEW,
        PERMISSIONS.REGIONS_REFRESH_METADATA,
        PERMISSIONS.REGIONS_EDIT,
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.SERVERS_MANAGE,
        PERMISSIONS.MAP_3D_VIEW,
        PERMISSIONS.MAP_STYLES,
    ],
    moderator: [
        PERMISSIONS.ADMIN_ACCESS,
        PERMISSIONS.REGIONS_VIEW,
        PERMISSIONS.REGIONS_REFRESH_METADATA,
    ],
    plus: [
        PERMISSIONS.MAP_3D_VIEW,
        PERMISSIONS.MAP_STYLES,
    ],
};

export function hasPermission(roles: string[], permission: Permission): boolean {
    return roles.some(role => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function getUserPermissions(roles: string[]): Permission[] {
    const perms = new Set<Permission>();
    for (const role of roles) {
        for (const perm of ROLE_PERMISSIONS[role] ?? []) {
            perms.add(perm);
        }
    }
    return Array.from(perms);
}
