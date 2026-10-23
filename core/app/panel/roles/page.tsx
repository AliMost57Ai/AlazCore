import { requireApiAdmin } from '@/lib/auth';
import { listCoreRoles } from '@/lib/core-roles';
import RolesClient from './RolesClient';

export const metadata = { title: 'نقش‌ها' };

/** نقش‌های پنل Core — هم‌سان /roles فروشگاه؛ همین صفحه برای پرسنل آلازکور. */
export default async function CoreRolesPage() {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return (
      <div>
        <p>این صفحه فقط برای مدیر سامانه قابل مشاهده است.</p>
      </div>
    );
  }

  return <RolesClient initialRoles={await listCoreRoles()} currentEmail={session.email} />;
}
