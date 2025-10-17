'use client';

import type { Permission, Role } from '@/lib/permissions';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

export function useRolePermission() {
    const { data: session } = useSession();
    const roles = session?.user?.roles;

    const checkPermission = (permission: Permission) => {
        if (!roles) return false;
        return hasPermission(roles.map(r => r.name) as Role[], permission);
    };

    const hasRole = (role: Role) => {
        if (!roles) return false;
        return roles.some(r => r.name === role);
    };

    return {
        checkPermission,
        hasRole,
        roles
    };
}
