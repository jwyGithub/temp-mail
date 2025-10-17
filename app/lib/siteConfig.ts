import type { SiteConfig } from '@/types/siteConfig';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { eq } from 'drizzle-orm';
import { createDb } from './db';
import { siteConfig } from './schema';

export async function getSiteConfig(key: keyof typeof SiteConfig, defaultValue?: string) {
    const db = createDb(getRequestContext().env.DB);
    try {
        const config = await db.query.siteConfig.findFirst({
            where: eq(siteConfig.key, key)
        });
        return config?.value ?? defaultValue;
    } catch (error) {
        throw new Error(`Failed to get site config: ${error}`);
    }
}

export async function setSiteConfig(key: keyof typeof SiteConfig, value: string) {
    const db = createDb(getRequestContext().env.DB);
    try {
        await db.insert(siteConfig).values({ key, value });
    } catch (error) {
        throw new Error(`Failed to set site config: ${error}`);
    }
}

export async function deleteSiteConfig(key: keyof typeof SiteConfig) {
    const db = createDb(getRequestContext().env.DB);
    try {
        await db.delete(siteConfig).where(eq(siteConfig.key, key));
    } catch (error) {
        throw new Error(`Failed to delete site config: ${error}`);
    }
}

export async function hasSiteConfig(key: keyof typeof SiteConfig) {
    const db = createDb(getRequestContext().env.DB);
    try {
        const config = await db.query.siteConfig.findFirst({
            where: eq(siteConfig.key, key)
        });
        return !!config;
    } catch (error) {
        throw new Error(`Failed to has site config: ${error}`);
    }
}

export async function updateSiteConfig(key: keyof typeof SiteConfig, value: string) {
    const db = createDb(getRequestContext().env.DB);
    try {
        const hasConfig = await hasSiteConfig(key);
        if (hasConfig) {
            await db.update(siteConfig).set({ value }).where(eq(siteConfig.key, key));
        } else {
            await setSiteConfig(key, value);
        }
    } catch (error) {
        throw new Error(`Failed to update site config: ${error}`);
    }
}
