/**
 * Seed script — restores the demo data that used to live in lib/data.ts,
 * plus the two login accounts (same PBKDF2 salt + hash, so existing
 * credentials keep working).
 *
 * Run: npm run db:seed  (idempotent — clears product tables, upserts the rest)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERS = [
  {
    id: 'usr_1',
    name: 'آرش محمدی',
    email: 'admin@mantine.dev',
    role: 'admin',
    salt: 'a0e14961bffc14ec33396dc5a8eb3042',
    passwordHash: '321573d869d4539cbccff6250f24e7378e2616543d5cec5310f483197d8cdd99',
  },
  {
    id: 'usr_2',
    name: 'سارا کریمی',
    email: 'user@mantine.dev',
    role: 'member',
    salt: 'a8cb50eb5e8fc0cb36e535d356128d88',
    passwordHash: 'c1f18dbb66ad0da9617b6ae059203a5bd957d669713635c329f3a1d41f7c5b5a',
  },
];

const ORDERS = [
  ['ORD-72411', 'مریم رضایی', '۱۴۰۳/۱۲/۲۴', 4_850_000, 'paid', 'موبایل و تبلت', 'اسفند'],
  ['ORD-72410', 'حسین نوری', '۱۴۰۳/۱۲/۲۴', 1_290_000, 'shipped', 'لوازم خانگی', 'اسفند'],
  ['ORD-72409', 'زهرا احمدی', '۱۴۰۳/۱۲/۲۳', 9_640_000, 'paid', 'موبایل و تبلت', 'اسفند'],
  ['ORD-72408', 'محمد صادقی', '۱۴۰۳/۱۲/۲۳', 720_000, 'pending', 'کتاب و لوازم‌التحریر', 'اسفند'],
  ['ORD-72407', 'نگار تهرانی', '۱۴۰۳/۱۲/۲۲', 3_310_000, 'paid', 'پوشاک', 'اسفند'],
  ['ORD-72406', 'علی مرادی', '۱۴۰۳/۱۲/۲۲', 2_150_000, 'cancelled', 'ورزش و سفر', 'اسفند'],
  ['ORD-72405', 'فاطمه یوسفی', '۱۴۰۳/۱۲/۲۱', 6_780_000, 'shipped', 'لوازم خانگی', 'بهمن'],
  ['ORD-72404', 'رضا کاظمی', '۱۴۰۳/۱۲/۲۱', 1_040_000, 'paid', 'پوشاک', 'بهمن'],
  ['ORD-72403', 'سمیرا بهرامی', '۱۴۰۳/۱۲/۲۰', 5_220_000, 'pending', 'موبایل و تبلت', 'بهمن'],
  ['ORD-72402', 'امیر قاسمی', '۱۴۰۳/۱۲/۲۰', 8_910_000, 'paid', 'ورزش و سفر', 'بهمن'],
] as const;

type SeedVariant = { name: string; sku?: string; price?: number; qty: number };
type SeedProduct = {
  name: string;
  slug: string;
  price: number;
  qty: number;
  isVisible: boolean;
  props: { key: string; value: string }[];
  variants: SeedVariant[];
  images: { path: string; sortOrder: number }[];
};

const PRODUCTS: SeedProduct[] = [
  {
    name: 'گوشی هوشمند آلفا ۱۲۸ گیگابایت',
    slug: 'alpha-phone-128',
    price: 48_500_000,
    qty: 12,
    isVisible: true,
    props: [
      { key: 'رنگ', value: 'مشکی' },
      { key: 'گارانتی', value: '۱۸ ماهه' },
    ],
    variants: [
      { name: 'رنگ مشکی / ۱۲۸GB', sku: 'ALP-128-BLK', price: 48_500_000, qty: 7 },
      { name: 'رنگ نقره‌ای / ۱۲۸GB', sku: 'ALP-128-SLV', price: 48_900_000, qty: 5 },
    ],
    images: [{ path: 'uploads/seed-phone.svg', sortOrder: 0 }],
  },
  {
    name: 'لپ‌تاپ بتا ۱۵ اینچ',
    slug: 'beta-laptop-15',
    price: 92_000_000,
    qty: 4,
    isVisible: true,
    props: [
      { key: 'پردازنده', value: '۸ هسته‌ای' },
      { key: 'حافظه', value: '۱۶GB / ۵۱۲GB SSD' },
    ],
    variants: [
      { name: '۱۶GB رم', sku: 'BET-15-16', qty: 3 },
      { name: '۳۲GB رم', sku: 'BET-15-32', price: 109_000_000, qty: 1 },
    ],
    images: [{ path: 'uploads/seed-laptop.svg', sortOrder: 0 }],
  },
  {
    name: 'هدفون بی‌سیم گاما',
    slug: 'gamma-headphones',
    price: 3_200_000,
    qty: 45,
    isVisible: true,
    props: [
      { key: 'اتصال', value: 'بلوتوث ۵٫۳' },
      { key: 'زمان پخش', value: '۳۰ ساعت' },
    ],
    variants: [
      { name: 'رنگ سفید', sku: 'GAM-WHT', qty: 20 },
      { name: 'رنگ مشکی', sku: 'GAM-BLK', qty: 25 },
    ],
    images: [{ path: 'uploads/seed-headphones.svg', sortOrder: 0 }],
  },
  {
    name: 'ساعت هوشمند دلتا',
    slug: 'delta-watch',
    price: 15_700_000,
    qty: 9,
    isVisible: true,
    props: [{ key: 'مقاومت', value: 'ضدآب ۵۰ متر' }],
    variants: [{ name: 'بدنه ۴۴mm', sku: 'DEL-44', qty: 9 }],
    images: [{ path: 'uploads/seed-watch.svg', sortOrder: 0 }],
  },
  {
    name: 'پایه شارژ بی‌سیم اپسیلون',
    slug: 'epsilon-charger',
    price: 1_450_000,
    qty: 0,
    isVisible: false,
    props: [{ key: 'توان', value: '۱۵ وات' }],
    variants: [],
    images: [],
  },
  {
    name: 'کیف چرمی زتا برای گوشی',
    slug: 'zeta-case',
    price: 890_000,
    qty: 60,
    isVisible: true,
    props: [{ key: 'جنس', value: 'چرم طبیعی' }],
    variants: [
      { name: 'سایز کوچک', sku: 'ZET-S', qty: 30 },
      { name: 'سایز بزرگ', sku: 'ZET-L', qty: 30 },
    ],
    images: [],
  },
];

/** Simple placeholder SVGs so seeded products have real thumbnails. */
const SEED_IMAGES: Record<string, string> = {
  'seed-phone.svg': '#4c6ef5',
  'seed-laptop.svg': '#12b886',
  'seed-headphones.svg': '#e8590c',
  'seed-watch.svg': '#ae3ec9',
};

