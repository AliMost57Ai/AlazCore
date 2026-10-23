/**
 * CSV helpers for the dashboard export/import buttons.
 *
 * Client-safe on purpose (no imports beyond pure string work). Files are
 * UTF-8 with a BOM and CRLF line endings — that combination is what Excel
 * needs to open a CSV with Persian text correctly on Windows.
 */

/** Quotes a field when it contains a separator, quote or newline. */
function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Builds a CSV document (with BOM) from rows of cells. */
export function buildCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows
    .map((row) =>
      row
        .map((cell) => csvEscape(cell === null || cell === undefined ? '' : String(cell)))
        .join(',')
    )
    .join('\r\n');
  // U+FEFF BOM — written as an escape so it survives linting and diffs.
  return `\uFEFF${body}\r\n`;
}

/** Parses CSV text (BOM- and CRLF-tolerant, quoted-field aware) into rows. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Last field/row when the text doesn't end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

/** Triggers a browser download of the given CSV content. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
