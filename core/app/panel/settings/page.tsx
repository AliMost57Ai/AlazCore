import { requireSession } from '@/lib/auth';
import { resolveApiKey } from '@/lib/licensing';
import SettingsClient from './SettingsClient';

export const metadata = { title: 'تنظیمات سامانه' };

export default async function SettingsPage() {
  await requireSession();

  const apiKey = await resolveApiKey();
  return (
    <SettingsClient
      apiKey={apiKey ?? ''}
      apiKeyFromEnv={Boolean(process.env.CORE_API_KEY)}
    />
  );
}
