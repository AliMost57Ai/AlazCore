'use client';

import { useState } from 'react';
import { IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Button, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import shared from '../shared/theme-shared.module.css';
import classes from './beautyshop.module.css';

export interface NewsletterSignupProps {
  title: string;
}

/**
 * BeautyShop newsletter panel — real since Batch L: the address is POSTed to
 * /api/newsletter, stored server-side, and duplicates answer "already".
 */
export default function NewsletterSignup({ title }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        already?: boolean;
        error?: string;
      };
      if (response.ok) {
        notifications.show({
          title: payload.already ? 'قبلاً ثبت شده' : 'ثبت شد',
          message: payload.already
            ? 'این ایمیل در خبرنامه فروشگاه موجود است.'
            : 'ایمیل شما در خبرنامه فروشگاه ثبت شد.',
          color: payload.already ? 'blue' : 'green',
          icon: <IconCircleCheck size={18} />,
        });
        setEmail('');
      } else {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ثبت ایمیل ناموفق بود.',
          color: 'red',
        });
      }
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد.',
        color: 'red',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="newsletter" className={shared.section}>
      <div className={shared.wrap}>
        <div className={classes.newsletter}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.75 }}>
            جدیدترین محصولات و تخفیف‌ها را زودتر از همه دریافت کنید.
          </p>
          <form className={classes.newsletterInput} onSubmit={handleSubmit}>
            <TextInput
              placeholder="ایمیل شما…"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit" leftSection={<IconSend size={16} />} loading={pending}>
              عضویت
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
