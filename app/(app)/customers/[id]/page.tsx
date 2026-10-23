import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Anchor, Breadcrumbs, Text } from '@mantine/core';
import CustomerFileView from '@/components/customers/CustomerFile';
import PageHeader from '@/components/layout/PageHeader';
import { canAccessCustomerFile, canAccessMenu, requireSession } from '@/lib/auth';
import { getCustomerFile } from '@/lib/customers';
import { enCurrency } from '@/lib/format';

export const metadata: Metadata = {
  title: 'پروندهٔ مشتری',
};

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

/**
 * پروندهٔ مشتری — سابقهٔ کامل و فقط-خواندنی؛ هم از لیست مشتریان و هم از داخل
 * تیکت پشتیبانی باز می‌شود. دو گرهٔ دسترسی می‌تواند بازش کند ('/customers' یا
 * توکن مستقل '/customers/file') — همان ALTERNATE_GRANTS پراکسی؛ نان‌داشتن
 * هر دو به داشبورد برمی‌گردد.
 */
export default async function CustomerFilePage({ params }: PageProps) {
  const session = await requireSession('/customers');
  if (!canAccessCustomerFile(session)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const file = await getCustomerFile(decodeURIComponent(id));
  if (!file) {
    notFound();
  }

  // مسیر برگشت هوشمند: دارندگان لیست مشتریان به لیست، پشتیبانِ فقط-پرونده به تیکت‌ها.
  const backTo = canAccessMenu(session, '/customers') ? '/customers' : '/customer-support';

  return (
    <>
      <Breadcrumbs mb="sm" className="no-print">
        <Anchor href={backTo} size="sm">
          {backTo === '/customers' ? 'مشتریان' : 'پشتیبانی مشتریان'}
        </Anchor>
        <Text size="sm" c="dimmed">
          پروندهٔ {file.name}
        </Text>
      </Breadcrumbs>

      <PageHeader
        title={`پروندهٔ ${file.name}`}
        description={`${file.orderCount} سفارش · مجموع خرید ${enCurrency(file.spent, false)} · عضویت از ${file.since}`}
      />

      <CustomerFileView
        file={file}
        canViewTickets={canAccessMenu(session, '/customer-support')}
        canViewReturns={canAccessMenu(session, '/returns')}
      />
    </>
  );
}
