import { redirect } from 'next/navigation';

/** منوی گزارشات صفحه‌ی مستقل دارد — پیش‌فرض به گزارش محصولات می‌رود. */
export default function ReportsIndexPage() {
  redirect('/panel/reports/products');
}
