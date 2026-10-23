import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { effectivePermissions } from '@/lib/session';
import { getTicketStatsForStaff } from '@/lib/support';

/**
 * Every page in this route group is behind the session guard.
 *
 * Middleware redirects signed-out traffic before it gets here; this call is the
 * second, authoritative check — a page must never render because a cookie
 * merely existed. Phone-registered customers belong on the storefront, not in
 * the admin panel, so they are sent back to the shop.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  if (session.role === 'customer') {
    redirect('/');
  }

  // The bell's first paint comes from the server (so it never shows a wrong
  // count on load); NotificationsMenu then keeps it fresh. Staff without the
  // support menu get `null` and keep the plain, menu-less bell.
  const supportStats = canAccessMenu(session, '/support') ? await getTicketStatsForStaff() : null;

  return (
    <DashboardShell
      user={{ name: session.name, email: session.email ?? session.phone ?? '', role: session.role }}
      perms={effectivePermissions(session)}
      supportStats={supportStats}
    >
      {children}
    </DashboardShell>
  );
}
