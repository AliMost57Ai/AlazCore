/**
 * Server-side Excel (xlsx) generation for the dashboard export buttons,
 * powered by exceljs. The products sheet doubles as the price-import
 * template: rows with an empty «نوع» column update the product, rows with a
 * variant name update that variant (empty price cell = inherit product price).
 *
 * Server-only — imports lib/db types and exceljs; never shipped to the browser.
 */

import ExcelJS from 'exceljs';
import type { BrandDTO } from './brands';
import { faJalaliDate } from './format';
import type { FaqEntryDTO } from './faq';
import { STATUS_LABELS } from './order-status';
import type { Order } from './orders';
import type { ReturnListItem } from './product-returns';
import type { ProductDTO } from './products';
import {
  RETURN_METHOD_LABELS,
  RETURN_SHIPPING_PAYER_LABELS,
  RETURN_STATUS_LABELS,
} from './return-status';

/** Persian-friendly sheet defaults: RTL columns, frozen bold header. */
function setupSheet(sheet: ExcelJS.Worksheet, headers: string[]): void {
  sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };
  });
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function ordersWorkbook(orders: Order[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('سفارش‌ها');

  setupSheet(sheet, [
    'شناسه سفارش',
    'مشتری',
    'موبایل',
    'تاریخ',
    'مبلغ (تومان)',
    'وضعیت',
    'کد رهگیری',
  ]);

  for (const order of orders) {
    sheet.addRow([
      order.id,
      order.customer,
      order.phone ?? '',
      order.date,
      order.amount,
      STATUS_LABELS[order.status],
      order.trackingCode ?? '',
    ]);
  }

  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  return toBuffer(workbook);
}

/** برگشت خروجی اکسل لیست مرجوعی‌ها — همان فیلترهای صفحه پنل. */
export async function returnsWorkbook(rows: ReturnListItem[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('مرجوعی‌ها');

  setupSheet(sheet, [
    'کد مرجوعی',
    'سفارش',
    'مشتری',
    'تعداد اقلام',
    'مبلغ بازگشتی (تومان)',
    'روش برگشت',
    'پرداخت‌کننده ارسال برگشت',
    'وضعیت',
    'تاریخ ثبت',
  ]);

  for (const row of rows) {
    sheet.addRow([
      row.displayId,
      row.orderDisplayId,
      row.customerName,
      row.itemCount,
      row.refundItemsAmount,
      row.returnMethod ? RETURN_METHOD_LABELS[row.returnMethod] : '',
      row.shippingPayer ? RETURN_SHIPPING_PAYER_LABELS[row.shippingPayer] : '',
      RETURN_STATUS_LABELS[row.status],
      faJalaliDate(row.createdAt),
    ]);
  }

  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  return toBuffer(workbook);
}

export async function productsWorkbook(products: ProductDTO[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('محصولات');

  setupSheet(sheet, ['شناسه محصول', 'نوع', 'نام محصول', 'قیمت (تومان)', 'موجودی', 'نمایش']);

  for (const product of products) {
    sheet.addRow([
      product.slug,
      '',
      product.name,
      product.price,
      product.qty,
      product.isVisible ? 'نمایان' : 'پنهان',
    ]);

    for (const variant of product.variants) {
      // Empty price cell = the variant inherits the product price.
      sheet.addRow([
        product.slug,
        variant.name,
        `${product.name} — ${variant.name}`,
        variant.price ?? '',
        variant.qty,
        product.isVisible ? 'نمایان' : 'پنهان',
      ]);
    }
  }

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  return toBuffer(workbook);
}

/** خروجی اکسل لیست برندها — قاعده «هر لیست پنل = خروجی اکسل». */
export async function brandsWorkbook(brands: BrandDTO[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('برندها');

  setupSheet(sheet, ['نام برند', 'اسلاگ', 'تعداد محصول', 'وضعیت']);

  for (const brand of brands) {
    sheet.addRow([
      brand.name,
      brand.slug,
      brand.productCount,
      brand.isActive ? 'فعال' : 'غیرفعال',
    ]);
  }

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  return toBuffer(workbook);
}

/** خروجی اکسل سوالات متداول — قاعده «هر لیست پنل = خروجی اکسل». */
export async function faqWorkbook(entries: FaqEntryDTO[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('سوالات متداول');

  setupSheet(sheet, ['ترتیب', 'سوال', 'پاسخ', 'وضعیت']);

  for (const entry of entries) {
    sheet.addRow([
      entry.sortOrder,
      entry.question,
      entry.answer,
      entry.isActive ? 'فعال' : 'غیرفعال',
    ]);
  }

  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 60;
  sheet.getColumn(1).width = 10;
  sheet.getColumn(4).width = 12;

  return toBuffer(workbook);
}

/** ستون‌های آماده‌شده لیست‌های موجودی (لیست خرید، رو به اتمام، خالی‌فروشی). */
export async function stockListWorkbook(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  setupSheet(sheet, headers);

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  return toBuffer(workbook);
}
