import { NextResponse } from 'next/server';
import { EMAIL_CONFIG } from '@/config';
import { checkPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { getSiteConfig, updateSiteConfig } from '@/lib/siteConfig';
import { SiteConfig } from '@/types/siteConfig';

export const runtime = 'edge';

interface EmailServiceConfig {
    enabled: boolean;
    apiKey: string;
    roleLimits: {
        duke?: number;
        knight?: number;
    };
}

export async function GET() {
    const canAccess = await checkPermission(PERMISSIONS.MANAGE_CONFIG);

    if (!canAccess) {
        return NextResponse.json(
            {
                error: '权限不足'
            },
            { status: 403 }
        );
    }

    try {
        const [enabled, apiKey, roleLimits] = await Promise.all([
            getSiteConfig(SiteConfig.EMAIL_SERVICE_ENABLED, 'true'),
            getSiteConfig(SiteConfig.RESEND_API_KEY, ''),
            getSiteConfig(SiteConfig.EMAIL_ROLE_LIMITS, '')
        ]);

        const customLimits = roleLimits ? JSON.parse(roleLimits) : {};

        const finalLimits = {
            duke: customLimits.duke !== undefined ? customLimits.duke : EMAIL_CONFIG.DEFAULT_DAILY_SEND_LIMITS.duke,
            knight: customLimits.knight !== undefined ? customLimits.knight : EMAIL_CONFIG.DEFAULT_DAILY_SEND_LIMITS.knight
        };

        return NextResponse.json({
            enabled: enabled === 'true',
            apiKey,
            roleLimits: finalLimits
        });
    } catch (error) {
        console.error('Failed to get email service config:', error);
        return NextResponse.json({ error: '获取 Resend 发件服务配置失败' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const canAccess = await checkPermission(PERMISSIONS.MANAGE_CONFIG);

        if (!canAccess) {
            return NextResponse.json(
                {
                    error: '权限不足'
                },
                { status: 403 }
            );
        }

        try {
            const config = (await request.json()) as EmailServiceConfig;

            if (config.enabled && !config.apiKey) {
                return NextResponse.json({ error: '启用 Resend 时，API Key 为必填项' }, { status: 400 });
            }

            const customLimits: { duke?: number; knight?: number } = {};
            if (config.roleLimits?.duke !== undefined) {
                customLimits.duke = config.roleLimits.duke;
            }
            if (config.roleLimits?.knight !== undefined) {
                customLimits.knight = config.roleLimits.knight;
            }

            await Promise.all([
                updateSiteConfig(SiteConfig.EMAIL_SERVICE_ENABLED, config.enabled.toString()),
                updateSiteConfig(SiteConfig.RESEND_API_KEY, config.apiKey),
                updateSiteConfig(SiteConfig.EMAIL_ROLE_LIMITS, JSON.stringify(customLimits))
            ]);

            return NextResponse.json({ success: true });
        } catch (error) {
            console.error('Failed to save email service config:', error);
            return NextResponse.json({ error: '保存 Resend 发件服务配置失败' }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ error }, { status: 500 });
    }
}
