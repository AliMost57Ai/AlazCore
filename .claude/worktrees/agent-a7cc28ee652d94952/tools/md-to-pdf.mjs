/**
 * Markdown → HTML → PDF for the project manual.
 *
 * Chrome's headless `--print-to-pdf` is the whole reason this exists: Persian
 * needs real Arabic-script shaping and bidi, which the usual PDF libraries
 * (pdfkit, pdfmake, …) get wrong, while a browser gets it right for free.
 *
 * The Markdown subset below is exactly what the manual uses — no dependency is
 * worth installing for headings, lists, tables, fenced code and inline spans.
 *
 * Usage: node tools/md-to-pdf.mjs <input.md> <output-basename>
 *   writes <output-basename>.html and <output-basename>.pdf
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

/**
 * A list-item marker: a bullet, or a number followed by a dot. The number may
 * be ASCII or Persian — this manual numbers its lists in Persian digits.
 */
const LIST_MARKER = /^\s*(?:[-*]|[0-9۰-۹]+\.)\s+/;
const ORDERED_MARKER = /^\s*[0-9۰-۹]+\.\s+/;

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline spans: code, bold, links. Code first so its contents stay literal. */
function inline(text) {  const codes = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = escapeHtml(out);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${escapeHtml(codes[Number(index)])}</code>`);
  return out;
}

/** Splits a table row on unescaped pipes. */
function cells(row) {
  return row
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function render(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (/^\s*$/.test(line)) {
      index += 1;
      continue;
    }

    // Fenced code
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const body = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const id = heading[2]
        .replace(/[`*«»]/g, '')
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/g, '');
      html.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      html.push('<hr />');
      index += 1;
      continue;
    }

    // Table: a header row whose next line is the ---|--- separator
    if (line.includes('|') && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1] ?? '')) {
      const header = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      html.push('<table>');
      html.push(
        `<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`
      );
      html.push('<tbody>');
      for (const row of rows) {
        html.push(`<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      }
      html.push('</tbody></table>');
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const body = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
      continue;
    }

    // Lists — `-` for bullets, `1.` for ordered; two-space indent nests one level.
    // `[0-9۰-۹]` accepts Persian digits too (۱. ۲. ۳.), which is what
    // this manual actually writes — ASCII-only `\d` silently turned every
    // Persian numbered list into one run-on paragraph.
    if (LIST_MARKER.test(line)) {
      const ordered = ORDERED_MARKER.test(line);
      const items = [];
      while (index < lines.length && LIST_MARKER.test(lines[index])) {
        const nested = /^\s{2,}[-*]\s+/.test(lines[index]);
        const text = lines[index].replace(LIST_MARKER, '');
        if (nested && items.length > 0) {
          items[items.length - 1].children.push(text);
        } else {
          items.push({ text, children: [] });
        }
        index += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      const body = items
        .map((item) => {
          const children =
            item.children.length > 0
              ? `<ul>${item.children.map((child) => `<li>${inline(child)}</li>`).join('')}</ul>`
              : '';
          return `<li>${inline(item.text)}${children}</li>`;
        })
        .join('');
      html.push(`<${tag}>${body}</${tag}>`);
      continue;
    }

    // Paragraph — consecutive plain lines join into one.
    const paragraph = [];
    while (
      index < lines.length &&
      !/^\s*$/.test(lines[index]) &&
      !/^(#{1,6}\s|```|>|\s*([-*]|\d+\.)\s|\s*---+\s*$)/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return html.join('\n');
}

const TEMPLATE = (title, body) => `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root { --ink: #1a1b1e; --muted: #5c5f66; --line: #dee2e6; --tint: #f8f9fa; --accent: #1971c2; }
  * { box-sizing: border-box; }
  body {
    font-family: Vazirmatn, IRANSansX, IRANSans, "Segoe UI", Tahoma, system-ui, sans-serif;
    color: var(--ink); line-height: 1.9; font-size: 11pt; margin: 0;
    padding: 24px 30px; direction: rtl; text-align: right;
  }
  h1 { font-size: 21pt; margin: 0 0 4px; }
  h2 { font-size: 16pt; margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); page-break-after: avoid; }
  h3 { font-size: 13pt; margin: 22px 0 8px; color: var(--accent); page-break-after: avoid; }
  h4 { font-size: 11.5pt; margin: 18px 0 6px; page-break-after: avoid; }
  p, li { text-align: justify; }
  ul, ol { padding-inline-start: 22px; margin: 6px 0 10px; }
  li { margin-bottom: 3px; }
  li > ul { margin: 3px 0; }
  code {
    font-family: ui-monospace, Consolas, monospace; font-size: 0.86em; direction: ltr;
    unicode-bidi: embed; background: var(--tint); border: 1px solid var(--line);
    border-radius: 4px; padding: 1px 5px; display: inline-block;
  }
  pre {
    background: var(--tint); border: 1px solid var(--line); border-radius: 6px;
    padding: 10px 12px; direction: ltr; text-align: left; overflow-wrap: anywhere;
    white-space: pre-wrap; page-break-inside: avoid;
  }
  pre code { background: none; border: 0; padding: 0; font-size: 9.5pt; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; font-size: 10pt; page-break-inside: auto; }
  th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: right; vertical-align: top; }
  th { background: var(--tint); font-weight: 600; }
  tr { page-break-inside: avoid; }
  blockquote { margin: 10px 0; padding: 8px 14px; border-inline-start: 4px solid var(--accent); background: var(--tint); }
  blockquote p { margin: 0; }
  a { color: var(--accent); text-decoration: none; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 26px 0; }
  h1 + p, h1 + blockquote { color: var(--muted); }
</style>
</head>
<body>
${body}
</body>
</html>
`;

const [, , input, outputBase] = process.argv;
if (!input || !outputBase) {
  console.error('usage: node tools/md-to-pdf.mjs <input.md> <output-basename>');
  process.exit(1);
}

const markdown = readFileSync(input, 'utf8');
const title = (markdown.match(/^#\s+(.*)$/m)?.[1] ?? 'manual').trim();
const html = TEMPLATE(title, render(markdown));

const htmlPath = resolve(`${outputBase}.html`);
const pdfPath = resolve(`${outputBase}.pdf`);
mkdirSync(dirname(htmlPath), { recursive: true });
writeFileSync(htmlPath, html, 'utf8');
console.log(`html → ${htmlPath}`);

const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chrome) {
  console.error('no Chrome/Edge found — HTML written, PDF skipped');
  process.exit(2);
}

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=12000',
    `--print-to-pdf=${pdfPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 }
);

if (!existsSync(pdfPath)) {
  console.error(result.stderr?.toString().slice(0, 2000) ?? 'chrome produced no PDF');
  process.exit(3);
}
console.log(`pdf  → ${pdfPath}`);
