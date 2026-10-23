import type { ReactNode } from 'react';
import PanelShell from '@/components/PanelShell';
import { requireSession, resolveCoreRole } from '@/lib/auth';
import { effectivePermissions } from '@/lib/session';
import { countUnreadForCore } from '@/lib/tickets';

/**
 * همه صفحات پنل پشت گارد سشن — proxy.ts رد می‌کند و اینجا دوباره (معتبر)
 * چک می‌شود. perms نقش هم برای فیلتر منو به شل می‌رود؛ برای توکن‌های قدیمی
 * (بدون perms) نقش زنده از دیتابیس resolve می‌شود.
 *
 * بج منوی تیکت‌ها = تیکت‌های در انتظار پشتیبان (قاعده نخوانده مشتق) — فقط
 * وقتی خود منو برای این نقش دیده می‌شود.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  const resolved = await resolveCoreRole(session.role);
  const perms = resolved?.isAdmin
    ? ['*']
    : (session.perms ?? resolved?.permissions ?? []);

  const effective = effectivePermissions({ ...session, perms });
  const canSeeTickets =
    effective.includes('*') ||
    effective.some((entry) => entry === '/panel/tickets' || entry.startsWith('/panel/tickets:'));
  const badges = canSeeTickets ? { '/panel/tickets': await countUnreadForCore() } : undefined;

  return (
    <PanelShell
      user={{ name: session.name, email: session.email, role: session.role }}
      perms={effective}
      badges={badges}
    >
      {children}
    </PanelShell>
  );
}
