import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { requireSession } from '@/lib/auth';
import { collectBellSnapshot } from '@/lib/bell';
import { coreAllowedHrefs, getLicense, isInPersonDeliveryEnabled } from '@/lib/core-license';
import { effectivePermissions } from '@/lib/session';
import { currentRequestDomain } from '@/lib/site-context';

/**
 * Every page in this route group is behind the session guard.
 *
 * Middleware redirects signed-out traffic before it gets here; this call is the
 * second, authoritative check — a page must never render because a cookie
 * merely existed. Phone-registered customers belong on the storefront, not in
 * the admin panel, so they are sent back to the shop.
 *
 * منوهایی که ادمین سایت می‌بیند از دو جا می‌آیند: نقش داخلی خودش و پلنی که
 * پنل Core (سوپرادمین) برای دامنه فعال کرده (بند ۲-۹). اگر Core تنظیم نشده
 * باشد یا پاسخ ندهد، منوهای نقش دست‌نخورده می‌مانند (fail-open).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  if (session.role === 'customer') {
    redirect('/');
  }

  let perms = effectivePermissions(session);

  const domain = await currentRequestDomain();
  const license = await getLicense(domain ?? '');
  // پلن Core منوهای پرسنل را محدود می‌کند؛ مالک (admin) پنل کامل می‌بیند.
  const allowedByCore = session.role === 'admin' ? null : coreAllowedHrefs(license);

  if (allowedByCore) {
    // اشتراک منوهای نقش و پلن Core؛ wildcard نقش فقط تا مرز پلن اعتبار دارد.
    perms = perms.includes('*')
      ? [...allowedByCore]
      : perms.filter((entry) => allowedByCore.has(entry.replace(/:(edit|add)$/, '')));
  }

  // badgeهای منو و شمارهای زنگ — تک منبع lib/bell (همان محاسبه‌ای که
  // /api/notifications برای polling زندهٔ watcher انجام می‌دهد).
  // تحویل حضوری: خاموش در Core = منوها/صفحاتش کامل پنهان — حتی برای ادمین.
  const pickupEnabled = await isInPersonDeliveryEnabled();
  const { badges, notifications } = await collectBellSnapshot();

  return (
    <DashboardShell
      user={{ name: session.name, email: session.email ?? session.phone ?? '', role: session.role }}
      perms={perms}
      badges={badges}
      notifications={notifications}
      disabledHrefs={pickupEnabled ? [] : ['/settings/pickup', '/orders/pickup']}
    >
      {children}
    </DashboardShell>
  );
}
