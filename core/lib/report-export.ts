/**
 * تولید سند رسمی گزارشات (xlsx) با exceljs — همان الگوی lib/xlsx-export.ts
 * فروشگاه: شیت RTL، هدر بولد فریز، و ردیف عنوان سند (نام گزارش + دامنه‌ها +
 * بازه تاریخ) بالای جدول. خروجی هر گزارش یک Buffer دانلودی است.
 */

import ExcelJS from 'exceljs';
import type {
  SiteMonthlySales,
  SiteProductSales,
  SiteProductsReport,
  SiteRevenueRow,
} from './site-queries';

/** Persian-friendly sheet defaults: RTL columns, frozen bold header. */
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

function metaRows(sheet: ExcelJS.Worksheet, title: string, filters: Record<string, string | undefined>): void {
  const parts: string[] = [title];
  if (filters.domain) {
    parts.push(`دامنه: ${filters.domain}`);
  }
  if (filters.from || filters.to) {
    parts.push(`بازه: ${filters.from ?? '…'} تا ${filters.to ?? '…'}`);
  }
  if (filters.productName) {
    parts.push(`کالا: ${filters.productName}`);
  }
  sheet.addRow([parts.join('  |  ')]);
  sheet.getRow(sheet.rowCount).font = { bold: true, size: 12 };
  sheet.mergeCells(sheet.rowCount, 1, sheet.rowCount, 8);
  sheet.addRow([`تاریخ تولید: ${new Date().toLocaleDateString('fa-IR-u-ca-persian')} — سامانه AlazCore`]);
  sheet.getRow(sheet.rowCount).font = { size: 10, color: { argb: 'FF6B7B84' } };
  sheet.mergeCells(sheet.rowCount, 1, sheet.rowCount, 8);
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ExportMeta {
  from?: string;
  to?: string;
  productName?: string;
}

export async function productsWorkbook(rows: SiteProductsReport[], filters: ExportMeta): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('محصولات سایت‌ها');
  metaRows(sheet, 'گزارش محصولات تعریف‌شده هر سایت', { ...filters });
  setupSheet(sheet, ['دامنه سایت', 'تعداد محصولات', 'نمونه محصولات']);
  for (const row of rows) {
    sheet.addRow([row.domain, row.productCount, row.sample.join('، ') || '—']);
  }
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 70;
  return toBuffer(workbook);
}

export async function productSalesWorkbook(rows: SiteProductSales[], filters: ExportMeta): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('فروش هر کالا');
  metaRows(sheet, 'گزارش فروش هر کالا به تفکیک سایت', { ...filters });
  setupSheet(sheet, ['دامنه سایت', 'کالا', 'تعداد فروش', 'مبلغ فروش (تومان)']);
  for (const row of rows) {
    for (const item of row.items) {
      sheet.addRow([row.domain, item.name, item.qty, item.revenue]);
    }
    sheet.addRow([row.domain, '— جمع سایت —', '', row.total]).font = { bold: true };
  }
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 20;
  return toBuffer(workbook);
}

export async function monthlySalesWorkbook(
  rows: SiteMonthlySales[],
  filters: ExportMeta
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('فروش ماهانه');
  metaRows(sheet, 'گزارش مجموع فروش به تفکیک سایت در ماه', { ...filters });
  setupSheet(sheet, ['دامنه سایت', 'ماه', 'تعداد سفارش', 'مبلغ فروش (تومان)']);
  for (const row of rows) {
    for (const month of row.months) {
      sheet.addRow([row.domain, month.month, month.orders, month.total]);
    }
    sheet.addRow([row.domain, '— جمع سایت —', '', row.total]).font = { bold: true };
  }
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 20;
  return toBuffer(workbook);
}

export async function revenueWorkbook(rows: SiteRevenueRow[], filters: ExportMeta): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('درآمد آلازکور');
  metaRows(sheet, 'گزارش درآمد شرکت آلازکور', { ...filters });
  setupSheet(sheet, ['دامنه سایت', 'فروش (تومان)', 'درصد پورسانت', 'درآمد آلازکور (تومان)']);
  for (const row of rows) {
    sheet.addRow([row.domain, row.totalSales, row.commissionPercent, row.revenue]);
  }
  styleBody(sheet, 5);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 22;
  return toBuffer(workbook);
}
