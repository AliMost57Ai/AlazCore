'use client';

import { useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import OtpLoginForm from '@/components/auth/OtpLoginForm';

export type LoginMode = 'classic' | 'otp';

export interface LoginSwitcherProps {
  /**
   * The mode the page opens in: 'otp' when the admin's site-wide policy forces
   * code-only sign-in, 'classic' otherwise. The user can still flip between
   * the two — staff always need the password form.
   */
  initialMode: LoginMode;
}

/**
 * Picks which sign-in form /login shows, flipping in place between the
 * classic (identifier + password) and OTP-only (phone + code) forms without a
 * page reload.
 */
export default function LoginSwitcher({ initialMode }: LoginSwitcherProps) {
  const [mode, setMode] = useState<LoginMode>(initialMode);

  return mode === 'otp' ? (
    <OtpLoginForm onSwitchToPassword={() => setMode('classic')} />
  ) : (
    <LoginForm onSwitchToOtp={() => setMode('otp')} />
  );
}
