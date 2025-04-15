import { Role, ROLES } from '@/lib/permissions';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { EMAIL_CONFIG } from '@/config';
import { createDb } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
    const db = createDb();
    const config = await db.query.siteConfig.findFirst();

    return Response.json({
        defaultRole: config?.defaultRole || ROLES.CIVILIAN,
        emailDomains: config?.emailDomains || '',
        adminContact: config?.adminContacts || '',
        maxEmails: config?.maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString()
    });
}

export async function POST(request: Request) {
    const { defaultRole, emailDomains, adminContact, maxEmails } = (await request.json()) as {
        defaultRole: Exclude<Role, typeof ROLES.EMPEROR>;
        emailDomains: string;
        adminContact: string;
        maxEmails: string;
    };

    if (![ROLES.DUKE, ROLES.KNIGHT, ROLES.CIVILIAN].includes(defaultRole)) {
        return Response.json({ error: '无效的角色' }, { status: 400 });
    }

    const env = getRequestContext().env;

    try {
        // 1. 先检查是否存在记录
        const existingConfig = await env.DB.prepare('SELECT * FROM site_config').first();

        if (!existingConfig) {
            // 如果不存在记录，则插入一条新记录
            await env.DB.prepare('INSERT INTO site_config (id, default_role, email_domains, admin_contacts, maxEmails) VALUES (?, ?, ?, ?)')
                .bind(crypto.randomUUID(), defaultRole, emailDomains, adminContact, maxEmails)
                .run();
        } else {
            // 如果存在记录，则更新
            await env.DB.prepare('UPDATE site_config SET default_role = ?, email_domains = ?, admin_contacts = ?, maxEmails = ?')
                .bind(defaultRole, emailDomains, adminContact, maxEmails)
                .run();
        }

        // 获取更新后的数据
        const updatedConfig = await env.DB.prepare('SELECT * FROM site_config').first();

        return Response.json({
            success: true,
            data: updatedConfig
        });
    } catch (error) {
        return Response.json(
            {
                error: '更新配置失败',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
