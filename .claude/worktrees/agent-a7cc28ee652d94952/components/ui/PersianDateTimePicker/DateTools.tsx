// utils/persianCalendar.ts
import {
  isLeapJalaaliYear,
  isValidJalaaliDate,
  jalaaliMonthLength,
  toGregorian as jalaliToGregorian,
  toJalaali,
} from 'jalaali-js';

// نام‌های متفاوت برای جلوگیری از تداخل
export interface PersianDate {
  year: number;
  month: number;
  day: number;
}

export interface WesternDate {
  year: number;
  month: number;
  day: number;
}

// تبدیل تاریخ میلادی به شمسی
export function toPersian(date: Date): PersianDate {
  const jalali = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return {
    year: jalali.jy,
    month: jalali.jm,
    day: jalali.jd,
  };
}

// تبدیل تاریخ شمسی به میلادی
export function toWestern(persian: PersianDate): Date {
  const gregorian = jalaliToGregorian(persian.year, persian.month, persian.day);
  return new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
}

// نام ماه‌های شمسی
export const persianMonths = [
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

// نام روزهای هفته
export const persianWeekDays = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

// نام کوتاه روزهای هفته (با جمعه به عنوان آخرین روز)
export const shortWeekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// گرفتن تاریخ امروز به شمسی
export function getTodayPersian(): PersianDate {
  return toPersian(new Date());
}

// محاسبه روز هفته برای تاریخ شمسی (شنبه = 0، جمعه = 6)
export function getPersianWeekDay(persian: PersianDate): number {
  const date = toWestern(persian);
  const day = date.getDay(); // 0: Sunday, 1: Monday, ...

  // تبدیل به سیستم ایرانی:
  // Sunday (0) -> 1 (یکشنبه)
  // Monday (1) -> 2 (دوشنبه)
  // Tuesday (2) -> 3 (سه‌شنبه)
  // Wednesday (3) -> 4 (چهارشنبه)
  // Thursday (4) -> 5 (پنجشنبه)
  // Friday (5) -> 6 (جمعه)
  // Saturday (6) -> 0 (شنبه)

  return (day + 1) % 7;
}

// محاسبه اولین روز هفته ماه شمسی
export function getFirstDayOfMonth(persian: PersianDate): number {
  const firstDayDate = toWestern({ ...persian, day: 1 });
  const day = firstDayDate.getDay();
  // تبدیل به سیستم ایرانی
  return (day + 1) % 7;
}

// تولید آرایه روزهای یک ماه شمسی
export function getMonthDays(persian: PersianDate): number[] {
  const daysCount = jalaaliMonthLength(persian.year, persian.month);
  return Array.from({ length: daysCount }, (_, i) => i + 1);
}
// فرمت‌های مختلف تاریخ
export function formatPersianDate(
  date: Date | null,
  format: 'full' | 'short' | 'numeric' = 'full'
): string {
  if (!date) {
    return '';
  }

  const persian = toPersian(date);

  switch (format) {
    case 'short':
      return `${persian.day} ${persianMonths[persian.month - 1].slice(0, 3)} ${persian.year}`;

    case 'numeric':
      return `${persian.year}/${persian.month.toString().padStart(2, '0')}/${persian.day.toString().padStart(2, '0')}`;

    case 'full':
    default: {
      // Braced on purpose: a bare `const` in a switch case is a lint error
      // (no-case-declarations) and hoists into the other branches' scope.
      const weekDay = getPersianWeekDay(persian);
      return `${persianWeekDays[weekDay]} ${persian.day} ${persianMonths[persian.month - 1]} ${persian.year}`;
    }
  }
}

// بررسی آیا تاریخ امروز است
export function isTodayPersian(persian: PersianDate): boolean {
  const today = getTodayPersian();
  return persian.year === today.year && persian.month === today.month && persian.day === today.day;
}

// بررسی آیا روز جمعه است
export function isFridayPersian(persian: PersianDate): boolean {
  const weekDay = getPersianWeekDay(persian);
  return weekDay === 6; // جمعه روز ششم در سیستم ایرانی
}

// بررسی سال کبیسه شمسی
export function isLeapPersianYear(year: number): boolean {
  return isLeapJalaaliYear(year);
}

// اعتبارسنجی تاریخ شمسی
export function isValidPersianDate(year: number, month: number, day: number): boolean {
  return isValidJalaaliDate(year, month, day);
}

// اضافه کردن روز به تاریخ شمسی
export function addDaysToPersian(persian: PersianDate, days: number): PersianDate {
  const date = toWestern(persian);
  const newDate = new Date(date);
  newDate.setDate(date.getDate() + days);
  return toPersian(newDate);
}

// اضافه کردن ماه به تاریخ شمسی
export function addMonthsToPersian(persian: PersianDate, months: number): PersianDate {
  let newYear = persian.year;
  let newMonth = persian.month + months;

  while (newMonth > 12) {
    newMonth -= 12;
    newYear += 1;
  }

  while (newMonth < 1) {
    newMonth += 12;
    newYear -= 1;
  }

  // اطمینان از معتبر بودن روز
  const maxDays = jalaaliMonthLength(newYear, newMonth);
  const newDay = Math.min(persian.day, maxDays);

  return { year: newYear, month: newMonth, day: newDay };
}

// تولید سال‌های قابل انتخاب
export function generatePersianYears(startOffset: number = 100, endOffset: number = 10): number[] {
  const currentYear = getTodayPersian().year;
  const years = [];
  for (let i = currentYear - startOffset; i <= currentYear + endOffset; i++) {
    years.push(i);
  }
  return years;
}

// utils/persianCalendar.ts - توابع جدید اضافه شده

// ... کدهای قبلی ...

// گرفتن روزهای ماه قبل برای تکمیل تقویم
export function getPreviousMonthDays(persian: PersianDate): PersianDate[] {
  const prevMonth = addMonthsToPersian(persian, -1);
  const daysInPrevMonth = getMonthDays(prevMonth);

  return daysInPrevMonth.map((day) => ({
    year: prevMonth.year,
    month: prevMonth.month,
    day,
  }));
}

// گرفتن روزهای ماه بعد برای تکمیل تقویم
export function getNextMonthDays(persian: PersianDate): PersianDate[] {
  const nextMonth = addMonthsToPersian(persian, 1);
  const daysInNextMonth = getMonthDays(nextMonth);

  return daysInNextMonth.map((day) => ({
    year: nextMonth.year,
    month: nextMonth.month,
    day,
  }));
}

// تولید تقویم کامل ۶×۷
export function getFullCalendar(persian: PersianDate): {
  date: PersianDate;
  isCurrentMonth: boolean;
  isPreviousMonth: boolean;
  isNextMonth: boolean;
}[] {
  const currentMonthDays = getMonthDays(persian);
  const firstDayOfMonth = getFirstDayOfMonth(persian);

  // روزهای ماه قبل
  const previousMonth = addMonthsToPersian(persian, -1);
  const previousMonthDays = getMonthDays(previousMonth);
  const previousMonthDates: PersianDate[] = [];

  // تعداد روزهای ماه قبل که باید نمایش داده شوند
  const daysFromPrevMonth = firstDayOfMonth;
  for (let i = previousMonthDays.length - daysFromPrevMonth; i < previousMonthDays.length; i++) {
    previousMonthDates.push({
      year: previousMonth.year,
      month: previousMonth.month,
      day: previousMonthDays[i],
    });
  }

  // روزهای ماه جاری
  const currentMonthDates: PersianDate[] = currentMonthDays.map((day) => ({
    year: persian.year,
    month: persian.month,
    day,
  }));

  // روزهای ماه بعد
  const nextMonth = addMonthsToPersian(persian, 1);
  const nextMonthDates: PersianDate[] = [];

  // محاسبه کل خانه‌های مورد نیاز
  const totalCells = 42; // 6 هفته × 7 روز
  const remainingCells = totalCells - (previousMonthDates.length + currentMonthDates.length);

  for (let i = 1; i <= remainingCells; i++) {
    nextMonthDates.push({
      year: nextMonth.year,
      month: nextMonth.month,
      day: i,
    });
  }

  // ترکیب همه تاریخ‌ها
  const allDates = [
    ...previousMonthDates.map((date) => ({
      date,
      isCurrentMonth: false,
      isPreviousMonth: true,
      isNextMonth: false,
    })),
    ...currentMonthDates.map((date) => ({
      date,
      isCurrentMonth: true,
      isPreviousMonth: false,
      isNextMonth: false,
    })),
    ...nextMonthDates.map((date) => ({
      date,
      isCurrentMonth: false,
      isPreviousMonth: false,
      isNextMonth: true,
    })),
  ];

  return allDates;
}

// بررسی آیا تاریخ در بازه ماه جاری است
export function isDateInRange(date: PersianDate, start: PersianDate, end: PersianDate): boolean {
  const dateNumber = date.year * 10000 + date.month * 100 + date.day;
  const startNumber = start.year * 10000 + start.month * 100 + start.day;
  const endNumber = end.year * 10000 + end.month * 100 + end.day;

  return dateNumber >= startNumber && dateNumber <= endNumber;
}
