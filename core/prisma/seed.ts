/**
 * Seed پنل Core — حساب superadmin، تم‌های پایه فروشگاه‌ساز، یک پلن نمونه و
 * یک دامین دمو (joghd.ir مطابق سناریوی واقعی).
 *
 * Run: npm run db:seed   (idempotent — upsert)
 */

import { createPrismaClient } from '../lib/prisma-adapter';
import { randomBytes } from 'node:crypto';
import { pbkdf2Sync } from 'node:crypto';

const prisma = createPrismaClient();

function makeCredentials(password: string) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
  return { salt, passwordHash };
}

async function main() {
  // ── نقش‌های سیستمی (هم‌سان نقش‌های فروشگاه) ──────────────────────────────
  await prisma.coreRole.upsert({
    where: { name: 'superadmin' },
    update: { isAdmin: true },
    create: { name: 'superadmin', title: 'مدیر کل', isAdmin: true, permissions: '[]' },
  });
  await prisma.coreRole.upsert({
    where: { name: 'support' },
    update: {},
    create: {
      name: 'support',
      title: 'پشتیبان',
      isAdmin: false,
      // پشتیبان پیش‌فرض: تیکت و مشاهده دامین‌ها
      permissions: JSON.stringify(['/panel/tickets', '/panel/tickets:edit', '/panel/domains']),
    },
  });

  // ── حساب‌ها ────────────────────────────────────────────────────────────────
  const admin = makeCredentials('admin1234');
  await prisma.coreUser.upsert({
    where: { email: 'admin@alazcore.ir' },
    update: {},
    create: {
      name: 'مدیر کل AlazCore',
      email: 'admin@alazcore.ir',
      role: 'superadmin',
      ...admin,
    },
  });

  const support = makeCredentials('support1234');
  await prisma.coreUser.upsert({
    where: { email: 'support@alazcore.ir' },
    update: {},
    create: {
      name: 'پشتیبان فروشگاه‌ها',
      email: 'support@alazcore.ir',
      role: 'support',
      ...support,
    },
  });

  // ── تم‌های پایه (هم‌نام با ThemeId فروشگاه) ────────────────────────────────
  const templates = [
    { key: 'beautyshop', name: 'بیوتی‌شاپ', description: 'تم لوکس فروشگاه‌های آرایشی و بهداشتی' },
    { key: 'digimarket', name: 'دیجی‌مارکت', description: 'تم بازارگاه چندمنظوره با منوی دسته‌بندی بزرگ' },
    { key: 'digishop', name: 'دیجی‌شاپ', description: 'تم کلاسیک فروشگاهی، سریع و ساده' },
    { key: 'softkala', name: 'سافت‌کالا', description: 'تم مینیمال کالای دیجیتال' },
  ];
  for (const [i, t] of templates.entries()) {
    await prisma.template.upsert({
      where: { key: t.key },
      update: {},
      create: { ...t, isDefault: i === 0 },
    });
  }

  // ── کاتالوگ درگاه‌ها و پنل‌های پیامکی ─────────────────────────────────────
  const GATEWAYS: [string, string, 'ipg' | 'bnpl'][] = [
    ['zarinpal', 'زرین‌پال', 'ipg'],
    ['digipay', 'دیجی‌پی', 'bnpl'],
    ['idpay', 'آی‌دی‌پی', 'ipg'],
    ['mellat', 'بانک ملت (به‌پرداخت)', 'ipg'],
    ['parsian', 'بانک پارسیان', 'ipg'],
    ['pasargad', 'بانک پاسارگاد', 'ipg'],
    ['sadad', 'بانک ملت (سداد)', 'ipg'],
    ['saman', 'بانک سامان (سپ)', 'ipg'],
    ['sepah', 'بانک سپه', 'ipg'],
    ['sizpay', 'سیزپی', 'ipg'],
    ['vibe', 'وایب', 'bnpl'],
    ['keepa', 'کیپا', 'bnpl'],
    ['fakher', 'فاخر', 'bnpl'],
    ['snapppay', 'اسنپ‌پی', 'bnpl'],
    ['tara', 'طرا', 'bnpl'],
    ['minipay', 'مینی‌پی', 'bnpl'],
  ];
  for (const [id, label, kind] of GATEWAYS) {
    await prisma.coreGateway.upsert({ where: { id }, update: { label, kind }, create: { id, label, kind } });
  }
  const SMS_PANELS: [string, string][] = [
    ['smsir', 'SMS.ir'],
    ['mediana', 'مدیانا'],
    ['melipayamak', 'ملی‌پیامک'],
    ['payamresan', 'پیام رسان'],
    ['farazsms', 'فراز اس‌ام‌اس'],
  ];
  for (const [id, label] of SMS_PANELS) {
    await prisma.coreSmsPanel.upsert({ where: { id }, update: { label }, create: { id, label } });
  }

  // ── پلن‌های نمونه ─────────────────────────────────────────────────────────
  const planAll = await prisma.plan.upsert({
    where: { id: 'plan_enterprise' },
    update: {},
    create: {
      id: 'plan_enterprise',
      name: 'سازمانی',
      description: 'دسترسی کامل به همه منوها، درگاه‌ها و پنل پیامکی نامحدود',
      menus: JSON.stringify(['*']),
      limits: JSON.stringify({ maxProducts: null }),
      durationDays: 365,
      priceMonthly: 4_900_000,
    },
  });
  await prisma.plan.upsert({
    where: { id: 'plan_starter' },
    update: {},
    create: {
      id: 'plan_starter',
      name: 'پایه',
      description: 'فروشگاه تازه‌کار — سفارش، محصول و کد تخفیف',
      menus: JSON.stringify(['/orders', '/customers', '/products', '/coupons', '/settings/theme', '/settings/site']),
      limits: JSON.stringify({ maxProducts: 100 }),
      durationDays: 365,
      priceMonthly: 990_000,
    },
  });

  // ── دامین دمو ─────────────────────────────────────────────────────────────
  const shopDomain = await prisma.domain.upsert({
    where: { domain: 'joghd.ir' },
    update: {},
    create: {
      domain: 'joghd.ir',
      ownerName: 'مدیریت جغد',
      ownerPhone: '09120000000',
      ownerEmail: 'owner@joghd.ir',
      techName: 'پشتیبانی فنی جغد',
      techPhone: '09120000001',
      techEmail: 'tech@joghd.ir',
      planId: planAll.id,
      isActive: true,
      commissionPercent: 10,
      notes: 'فروشگاه نمونه متصل به فروشگاه‌ساز AlazCore',
    },
  });
  await prisma.gatewayBinding.upsert({
    where: { domainId_gateway: { domainId: shopDomain.id, gateway: 'zarinpal' } },
    update: {},
    create: { domainId: shopDomain.id, gateway: 'zarinpal', kind: 'ipg', label: 'زرین‌پال' },
  });
  await prisma.smsBinding.upsert({
    where: { domainId_provider: { domainId: shopDomain.id, provider: 'smsir' } },
    update: {},
    create: { domainId: shopDomain.id, provider: 'smsir', label: 'SMS.ir' },
  });
  await prisma.ticket.create({
    data: {
      displayId: `TK-${String(10_000 + Math.floor(Math.random() * 90_000))}`,
      subject: 'فعال‌سازی درگاه اقساطی',
      domainId: shopDomain.id,
      requesterName: 'مدیریت جغد',
      lastMessageAuthor: 'tenant',
      messages: {
        create: [
          {
            authorSide: 'tenant',
            authorName: 'مدیریت جغد',
            body: 'سلام، برای فروشگاه joghd.ir درگاه اقساطی اسنپ‌پی لازم داریم. ممنون می‌شویم فعال کنید.',
          },
        ],
      },
    },
  });

  // ── کلید API اعتبارسنجی (اگر ENV نیست، یک بار بساز) ───────────────────────
  if (!process.env.CORE_API_KEY) {
    const existing = await prisma.coreSetting.findUnique({ where: { key: 'api_key' } });
    if (!existing) {
      await prisma.coreSetting.create({
        data: { key: 'api_key', value: `ak_${randomBytes(24).toString('hex')}` },
      });
    }
  }

  console.log('✓ Seed پنل Core کامل شد — admin@alazcore.ir / admin1234');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
