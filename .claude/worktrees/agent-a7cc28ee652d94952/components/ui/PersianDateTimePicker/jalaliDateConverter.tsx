// utils/jalaliDateConverter.ts
import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js';

// تبدیل تاریخ میلادی به شمسی برای نمایش
export function toPersianDate(date: Date): string {
  const gregorian = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };

  const jalali = toJalaali(gregorian.year, gregorian.month, gregorian.day);
  return `${jalali.jy}/${jalali.jm.toString().padStart(2, '0')}/${jalali.jd.toString().padStart(2, '0')}`;
}

// تبدیل تاریخ شمسی به میلادی
export function fromPersianDate(persianDate: string): Date | null {
  const parts = persianDate.split('/').map(Number);
  if (parts.length !== 3) {
    return null;
  }

  const [year, month, day] = parts;

  if (!isValidJalaaliDate(year, month, day)) {
    return null;
  }

  const gregorian = toGregorian(year, month, day);
  return new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
}

export function fromPersianDateTime(
  persianDateTime: string,
  withSeconds: boolean = false
): Date | null {
  // جدا کردن تاریخ و زمان
  const parts = persianDateTime.trim().split(/\s+/);

  let datePart = '';
  let timePart = '00:00';

  if (parts.length === 1) {
    // فقط تاریخ داده شده
    datePart = parts[0];
  } else if (parts.length >= 2) {
    // تاریخ و زمان داده شده
    datePart = parts[0];

    // بررسی که بخش دوم زمان باشد (فرمت HH:mm یا HH:mm:ss)
    const timeRegex = withSeconds ? /^\d{1,2}:\d{1,2}:\d{1,2}$/ : /^\d{1,2}:\d{1,2}$/;
    if (timeRegex.test(parts[1])) {
      timePart = parts[1];
    }
  }

  // جدا کردن اجزای تاریخ
  const dateParts = datePart.split('/').map(Number);
  if (dateParts.length !== 3) {
    return null;
  }

  const [year, month, day] = dateParts;

  // اعتبارسنجی تاریخ شمسی
  if (!isValidJalaaliDate(year, month, day)) {
    return null;
  }

  // تبدیل تاریخ شمسی به میلادی
  const gregorian = toGregorian(year, month, day);

  // جدا کردن اجزای زمان
  const timeParts = timePart.split(':').map(Number);
  const hours = timeParts[0] || 0;
  const minutes = timeParts[1] || 0;
  const seconds = timeParts[2] || 0;

  // اعتبارسنجی زمان
  if (hours < 0 || hours > 23) {
    return null;
  }
  if (minutes < 0 || minutes > 59) {
    return null;
  }
  if (seconds < 0 || seconds > 59) {
    return null;
  }

  // ایجاد تاریخ میلادی با زمان
  return new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd, hours, minutes, seconds);
}

// فرمت تاریخ شمسی با نام ماه
export function formatPersianDate(date: Date): string {
  const jalali = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const monthNames = [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ];

  return `${jalali.jd} ${monthNames[jalali.jm - 1]} ${jalali.jy}`;
}

// بررسی اعتبار تاریخ شمسی
export function isValidPersianDate(year: number, month: number, day: number): boolean {
  return isValidJalaaliDate(year, month, day);
}

// گرفتن لیست روزهای ماه شمسی
export function getJalaliMonthDays(year: number, month: number): number[] {
  const daysCount = jalaaliMonthLength(year, month);
  return Array.from({ length: daysCount }, (_, i) => i + 1);
}

// ترکیب تاریخ و زمان
export function combineDateTime(date: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours || 0, minutes || 0, 0, 0);
  return newDate;
}
