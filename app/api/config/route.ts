import type { Role } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { EMAIL_CONFIG } from '@/config';
import { checkPermission } from '@/lib/auth';
import { PERMISSIONS, ROLES } from '@/lib/permissions';
import { getSiteConfig, updateSiteConfig } from '@/lib/siteConfig';
import { SiteConfig } from '@/types/siteConfig';

export const runtime = 'edge';

export async function GET() {
    try {
        const [defaultRole, emailDomains, adminContact, maxEmails] = await Promise.all([
            getSiteConfig(SiteConfig.DEFAULT_ROLE, ROLES.CIVILIAN),
            getSiteConfig(SiteConfig.EMAIL_DOMAINS, ''),
            getSiteConfig(SiteConfig.ADMIN_CONTACT, ''),
            getSiteConfig(SiteConfig.MAX_EMAILS, EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString())
        ]);
        return Response.json({ defaultRole, emailDomains, adminContact, maxEmails });
    } catch (error) {
        return NextResponse.json({ success: false, error }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const canAccess = await checkPermission(PERMISSIONS.MANAGE_CONFIG);

        if (!canAccess) {
            return Response.json(
                {
                    error: '权限不足'
                },
                { status: 403 }
            );
        }

        const { defaultRole, emailDomains, adminContact, maxEmails } = (await request.json()) as {
            defaultRole: Exclude<Role, typeof ROLES.EMPEROR>;
            emailDomains: string;
            adminContact: string;
            maxEmails: string;
        };

        if (![ROLES.DUKE, ROLES.KNIGHT, ROLES.CIVILIAN].includes(defaultRole)) {
            return Response.json({ error: '无效的角色' }, { status: 400 });
        }

        await Promise.all([
            updateSiteConfig(SiteConfig.DEFAULT_ROLE, defaultRole),
            updateSiteConfig(SiteConfig.EMAIL_DOMAINS, emailDomains),
            updateSiteConfig(SiteConfig.ADMIN_CONTACT, adminContact),
            updateSiteConfig(SiteConfig.MAX_EMAILS, maxEmails)
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error });
    }
}
