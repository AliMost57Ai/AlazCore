/** راستی‌آزمایی فایل گزارش — باز کردن و شمارش شیت‌ها/ردیف‌ها. */

import ExcelJS from 'exceljs';

const wb = new ExcelJS.Workbook();
wb.xlsx
  .readFile('AlazCore-Task-Report.xlsx')
  .then(() => {
    console.log('sheets:', wb.worksheets.map((w) => `${w.name}(${w.rowCount}r)`).join(' | '));
  })
  .catch((e) => {
    console.error('FAIL', e.message);
    process.exit(1);
  });
