/**
 * تست تحویل حضوری — قواعد ورودی نقطه/بازه/ظرفیت و helperهای نمایش. لایه
 * داده‌ی وابسته به DB اینجا پوشش داده نمی‌شود (چک ظرفیت در جریان checkout
 * با داده واقعی تأیید بصری/دستی می‌شود).
 */

import {
  dateLabel,
  minuteLabel,
  slotLabel,
  todayIso,
  validateLocationInput,
  type PickupLocationInput,
} from './pickup';

const validInput = (): PickupLocationInput => ({
  title: 'شعبه مرکزی',
  address: 'تهران، خیابان ولیعصر، پلاک ۱۲',
  lat: 35.74484,
  lng: 51.37532,
  isActive: true,
  slots: [{ startMinute: 540, endMinute: 720, capacity: 5 }],
});

describe('validateLocationInput — قواعد نقطه تحویل حضوری', () => {
  it('ورودی کامل و بازه درست پذیرفته می‌شود', () => {
    expect(validateLocationInput(validInput())).toBeNull();
  });

  it('عنوان کوتاه/بلند نامعتبر است', () => {
    expect(validateLocationInput({ ...validInput(), title: 'ش' })).toContain('عنوان');
    expect(validateLocationInput({ ...validInput(), title: 'x'.repeat(81) })).toContain('عنوان');
  });

  it('نشانی زیر ۱۰ نویسه رد می‌شود', () => {
    expect(validateLocationInput({ ...validInput(), address: 'تهران' })).toContain('نشانی');
  });

  it('بدون بازه زمانی رد می‌شود', () => {
    expect(validateLocationInput({ ...validInput(), slots: [] })).toContain('بازه زمانی');
  });

  it('پایان بازه باید بعد از شروع باشد', () => {
    expect(
      validateLocationInput({
        ...validInput(),
        slots: [{ startMinute: 720, endMinute: 540, capacity: 2 }],
      })
    ).toContain('بازه زمانی نامعتبر');
  });

  it('ظرفیت صفر/منفی/غیرصحیح رد می‌شود', () => {
    expect(
      validateLocationInput({
        ...validInput(),
        slots: [{ startMinute: 540, endMinute: 600, capacity: 0 }],
      })
    ).toContain('ظرفیت');
  });

  it('مختصات خارج از بازه جغرافیایی رد می‌شود', () => {
    expect(validateLocationInput({ ...validInput(), lat: 123 })).toContain('عرض جغرافیایی');
    expect(validateLocationInput({ ...validInput(), lng: 999 })).toContain('طول جغرافیایی');
  });
});

describe('helperهای نمایش', () => {
  it('minuteLabel دقیقه نیمه‌شب را HH:MM فارسی می‌کند', () => {
    expect(minuteLabel(540)).toBe('۰۹:۰۰');
    expect(minuteLabel(755)).toBe('۱۲:۳۵');
    expect(minuteLabel(0)).toBe('۰۰:۰۰');
  });

  it('slotLabel بازه را با «تا» می‌سازد', () => {
    expect(slotLabel({ startMinute: 540, endMinute: 720 })).toBe('۰۹:۰۰ تا ۱۲:۰۰');
  });

  it('dateLabel تاریخ ISO خراب را با «—» نشان می‌دهد', () => {
    expect(dateLabel('not-a-date')).toBe('—');
  });

  it('todayIso فرمت ISO محلی yyyy-mm-dd دارد', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
