import type { Db } from './db';
import type { Permission, Role } from './permissions';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import { comparePassword, hashPassword } from '@/lib/utils';
import { authSchema } from '@/lib/validation';
import { SiteConfig } from '@/types/siteConfig';
import { getUserId } from './apiKey';
import { generateAvatarUrl } from './avatar';
import { createDb } from './db';
import { hasPermission, ROLES } from './permissions';
import { accounts, roles, userRoles, users } from './schema';
import { getSiteConfig } from './siteConfig';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
    [ROLES.EMPEROR]: '皇帝（网站所有者）',
    [ROLES.DUKE]: '公爵（超级用户）',
    [ROLES.KNIGHT]: '骑士（高级用户）',
    [ROLES.CIVILIAN]: '平民（普通用户）'
};

const getDefaultRole = async (): Promise<Role> => {
    const defaultRole = await getSiteConfig(SiteConfig.DEFAULT_ROLE);

    if (defaultRole === ROLES.DUKE || defaultRole === ROLES.KNIGHT || defaultRole === ROLES.CIVILIAN) {
        return defaultRole as Role;
    }

    return ROLES.CIVILIAN;
};

async function findOrCreateRole(db: Db, roleName: Role) {
    let role = await db.query.roles.findFirst({
        where: eq(roles.name, roleName)
    });

    if (!role) {
        const [newRole] = await db
            .insert(roles)
            .values({
                name: roleName,
                description: ROLE_DESCRIPTIONS[roleName]
            })
            .returning();
        role = newRole;
    }

    return role;
}

export async function assignRoleToUser(db: Db, userId: string, roleId: string) {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));

    await db.insert(userRoles).values({
        userId,
        roleId
    });
}

export async function getUserRole(userId: string) {
    const db = createDb(getRequestContext().env.DB);
    const userRoleRecords = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, userId),
        with: { role: true }
    });
    return userRoleRecords[0].role.name;
}

export async function checkPermission(permission: Permission) {
    const userId = await getUserId();

    if (!userId) return false;

    const db = createDb(getRequestContext().env.DB);
    const userRoleRecords = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, userId),
        with: { role: true }
    });

    const userRoleNames = userRoleRecords.map(ur => ur.role.name);
    return hasPermission(userRoleNames as Role[], permission);
}

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut
} = NextAuth(() => ({
    secret: process.env.AUTH_SECRET,
    adapter: DrizzleAdapter(createDb(getRequestContext().env.DB), {
        usersTable: users,
        accountsTable: accounts
    }),
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET
        }),
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: '用户名', type: 'text', placeholder: '请输入用户名' },
                password: { label: '密码', type: 'password', placeholder: '请输入密码' }
            },
            async authorize(credentials) {
                if (!credentials) {
                    throw new Error('请输入用户名和密码');
                }

                const { username, password } = credentials;

                try {
                    authSchema.parse({ username, password });
                } catch (e: any) {
                    throw new Error(e.message);
                }

                const db = createDb(getRequestContext().env.DB);

                const user = await db.query.users.findFirst({
                    where: eq(users.username, username as string)
                });

                if (!user) {
                    throw new Error('用户名或密码错误');
                }

                const isValid = await comparePassword(password as string, user.password as string);
                if (!isValid) {
                    throw new Error('用户名或密码错误');
                }

                return {
                    ...user,
                    password: undefined
                };
            }
        })
    ],
    events: {
        async signIn({ user }) {
            if (!user.id) return;

            try {
                const db = createDb(getRequestContext().env.DB);
                const existingRole = await db.query.userRoles.findFirst({
                    where: eq(userRoles.userId, user.id)
                });

                if (existingRole) return;

                const defaultRole = await getDefaultRole();
                const role = await findOrCreateRole(db, defaultRole);
                await assignRoleToUser(db, user.id, role.id);
            } catch (error) {
                console.error('Error assigning role:', error);
            }
        }
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.name = user.name || user.username;
                token.username = user.username;
                token.image = user.image || generateAvatarUrl(token.name as string);
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string;
                session.user.username = token.username as string;
                session.user.image = token.image as string;

                const db = createDb(getRequestContext().env.DB);
                let userRoleRecords = await db.query.userRoles.findMany({
                    where: eq(userRoles.userId, session.user.id),
                    with: { role: true }
                });

                if (!userRoleRecords.length) {
                    const defaultRole = await getDefaultRole();
                    const role = await findOrCreateRole(db, defaultRole);
                    await assignRoleToUser(db, session.user.id, role.id);
                    userRoleRecords = [
                        {
                            userId: session.user.id,
                            roleId: role.id,
                            createdAt: new Date(),
                            role
                        }
                    ];
                }

                session.user.roles = userRoleRecords.map(ur => ({
                    name: ur.role.name
                }));
            }

            return session;
        }
    },
    session: {
        strategy: 'jwt'
    }
}));

export async function register(username: string, password: string) {
    const db = createDb(getRequestContext().env.DB);

    const existing = await db.query.users.findFirst({
        where: eq(users.username, username)
    });

    if (existing) {
        throw new Error('用户名已存在');
    }

    const hashedPassword = await hashPassword(password);

    const [user] = await db
        .insert(users)
        .values({
            username,
            password: hashedPassword
        })
        .returning();

    return user;
}
