// types/jalaali-js.d.ts
declare module 'jalaali-js' {
  export interface JalaaliDate {
    jy: number; // سال شمسی
    jm: number; // ماه شمسی
    jd: number; // روز شمسی
  }

  export interface GregorianDate {
    gy: number; // سال میلادی
    gm: number; // ماه میلادی
    gd: number; // روز میلادی
  }

  /**
   * تبدیل تاریخ میلادی به شمسی
   */
  export function toJalaali(gy: number, gm: number, gd: number): JalaaliDate;

  /**
   * تبدیل تاریخ شمسی به میلادی
   */
  export function toGregorian(jy: number, jm: number, jd: number): GregorianDate;

  /**
   * بررسی اعتبار تاریخ شمسی
   */
  export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean;

  /**
   * تعداد روزهای ماه شمسی
   */
  export function jalaaliMonthLength(jy: number, jm: number): number;

  /**
   * تبدیل تاریخ میلادی به شمسی (ورودی Date)
   */
  export function toJalaaliDate(date: Date): JalaaliDate;

  /**
   * تبدیل تاریخ شمسی به میلادی (خروجی Date)
   */
  export function toGregorianDate(jy: number, jm: number, jd: number): Date;

  /**
   * محاسبه سال کبیسه شمسی
   */
  export function isLeapJalaaliYear(jy: number): boolean;

  /**
   * محاسبه روز سال شمسی
   */
  export function jalaaliToJulianDay(jy: number, jm: number, jd: number): number;

  /**
   * تبدیل روز جولیان به تاریخ شمسی
   */
  export function julianDayToJalaali(julianDay: number): JalaaliDate;

  /**
   * گرفتن تاریخ امروز به شمسی
   */
  export function currentJalaaliDate(): JalaaliDate;

  /**
   * اضافه کردن روز به تاریخ شمسی
   */
  export function addDaysToJalaali(jy: number, jm: number, jd: number, days: number): JalaaliDate;

  /**
   * تفاوت بین دو تاریخ شمسی
   */
  export function jalaaliDateDiff(date1: JalaaliDate, date2: JalaaliDate): number;

  export function toJalaali(gy: number, gm: number, gd: number): JalaaliDate;
  export function toGregorian(jy: number, jm: number, jd: number): GregorianDate;
  export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean;
  export function jalaaliMonthLength(jy: number, jm: number): number;

  export function isLeapJalaaliYear(jy: number): boolean;
  export function jalaliToJulianDay(jy: number, jm: number, jd: number): number;
  export function julianDayToJalaali(jd: number): JalaaliDate;

  export default {
    toJalaali,
    toGregorian,
    isValidJalaaliDate,
    jalaaliMonthLength,
    toJalaaliDate,
    toGregorianDate,
    isLeapJalaaliYear,
    jalaaliToJulianDay,
    julianDayToJalaali,
    currentJalaaliDate,
    addDaysToJalaali,
    jalaaliDateDiff,
  };
}
