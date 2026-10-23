/**
 * تست جریان وضعیت تیکت — واژه‌نامه مرجع ۳ وضعیته: پیام درخواست‌کننده → open
 * «در انتظار پاسخ»، پیام پشتیبان → answered، و تیکت بسته با پیام باز نمی‌شود.
 */

import { closedStatus, isSupporterSide, nextTicketStatus } from './ticket-flow';

describe('nextTicketStatus — واژه‌نامه مرجع', () => {
  it('پیام پشتیبان (core) تیکت باز را answered می‌کند', () => {
    expect(nextTicketStatus('core', 'open')).toBe('answered');
  });

  it('پیام پشتیبان (owner، ساید فروشگاه) هم answered می‌کند', () => {
    expect(nextTicketStatus('owner', 'open')).toBe('answered');
  });

  it('پیام درخواست‌کننده (tenant/customer) تیکت را به open «در انتظار پاسخ» می‌برد', () => {
    expect(nextTicketStatus('tenant', 'answered')).toBe('open');
    expect(nextTicketStatus('customer', 'answered')).toBe('open');
  });

  it('تیکت بسته با پیام باز نمی‌شود — بازگشایی فقط اکشن صریح پشتیبان است', () => {
    expect(nextTicketStatus('core', 'closed')).toBe('closed');
    expect(nextTicketStatus('tenant', 'closed')).toBe('closed');
    expect(nextTicketStatus('owner', 'closed')).toBe('closed');
    expect(nextTicketStatus('customer', 'closed')).toBe('closed');
  });

  it('سمت ناشناخته مثل درخواست‌کننده رفتار می‌کند (fail-safe)', () => {
    expect(nextTicketStatus('unknown-side', 'answered')).toBe('open');
  });

  it('isSupporterSide فقط دو سمت پشتیبانی را می‌شناسد', () => {
    expect(isSupporterSide('core')).toBe(true);
    expect(isSupporterSide('owner')).toBe(true);
    expect(isSupporterSide('tenant')).toBe(false);
    expect(isSupporterSide('customer')).toBe(false);
  });

  it('بستن صریح همیشه closed است', () => {
    expect(closedStatus()).toBe('closed');
  });
});
