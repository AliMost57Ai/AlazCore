/**
 * تولید سند رسمی گزارشات مالک (xlsx) — همان الگوی lib/xlsx-export.ts؛
 * شیت RTL با ردیف عنوان سند. ریشه‌ی داده دیتابیس همین سایت است.
 */

import ExcelJS from 'exceljs';

function setupSheet(sheet: ExcelJS.Worksheet, headers: string[]): void {
  sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 2 }];
  const titleRow = sheet.addRow([]);
  titleRow.height = 6;
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, size: 12 };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A34' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

function styleBody(sheet: ExcelJS.Worksheet, fromRow: number): void {
  for (let i = fromRow; i <= sheet.rowCount; i += 1) {
    sheet.getRow(i).eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'hair' },
        left: { style: 'hair' },
        bottom: { style: 'hair' },
        right: { style: 'hair' },
      };
    });
    if ((i - fromRow) % 2 === 1) {
      sheet.getRow(i).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7F8' } };
      });
    }
  }
}

function metaRows(
  sheet: ExcelJS.Worksheet,
  title: string,
  filters: { from?: string; to?: string; productName?: string }
): void {
  const parts: string[] = [title];
  if (filters.from || filters.to) {
    parts.push(`بازه: ${filters.from ?? '…'} تا ${filters.to ?? '…'}`);
  }
  if (filters.productName) {
    parts.push(`کالا: ${filters.productName}`);
  }
  sheet.addRow([parts.join('  |  ')]);
  sheet.getRow(sheet.rowCount).font = { bold: true, size: 12 };
  sheet.mergeCells(sheet.rowCount, 1, sheet.rowCount, 8);
  sheet.addRow([
    `تاریخ تولید: ${new Date().toLocaleDateString('fa-IR-u-ca-persian')} — فروشگاه‌ساز AlazCore`,
  ]);
  sheet.getRow(sheet.rowCount).font = { size: 10, color: { argb: 'FF6B7B84' } };
  sheet.mergeCells(sheet.rowCount, 1, sheet.rowCount, 8);
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function ownerProductsWorkbook(
  rows: { productCount: number; sample: string[] },
  filters: { from?: string; to?: string; productName?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('محصولات');
  metaRows(sheet, 'گزارش محصولات تعریف‌شده', { ...filters });
  setupSheet(sheet, ['تعداد محصولات', 'نمونه محصولات']);
  sheet.addRow([rows.productCount, rows.sample.join('، ') || '—']);
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 80;
  return toBuffer(workbook);
}

export async function ownerProductSalesWorkbook(
  rows: { items: { name: string; qty: number; revenue: number }[]; total: number },
  filters: { from?: string; to?: string; productName?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('فروش هر کالا');
  metaRows(sheet, 'گزارش فروش هر کالا', { ...filters });
  setupSheet(sheet, ['کالا', 'تعداد فروش', 'مبلغ فروش (تومان)']);
  for (const item of rows.items) {
    sheet.addRow([item.name, item.qty, item.revenue]);
  }
  sheet.addRow(['— جمع کل —', '', rows.total]).font = { bold: true };
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 42;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 20;
  return toBuffer(workbook);
}

export async function ownerMonthlySalesWorkbook(
  rows: { months: { month: string; orders: number; total: number }[]; total: number },
  filters: { from?: string; to?: string; productName?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('فروش ماهانه');
  metaRows(sheet, 'گزارش مجموع فروش ماهانه', { ...filters });
  setupSheet(sheet, ['ماه', 'تعداد سفارش', 'مبلغ فروش (تومان)']);
  for (const month of rows.months) {
    sheet.addRow([month.month, month.orders, month.total]);
  }
  sheet.addRow(['— جمع کل —', '', rows.total]).font = { bold: true };
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 20;
  return toBuffer(workbook);
}

export async function ownerRevenueWorkbook(
  rows: { totalSales: number; commissionPercent: number; commissionAmount: number },
  filters: { from?: string; to?: string; productName?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('کارمزد AlazCore');
  metaRows(sheet, 'گزارش کارمزد AlazCore', { ...filters });
  setupSheet(sheet, ['فروش (تومان)', 'درصد پورسانت', 'کارمزد AlazCore (تومان)']);
  sheet.addRow([rows.totalSales, rows.commissionPercent, rows.commissionAmount]);
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 24;
  return toBuffer(workbook);
}
