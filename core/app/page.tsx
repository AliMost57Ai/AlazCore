import { redirect } from 'next/navigation';

/** `/` پنل Core فقط یک در است — می‌رود سراغ پنل (خودش سشن را چک می‌کند). */
export default function CoreRootPage() {
  redirect('/panel');
}