async function seedImages(): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = path.resolve(process.cwd(), 'data', 'uploads');

  await mkdir(dir, { recursive: true });

  for (const [name, color] of Object.entries(SEED_IMAGES)) {
    const label = name.replace('seed-', '').replace('.svg', '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="${color}"/>
  <text x="160" y="172" font-size="72" fill="#ffffff" text-anchor="middle" font-family="Tahoma">${label}</text>
</svg>`;
    await writeFile(path.join(dir, name), svg, 'utf8');
  }
}

/**
 * Built-in roles referenced by code — upserted so the roles page is never
 * empty. The demo finance roles show the permission model from the user's
 * example: کارمند حسابداری (accounting + payments, read-only), کارمند مالی
 * (coupons + price-updates with write actions) and مدیر مالی (all four
 * finance menus). A bare href is a view grant; `href:edit` / `href:add`
 * carry the write actions.
 */
type RoleDef = {
  name: string;
  title: string;
  isAdmin: boolean;
  /** JSON-encoded permission-entry list (Role.permissions column). */
  permissions: string;
};

const ROLE_DEFS: RoleDef[] = [
  { name: 'admin', title: 'مدیر کل', isAdmin: true, permissions: '[]' },
  {
    name: 'member',
    title: 'کارمند',
    isAdmin: false,
    permissions: JSON.stringify([
      '/orders',
      '/customers',
      '/products',
      '/products:edit',
      '/products:add',
      '/settings/categories',
      '/settings/categories:edit',
      '/settings/categories:add',
    ]),
  },
  { name: 'customer', title: 'مشتری', isAdmin: false, permissions: '[]' },
  {
    name: 'support',
    title: 'پشتیبان سایت',
    isAdmin: false,
    // The supporter answers tickets, so they get the customer FILE without the
    // customer list: '/customers/file' opens /customers/[id] on its own, while
    // '/customers' would also hand them the whole customer table and its
    // wallet/block controls.
    permissions: JSON.stringify(['/support', '/customers/file']),
  },
  {
    name: 'finance_accountant',
    title: 'کارمند حسابداری',
    isAdmin: false,
    permissions: JSON.stringify(['/accounting', '/payments']),
  },
  {
    name: 'finance_officer',
    title: 'کارمند مالی',
    isAdmin: false,
    permissions: JSON.stringify(['/coupons', '/price-updates']),
  },
  {
    name: 'finance_manager',
    title: 'مدیر مالی',
    isAdmin: false,
    permissions: JSON.stringify(['/coupons', '/accounting', '/payments', '/price-updates']),
  },
];

async function main(): Promise<void> {
  console.log('Seeding roles…');
  // Upserts only touch title/isAdmin on update, so admin-edited permissions
  // survive a re-seed.
  for (const role of ROLE_DEFS) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: {
        name: role.name,
        title: role.title,
        isAdmin: role.isAdmin,
        permissions: role.permissions,
      },
      update: { title: role.title, isAdmin: role.isAdmin },
    });
  }

  console.log('Seeding users…');
  for (const user of USERS) {
    await prisma.user.upsert({ where: { id: user.id }, create: user, update: user });
  }

  console.log('Seeding orders…');
  await prisma.order.deleteMany();
  for (const [displayId, customer, date, amount, status, category, month] of ORDERS) {
    await prisma.order.create({
      data: { displayId, customer, date, amount, status, category, month },
    });
  }

  console.log('Seeding products…');
  // Products are wiped and re-created: cascades clear variants/images rows.
  await prisma.product.deleteMany();
  for (const product of PRODUCTS) {
    await prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        price: product.price,
        qty: product.qty,
        isVisible: product.isVisible,
        props: JSON.stringify(product.props),
        variants: { create: product.variants },
        images: { create: product.images },
      },
    });
  }

  await seedImages();
  console.log(
    `Seeded ${ROLE_DEFS.length} roles, ${USERS.length} users, ${ORDERS.length} orders, ${PRODUCTS.length} products.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
