import { getSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';
import { DEFAULT_SUPPORT_WELCOME, resolveSupportWidgetConfig } from '@/lib/support-widget';
import SupportChatWidget from './SupportChatWidget';

/**
 * مونتاژ سرور-محور ویجت چت فروشگاه — صفحات عمومی فقط این را خواهرِ تم رندر
 * می‌کنند. پرسنل هرگز آن را نمی‌بینند (تیکت از پنل جواب داده می‌شود) و
 * پشتیبانی خاموش یعنی اصلاً مونت نمی‌شود.
 */
export default async function SupportChatMount() {
  const [session, settings] = await Promise.all([getSession(), getAppSettings()]);
  if (!settings.supportEnabled) {
    return null;
  }
  if (session && session.role !== 'customer') {
    return null;
  }
  const welcome = settings.supportWelcome.trim() || DEFAULT_SUPPORT_WELCOME;
  const config = resolveSupportWidgetConfig({
    supportWidgetPosition: settings.supportWidgetPosition,
    supportWidgetAnimation: settings.supportWidgetAnimation,
    supportWidgetDelay: settings.supportWidgetDelay,
    supportWidgetNoticeEnabled: settings.supportWidgetNoticeEnabled,
    supportWidgetNoticeSeconds: settings.supportWidgetNoticeSeconds,
  });
  return (
    <SupportChatWidget customerName={session?.name ?? null} welcome={welcome} config={config} />
  );
}
