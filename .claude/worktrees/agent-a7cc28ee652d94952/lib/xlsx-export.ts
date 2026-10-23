/**
 * Server-side Excel (xlsx) generation for the dashboard export buttons,
 * powered by exceljs. The products sheet doubles as the price-import
 * template: rows with an empty «نوع» column update the product, rows with a
 * variant name update that variant (empty price cell = inherit product price).
 *
 * Server-only — imports lib/db types and exceljs; never shipped to the browser.
 */

import ExcelJS from 'exceljs';
import { STATUS_LABELS } from './order-status';
import type { Order } from './orders';
import type { ProductDTO } from './products';

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
