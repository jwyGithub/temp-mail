'use client';

import { Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignButton } from '../auth/sign-button';

interface ActionButtonProps {
    isLoggedIn?: boolean;
}

export function ActionButton({ isLoggedIn }: ActionButtonProps) {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('home');

    if (isLoggedIn) {
        return (
            <Button
                size='lg'
                onClick={() => router.push(`/${locale}/moe`)}
                className='gap-2 bg-primary hover:bg-primary/90 text-white px-8'
            >
                <Mail className='w-5 h-5' />
                {t('actions.enterMailbox')}
            </Button>
        );
    }

    return <SignButton size='lg' />;
}
