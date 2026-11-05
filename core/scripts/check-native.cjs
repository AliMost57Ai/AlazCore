#!/usr/bin/env node
/**
 * بررسی سلامت ماژول بومی SQLite (better-sqlite3) پیش از اجرا — نسخه‌ی اپ Core.
 *
 * چرا این فایل هست: better-sqlite3 برای ABI همان نسخه‌ی Node کامپایل می‌شود
 * (NODE_MODULE_VERSION). اگر پنل با Node ۲۴ نصب شده باشد و با Node جدیدتر
 * (مثلاً ۲۶ = ABI 147) اجرا شود، Prisma هنگام اولین کوئری می‌شکند؛ نتیجه‌اش در
 * پنل همین است: لاگین ۵۰۰ می‌شود و فرم ورود پیام مبهم «خطای شبکه» نشان می‌دهد.
 * این چک آن اتفاق را به یک پیام روشن با راه‌حل تبدیل می‌کند.
 *
 * رفتار: محیط سالم = بی‌صدا؛ خطای ABI/بایندینگ = خروج با کد ۱؛ بقیه = هشدار.
 *
 * کپی هم‌سان scripts/check-native.cjs ریشه است (دو اپ مستقل‌اند).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const ABI = process.versions.modules;

/** نسخه‌ی Node پین‌شده در نزدیک‌ترین .nvmrc (ریشه‌ی مونوریپو). */
function readPinnedNode(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 6; depth += 1) {
    try {
      const text = fs.readFileSync(path.join(current, '.nvmrc'), 'utf8').trim();
      if (text) {
        return text;
      }
    } catch {
      // این پوشه .nvmrc ندارد — یک سطح بالاتر.
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

function main() {
  const base = path.resolve(process.cwd());
  const pinned = readPinnedNode(base);

  let appRequire = require;
  try {
    appRequire = createRequire(path.join(base, 'package.json'));
  } catch {
    // بدون package.json هم require عادی امتحان می‌شود.
  }

  let db = null;
  try {
    const Database = appRequire('better-sqlite3');
    db = new Database(':memory:');
    db.prepare('select 1 as ok').get();
    return; // سالم — بی‌صدا
  } catch (error) {
    const message = String((error && error.message) || error);
    const compiledAbi = /NODE_MODULE_VERSION (\d+)/.exec(message);
    const fatal =
      /NODE_MODULE_VERSION|different Node\.js version|Could not locate the bindings file|Cannot find module 'better-sqlite3'/.test(
        message
      );
    const log = fatal ? console.error : console.warn;

    log('');
    log('⚠  ماژول بومی SQLite (better-sqlite3) با نسخه‌ی Node فعلی کار نمی‌کند.');
    log(`   Node فعلی: ${process.version}  (ABI ${ABI})`);
    if (compiledAbi) {
      log(`   ماژول نصب‌شده برای ABI ${compiledAbi[1]} کامپایل شده است.`);
    }
    if (pinned) {
      log(`   نسخه‌ی پین‌شده‌ی پروژه (.nvmrc): ${pinned}`);
    }
    log('   راه‌حل:');
    log('     npm install better-sqlite3@^13.0.3   # نسخه‌ی N-API — روی Nodeهای ۲۲+ بدون rebuild');
    log('     npm install                          # یا نصب مجدد کامل از lockfile');
    log('     # اپ فروشگاه (ریشه‌ی ریپو) هم جدا همین را لازم دارد');
    if (pinned) {
      log(`   (جایگزین: ماندن روی Node پین‌شده — nvm use ${pinned} و npm ci)`);
    }
    log(`   خطای اصلی: ${message.split('\n')[0]}`);
    log('');

    if (db) {
      try {
        db.close();
      } catch {
        // اهمیتی ندارد؛ پروسه در حال خروج است.
      }
    }
    if (fatal) {
      process.exit(1);
    }
  }
}

main();
