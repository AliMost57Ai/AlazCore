import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { requireApiMenu } from '@/lib/api-auth';
import { parseCsv } from '@/lib/csv';
import prisma from '@/lib/db';
import { fromFaDigits } from '@/lib/format';

interface PriceRow {
  slug: string;
  /** Empty = the product itself; otherwise a variant name of that product. */
  variantName: string;
  /** Null = inherit the product price (variant rows only). */
  price: number | null;
}

/**
 * Turns a raw price cell into a Toman integer, tolerating Persian digits and
 * thousands separators. Null when the cell is empty or not a valid number.
 */
function parsePriceCell(raw: unknown): number | null {
  const text = raw === null || raw === undefined ? '' : String(raw).trim();
  if (text === '') {
    return null;
  }
  const normalized = fromFaDigits(text).replace(/[٬,٫.\s]/g, '');
  if (normalized === '' || !/^\d+$/.test(normalized)) {
    return null;
  }
  const price = Number(normalized);
  return price >= 0 && price <= 2_000_000_000 ? price : null;
}

/** Extracts a cell's text, whether it came from xlsx or csv parsing. */
function cellText(raw: unknown): string {
  return raw === null || raw === undefined ? '' : String(raw).trim();
}

/** Parses an uploaded .xlsx (first sheet) into price rows. */
async function parseXlsx(file: File): Promise<PriceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  // Locate the columns by header text (شناسه محصول / نوع / قیمت).
  const header = sheet.getRow(1);
  let slugColumn = 1;
  let variantColumn = 2;
  let priceColumn = 4;
  header.eachCell((cell, columnNumber) => {
    const text = cellText(cell.text);
    if (text.includes('شناسه')) {
      slugColumn = columnNumber;
    } else if (text === 'نوع') {
      variantColumn = columnNumber;
    } else if (text.includes('قیمت')) {
      priceColumn = columnNumber;
    }
  });

  const rows: PriceRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    rows.push({
      slug: cellText(row.getCell(slugColumn).text),
      variantName: cellText(row.getCell(variantColumn).text),
      price: parsePriceCell(row.getCell(priceColumn).value),
    });
  });
  return rows;
}

/** Parses an uploaded .csv into price rows (same column layout as the xlsx). */
function parseCsvRows(text: string): PriceRow[] {
  const rows = parseCsv(text);
  const header = rows[0]?.map((cell) => cell.trim()) ?? [];
  const slugIndex = header.findIndex((cell) => cell.includes('شناسه'));
  const variantIndex = header.findIndex((cell) => cell === 'نوع');
  const priceIndex = header.findIndex((cell) => cell.includes('قیمت'));
  const hasHeader = slugIndex >= 0 && priceIndex >= 0;

  const slugColumn = hasHeader ? slugIndex : 0;
  const variantColumn = hasHeader && variantIndex >= 0 ? variantIndex : 1;
  const priceColumn = hasHeader ? priceIndex : 3;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => ({
    slug: cellText(row[slugColumn] ?? ''),
    variantName: cellText(row[variantColumn] ?? ''),
    price: parsePriceCell(row[priceColumn] ?? ''),
  }));
}

/**
 * Bulk price update from the exported Excel sheet — needs the
 * price-updates:edit grant. The upload is matched by product slug; the
 * «نوع» column selects the variant (empty row = the product itself). Unknown
 * slugs/variants are skipped and reported so a typo never loses the batch.
 */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/price-updates', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'فایل قیمت‌ها را انتخاب کنید.' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'حجم فایل نباید از ۵ مگابایت بیشتر باشد.' }, { status: 400 });
  }

  let rows: PriceRow[];
  try {
    rows = file.name.toLowerCase().endsWith('.csv')
      ? parseCsvRows(await file.text())
      : await parseXlsx(file);
  } catch {
    return NextResponse.json(
      { error: 'خواندن فایل ناموفق بود — فایل باید xlsx یا CSV باشد.' },
      { status: 400 }
    );
  }

  rows = rows.filter((row) => row.slug !== '');
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'هیچ ردیف معتبری در فایل نبود. ستون «شناسه محصول» را بررسی کنید.' },
      { status: 400 }
    );
  }
  if (rows.length > 1000) {
    return NextResponse.json(
      { error: 'حداکثر ۱۰۰۰ ردیف در هر بار وارد کردن مجاز است.' },
      { status: 400 }
    );
  }

  const skipped: string[] = [];
  let updated = 0;

  for (const row of rows) {
    const product = await prisma.product.findUnique({
      where: { slug: row.slug },
      include: { variants: true },
    });

    if (!product) {
      skipped.push(row.slug);
      continue;
    }

    if (row.variantName === '') {
      // Product row: the price is mandatory.
      if (row.price === null) {
        skipped.push(row.slug);
        continue;
      }
      await prisma.product.update({
        where: { id: product.id },
        data: { price: row.price },
      });
      updated += 1;
    } else {
      // Variant row: an empty price cell means "inherit the product price".
      const variant = product.variants.find((candidate) => candidate.name === row.variantName);
      if (!variant) {
        skipped.push(`${row.slug} / ${row.variantName}`);
        continue;
      }
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { price: row.price },
      });
      updated += 1;
    }
  }

  return NextResponse.json({ updated, skipped });
}
