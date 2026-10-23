import { redirect } from 'next/navigation';

/**
 * مقصد قدیمی منوی گزارشات مالی — با ساخته‌شدن گزارش‌های واقعی، این نشانی فقط
 * به اولین گزارش هدایت می‌شود (صفحه مقصدی زائد حذف شد).
 */
export default function FinancialReportsIndexPage() {
  redirect('/reports/summary');
}
