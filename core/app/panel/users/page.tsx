import { requireApiAdmin } from '@/lib/auth';
import prisma from '@/lib/db';
import UsersClient from './UsersClient';

export const metadata = { title: 'کاربران Core' };

export default async function UsersPage() {
  // صفحه فقط برای مدیر کل — support به داشبورد برمی‌گردد.
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return (
      <div>
        <p>این صفحه فقط برای مدیر کل قابل مشاهده است.</p>
      </div>
    );
  }

  const users = await prisma.coreUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return (
    <UsersClient
      users={JSON.parse(JSON.stringify(users))}
      currentEmail={session.email}
    />
  );
}
