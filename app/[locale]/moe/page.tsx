import type { Locale } from '@/i18n/config';
import { redirect } from 'next/navigation';
import { ThreeColumnLayout } from '@/components/emails/three-column-layout';
import { Header } from '@/components/layout/header';
import { NoPermissionDialog } from '@/components/no-permission-dialog';
import { auth, checkPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';

export const runtime = 'edge';

export default async function MoePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: localeFromParams } = await params;
    const locale = localeFromParams as Locale;
    const session = await auth();

    if (!session?.user) {
        redirect(`/${locale}`);
    }

    const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL);

    return (
        <div className='bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 h-screen'>
            <div className='container mx-auto h-full px-4 lg:px-8 max-w-[1600px]'>
                <Header />
                <main className='h-full'>
                    <ThreeColumnLayout />
                    {!hasPermission && <NoPermissionDialog />}
                </main>
            </div>
        </div>
    );
}
