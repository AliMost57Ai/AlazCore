import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'ورود' };

export default function CoreLoginPage() {
  // useSearchParams داخل فرم است — مرز Suspense برای پیش‌رندر لازم است.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
