import type { Locale } from '@/i18n/config';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { auth } from '@/lib/auth';

export const runtime = 'edge';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: localeFromParams } = await params;
    const locale = localeFromParams as Locale;
    const session = await auth();

    if (session?.user) {
        redirect(`/${locale}`);
    }

    return (
        <div className='min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800'>
            <LoginForm />
        </div>
    );
}
