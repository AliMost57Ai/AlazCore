import type { Metadata } from 'next';
import Link from 'next/link';
import { Accordion, Anchor, Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import StorefrontChrome from '@/components/themes/StorefrontChrome';
import SupportChatMount from '@/components/shop/SupportChatMount';
import { ShopCartProvider } from '@/components/shop/ShopCartProvider';
import { getSession } from '@/lib/auth';
import { listActiveFaqEntries } from '@/lib/faq';
import { listCategories } from '@/lib/categories';
import { getAppSettings } from '@/lib/settings';
import { getWalletBalance } from '@/lib/wallet';
import { ensureSiteContext } from '@/lib/site-context';
import { getActiveTheme, getSiteSettings } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';
import shared from '@/components/themes/shared/theme-shared.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  await ensureSiteContext();
  return { title: 'سوالات متداول' };
}

/**
 * صفحه عمومی سوالات متداول — در قالب فعال (StorefrontChrome) با آکاردئون؛
 * محتوا از /settings/faq پنل می‌آید و فقط فعال‌ها به ترتیب پنل می‌آیند.
 */
export default async function FaqPage() {
  const [entries, session, active, site, categories, appSettings] = await Promise.all([
    listActiveFaqEntries(),
    getSession(),
    getActiveTheme(),
    getSiteSettings(),
    listCategories(),
    getAppSettings(),
  ]);

  // The header chip shows customers their wallet balance — staff never see it.
  const walletBalance = session?.role === 'customer' ? await getWalletBalance(session.sub) : 0;
  const theme = { ...THEME_MAP[active.id], config: active.config };

  return (
    <ShopCartProvider>
      <StorefrontChrome
        theme={theme}
        categories={categories}
        session={session ? { name: session.name, role: session.role, walletBalance } : null}
        site={site}
        requireNationalId={appSettings.shahkarEnabled}
      >
        <div className={shared.wrap} style={{ paddingBlock: 24, flex: 1 }}>
          <Breadcrumbs mb="md">
            <Anchor href="/" size="sm">
              {site.siteName}
            </Anchor>
            <Text size="sm" c="dimmed">
              سوالات متداول
            </Text>
          </Breadcrumbs>

          <Stack gap="md" maw={820} style={{ marginInline: 'auto', width: '100%' }}>
            <Title order={1} fz={{ base: 'h2', sm: 'h1' }} ta="center">
              سوالات متداول
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              پاسخ پرتکرارترین پرسش‌های خرید از {site.siteName}
            </Text>

            {entries.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                هنوز سوالی ثبت نشده است — برای پرسش خود از گفتگوی پشتیبانی استفاده کنید.
              </Text>
            ) : (
              <Accordion variant="separated" radius="md" defaultValue={entries[0]?.id}>
                {entries.map((entry) => (
                  <Accordion.Item key={entry.id} value={entry.id}>
                    <Accordion.Control>{entry.question}</Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                        {entry.answer}
                      </Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}

            <Group justify="center" mt="md">
              <Anchor component={Link} href="/account/support" size="sm" c="brand">
                پاسخ سوالتان را پیدا نکردید؟ با پشتیبانی گفتگو کنید
              </Anchor>
            </Group>
          </Stack>
        </div>
      </StorefrontChrome>

      {/* ویجت چت پشتیبانی — fixed بیرون از مارک‌آپ تم می‌نشیند. */}
      <SupportChatMount />
    </ShopCartProvider>
  );
}
