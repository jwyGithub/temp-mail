'use client';

import { LogIn } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SignButtonProps {
    size?: 'default' | 'lg';
}

export function SignButton({ size = 'default' }: SignButtonProps) {
    const router = useRouter();
    const locale = useLocale();
    const { data: session, status } = useSession();
    const t = useTranslations('auth.signButton');
    const loading = status === 'loading';

    if (loading) {
        return <div className='h-9' />;
    }

    if (!session?.user) {
        return (
            <Button onClick={() => router.push(`/${locale}/login`)} className={cn('gap-2', size === 'lg' ? 'px-8' : '')} size={size}>
                <LogIn className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
                {t('login')}
            </Button>
        );
    }

    return (
        <div className='flex items-center gap-4'>
            <Link href={`/${locale}/profile`} className='flex items-center gap-2 hover:opacity-80 transition-opacity'>
                {session.user.image && (
                    <Image
                        src={session.user.image}
                        alt={session.user.name || t('userAvatar')}
                        width={24}
                        height={24}
                        className='rounded-full'
                    />
                )}
                <span className='text-sm'>{session.user.name}</span>
            </Link>
            <Button
                onClick={() => signOut({ callbackUrl: `/${locale}` })}
                variant='outline'
                className={cn('flex-shrink-0', size === 'lg' ? 'px-8' : '')}
                size={size}
            >
                {t('logout')}
            </Button>
        </div>
    );
}
