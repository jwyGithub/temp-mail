import { Env } from '../types';
import { drizzle } from 'drizzle-orm/d1';
import { messages, emails, webhooks } from '../app/lib/schema';
import { eq, sql } from 'drizzle-orm';
import PostalMime from 'postal-mime';
import { WEBHOOK_CONFIG } from '../app/config/webhook';
import { EmailMessage } from '../app/lib/webhook';

const handleEmail = async (message: ForwardableEmailMessage, env: Env) => {
    const db = drizzle(env.DB, { schema: { messages, emails, webhooks } });

    const parsedMessage = await PostalMime.parse(message.raw);

    try {
        const targetEmail = await db.query.emails.findFirst({
            where: eq(sql`LOWER(${emails.address})`, message.to.toLowerCase())
        });

        if (!targetEmail) {
            console.error(`Email not found: ${message.to}`);
            return;
        }

        const savedMessage = await db
            .insert(messages)
            .values({
                emailId: targetEmail.id,
                fromAddress: message.from,
                subject: parsedMessage.subject || '(无主题)',
                content: parsedMessage.text || '',
                html: parsedMessage.html || ''
            })
            .returning()
            .get();

        const webhook = await db.query.webhooks.findFirst({
            where: eq(webhooks.userId, targetEmail!.userId!)
        });

        if (webhook?.enabled) {
            try {
                await fetch(webhook.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Event': WEBHOOK_CONFIG.EVENTS.NEW_MESSAGE
                    },
                    body: JSON.stringify({
                        emailId: targetEmail.id,
                        messageId: savedMessage.id,
                        fromAddress: savedMessage.fromAddress,
                        subject: savedMessage.subject,
                        content: savedMessage.content,
                        html: savedMessage.html,
                        receivedAt: savedMessage.receivedAt.toISOString(),
                        toAddress: targetEmail.address
                    } as EmailMessage)
                });
            } catch (error) {
                console.error('Failed to send webhook:', error);
            }
        }

        console.log(`Email processed: ${parsedMessage.subject}`);
    } catch (error) {
        console.error('Failed to process email:', error);
    }
};

const CLEANUP_CONFIG = {
    // Whether to delete expired emails
    DELETE_EXPIRED_EMAILS: true,

    // Whether to delete messages from expired emails if not deleting the emails themselves
    DELETE_MESSAGES_FROM_EXPIRED: true,

    // Batch processing size
    BATCH_SIZE: 100
} as const;

export default {
    async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
        await handleEmail(message, env);
    },
    async scheduled(controller: ScheduledController, env: Env) {
        const now = Date.now();

        try {
            // Find expired emails
            const { results: expiredEmails } = await env.DB.prepare(`SELECT id FROM email WHERE expires_at < ? LIMIT ?`)
                .bind(now, CLEANUP_CONFIG.BATCH_SIZE)
                .all();

            if (!expiredEmails?.length) {
                console.log('No expired emails found');
                return;
            }

            const expiredEmailIds = expiredEmails.map(email => email.id);
            const placeholders = expiredEmailIds.map(() => '?').join(',');

            if (CLEANUP_CONFIG.DELETE_EXPIRED_EMAILS) {
                // First delete associated messages
                await env.DB.prepare(`DELETE FROM message WHERE emailId IN (${placeholders})`)
                    .bind(...expiredEmailIds)
                    .run();

                // Then delete the emails
                await env.DB.prepare(`DELETE FROM email WHERE id IN (${placeholders})`)
                    .bind(...expiredEmailIds)
                    .run();

                console.log(`Deleted ${expiredEmails.length} expired emails and their messages`);
            } else if (CLEANUP_CONFIG.DELETE_MESSAGES_FROM_EXPIRED) {
                // Only delete messages from expired emails
                await env.DB.prepare(`DELETE FROM message WHERE emailId IN (${placeholders})`)
                    .bind(...expiredEmailIds)
                    .run();

                console.log(`Deleted messages from ${expiredEmails.length} expired emails`);
            } else {
                console.log('No cleanup actions performed (disabled in config)');
            }
        } catch (error) {
            console.error('Failed to cleanup:', error);
            throw error;
        }
    }
} satisfies ExportedHandler<Env>;
