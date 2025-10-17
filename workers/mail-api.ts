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

    console.log('parsedMessage:', parsedMessage);

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
                html: parsedMessage.html || '',
                type: 'received'
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

    // Batch processing size
    BATCH_SIZE: 100
} as const;

export default {
    async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
        await handleEmail(message, env);
    },
    async scheduled(_: ScheduledController, env: Env) {
        const now = Date.now();

        try {
            if (!CLEANUP_CONFIG.DELETE_EXPIRED_EMAILS) {
                console.log('Expired email deletion is disabled');
                return;
            }

            const result = await env.DB.prepare(
                `
          DELETE FROM email 
          WHERE expires_at < ?
          LIMIT ?
        `
            )
                .bind(now, CLEANUP_CONFIG.BATCH_SIZE)
                .run();

            if (result.success) {
                console.log(`Deleted ${result?.meta?.changes ?? 0} expired emails and their associated messages`);
            } else {
                console.error('Failed to delete expired emails');
            }
        } catch (error) {
            console.error('Failed to cleanup:', error);
            throw error;
        }
    }
} satisfies ExportedHandler<Env>;
