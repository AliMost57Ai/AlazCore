/**
 * PrismaClient — multi-tenant.
 *
 * هر دسترسی، کلاینتِ «سایت فعال» را resolve می‌کند:
 *  - fast path (sync): کانتکست سایت روی ALS نشسته → همان کلاینت، و مهم‌تر:
 *    **خروجی، promise واقعی خودِ پرایسماست** — تا `$transaction` آرایه‌ای که
 *    برند promise پرایسما را چک می‌کند کار کند (با promise زنجیره‌ای بی‌برند
 *    خطای «All elements of the array need to be Prisma Client promises»
 *    می‌دهد — باگ ذخیره محصول).
 *  - cold path: ensureSiteContext (هدرها/SHOP_DOMAIN) دامنه را resolve و
 *    می‌نشاند؛ فراخوانی‌های هم‌زمان روی یک promise dedupe می‌شوند.
 * بدون کانتکست (dev localhost، اسکریپت‌ها) → دیتابیس اصلی data/app.db.
 */

import { PrismaClient } from './generated/prisma/client';
import { ensureSiteContext } from './site-context';
import { clientForDomain, mainClient, SiteUnavailableError } from './site-db';
import { isProductionRuntime, siteFromContext } from './site-runtime';

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
};

const main = globalForDb.prisma ?? mainClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = main;
}

/**
 * کلاینت sync برای کانتکست فعلی — null یعنی هنوز resolve نشده/آماده نیست
 * (مسیر cold باید برود سراغ ensure).
 */
function activeClientSync(): PrismaClient | null {
  const domain = siteFromContext();
  if (!domain) {
    // بدون کانتکست — اگر ensure هم نتوانست دامنه‌ای پیدا کند main درست است؛
    // ولی اینجا هنوز resolve نشده، پس null تا cold path تصمیم بگیرد.
    return null;
  }
  return clientForDomain(domain);
}

function applyClientMethod(client: PrismaClient, prop: string, args: unknown[]): unknown {
  const fn = Reflect.get(client as unknown as object, prop) as unknown;
  return typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown).apply(client, args) : fn;
}

async function ensureAndClient(): Promise<PrismaClient> {
  // هر فراخوانی، resolve تازه‌ی همین درخواست — کش سراسری promise اینجا ممنوع:
  // «اولین دامنه برای همیشه» می‌شود و multi-tenancy مسیر cold می‌شکند
  // (باگ واقعی تست ورود shop2/joghd). ensureSiteContext خودش برای ALSِ
  // نشسته ارزان است و ensureSiteDb هم درخواست‌های موازی را dedupe می‌کند.
  const domain = await ensureSiteContext();
  if (domain) {
    const client = clientForDomain(domain);
    if (client) {
      return client;
    }
    if (isProductionRuntime()) {
      // fail-closed: در production هرگز به دیتابیس اصلی نمی‌افتیم — داده‌ی
      // سایت‌های دیگر (یا dev seed) از URL این سایت سرو نمی‌شود.
      throw new SiteUnavailableError(domain);
    }
  }
  return main;
}

/** Proxyهای مدل — یکی per model، تا prisma.user.findUnique دو سطحی کار کند. */
const modelProxies = new Map<string, object>();

function modelProxy(model: string): object {
  let proxy = modelProxies.get(model);
  if (!proxy) {
    proxy = new Proxy(
      {},
      {
        get(_t, method) {
          if (typeof method !== 'string') {
            return undefined;
          }
          return (...args: unknown[]) => {
            // fast path — promise واقعی پرایسما (برند‌دار برای $transaction).
            const client = activeClientSync();
            if (client) {
              const modelObj = Reflect.get(client as unknown as object, model) as object;
              const fn = Reflect.get(modelObj, method) as unknown;
              if (typeof fn === 'function') {
                return (fn as (...a: unknown[]) => unknown).apply(modelObj, args);
              }
              return fn;
            }
            return ensureAndClient().then((client) => {
              const modelObj = Reflect.get(client as unknown as object, model) as object;
              const fn = Reflect.get(modelObj, method) as unknown;
              return typeof fn === 'function'
                ? (fn as (...a: unknown[]) => unknown).apply(modelObj, args)
                : fn;
            });
          };
        },
      }
    );
    modelProxies.set(model, proxy);
  }
  return proxy;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (typeof prop !== 'string') {
      return undefined;
    }
    // متدهای سطح کلاینت: $transaction، $queryRaw، $executeRawUnsafe، $disconnect…
    if (prop.startsWith('$')) {
      return (...args: unknown[]) => {
        const client = activeClientSync();
        if (client) {
          return applyClientMethod(client, prop, args);
        }
        return ensureAndClient().then((client) => applyClientMethod(client, prop, args));
      };
    }
    return modelProxy(prop);
  },
});

export default prisma;
