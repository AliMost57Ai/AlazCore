import { NextResponse, type NextRequest } from 'next/server';
import { coreAllowedHrefs, getLicense } from '@/lib/core-license';
import {
  hasMenuPermission,
  matchingAdminOnlyHref,
  matchingAlternateGrants,
  matchingAssignableHref,
} from '@/lib/nav-permissions';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { blockCode, blockForLicense, blockSearchParams, type SiteBlock } from '@/lib/site-block';
import {
  enterSiteContext,
  isLocalHost,
  isProductionRuntime,
  resolveSiteDomain,
} from '@/lib/site-runtime';

/** Routes reachable while signed out — the shop, auth and pay-link pages. */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/login-otp',
  '/signup',
  '/forgot',
  '/shop',
  '/pay',
  '/faq',
  '/site-inactive',
];

/** Auth pages a signed-in visitor has no reason to see again. */
const AUTH_PAGES = ['/login', '/login-otp', '/signup', '/forgot'];

/** مسیرهایی که لایسنس رویشان اعمال نمی‌شود (خودِ صفحه تعلیق و سلامت اپ). */
const LICENSE_EXEMPT_PATHS = ['/site-inactive'];

/**
 * /panel مال پنل Core (اپ مستقل روی پورت/دامنه خودش) است — روی فروشگاه
 * وجود ندارد؛ به‌جای 404 به داشبورد فروشگاه برمی‌گردیم.
 */
const SHOP_REDIRECTS: Record<string, string> = {
  '/panel': '/dashboard',
};

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * پاسخ گیت fail-closed — صفحه به /site-inactive با «دلیل واقعی» می‌رود؛ API
 * پاسخ JSON 503 می‌گیرد (قرارداد: در production هیچ لودی بدون تأیید کور و
 * دیتابیس دامنه). انتقال دلیل مهم است: صفحه‌ی تعلیق بدون آن مجبور می‌شد علت را
 * از وضعیت لایسنس حدس بزند و برای دامنه‌ی ثبت‌شده هم «ثبت‌نشده» نشان می‌داد.
 */
function inactiveResponse(request: NextRequest, isApi: boolean, block: SiteBlock): NextResponse {
  const code = blockCode(block);
  if (isApi) {
    return NextResponse.json(
      {
        error: 'این دامنه فعال/پیکربندی نیست (SITE_INACTIVE).',
        code,
        reason: block.kind,
        ...(block.status ? { status: block.status } : {}),
        ...(block.serviceDown ? { serviceDown: true } : {}),
      },
      { status: 503 }
    );
  }
  const target = new URL('/site-inactive', request.url);
  for (const [key, value] of Object.entries(blockSearchParams(block))) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}

/**
 * لاگ یک‌باره‌ی هر (دامنه، دلیل) — بدون آن هر درخواست مسدود یک خط لاگ
 * می‌ساخت. کلید شامل دامنه است، پس هر سایت مستقل لاگ می‌شود و مسدودشدن یک
 * دامنه هیچ اثری روی بقیه ندارد. برای عیب‌یابی: `podman logs <shop> | grep site-block`.
 */
const loggedBlocks = new Set<string>();
const LOGGED_BLOCKS_LIMIT = 500;

function warnBlock(domain: string | null, block: SiteBlock, pathname: string): void {
  const code = blockCode(block);
  const key = `${domain ?? '(none)'}|${code}`;
  if (loggedBlocks.has(key)) {
    return;
  }
  loggedBlocks.add(key);
  // سقف ساده: قدیمی‌ترین کلید حذف می‌شود تا با دامنه‌های زیاد حافظه رشد نکند.
  if (loggedBlocks.size > LOGGED_BLOCKS_LIMIT) {
    const oldest = loggedBlocks.values().next().value;
    if (oldest !== undefined) {
      loggedBlocks.delete(oldest);
    }
  }
  console.warn(`[site-block] domain=${domain ?? '(none)'} reason=${code} firstPath=${pathname}`);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // /panel روی فروشگاه معنا ندارد — پنل Core اپ مستقل است (فقط صفحات).
  if (!isApi && SHOP_REDIRECTS[pathname]) {
    return NextResponse.redirect(new URL(SHOP_REDIRECTS[pathname], request.url));
  }

  // ── resolve دامنه (تک‌منبع: resolveSiteDomain) و نشاندن کانتکست ─────────
  // proxy روی Node runtime اجرا می‌شود، پس همین‌جا کانتکست روی زنجیره‌ی
  // درخواست می‌نشیند و Proxy دیتابیس (lib/db.ts) در هر نقطه‌ی downstream
  // دیتابیس همین سایت را برمی‌دارد — صفحات و APIها هر دو.
  const isProduction = isProductionRuntime();
  const siteDomain = resolveSiteDomain({
    forwardedHost: request.headers.get('x-forwarded-host'),
    host: request.headers.get('host'),
  });
  // dev/localhost بدون SHOP_DOMAIN — حالت تست راحت (دیتابیس اصلی، بدون کور).
  const isLocalDev = !isProduction && !siteDomain && isLocalHost(request.headers.get('host'));

  if (siteDomain) {
    enterSiteContext(siteDomain);
    // prewarm دیتابیس سایت (یک بار، با کش per-domain)؛ ساخت on-demand فقط در
    // توسعه — production فایل را از provision پنل Core می‌خواهد (پایین‌تر).
    void import('@/lib/site-db')
      .then(({ ensureSiteDb }) => ensureSiteDb(siteDomain, { allowCreate: !isProduction }))
      .catch(() => {});
  } else {
    enterSiteContext(null);
  }

  // دامنه‌ی resolveشده را به اپ پاس بده — Next درخواست را بعد از پراکسی داخلی
  // بازdispatch می‌کند و Host در handlerها localhost می‌شود؛ x-site-domain
  // زنجیره‌ی مطمئن است چون اینجا همیشه بازنویسی (یا حذف) می‌شود و مقدار
  // فورج‌شده‌ی کلاینت هرگز زنده نمی‌ماند. APIهای /api/core از matcher بیرونند
  // و دامنه را بعد از احراز x-core-key خودشان صریح می‌خوانند.
  const requestHeaders = new Headers(request.headers);
  if (siteDomain) {
    requestHeaders.set('x-site-domain', siteDomain);
  } else {
    requestHeaders.delete('x-site-domain');
  }

  // ── گیت لایسنس سامانه Core (بند ۲-۹) — صفحات و API ──────────────────────
  // قرارداد: اول اعتبارسنجی وجود/اعتبار دامنه از سمت کور، بعد لود سایت.
  // خودِ صفحه‌ی تعلیق از هر دو گیت (لایسنس + دیتابیس) معاف است — وگرنه در
  // production ریدایرکت به خودش حلقه‌ی بی‌نهایت می‌شود.
  const licenseExempt = LICENSE_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
  let license = null as Awaited<ReturnType<typeof getLicense>>;
  if (!isLocalDev && !licenseExempt) {
    license = siteDomain ? await getLicense(siteDomain) : null;
    const licenseBlock = blockForLicense(license);
    if (licenseBlock) {
      warnBlock(siteDomain, licenseBlock, pathname);
      return inactiveResponse(request, isApi, licenseBlock);
    }
  }

  // ── fail-closed دیتابیس — فقط production ────────────────────────────────
  // production بدون دامنه‌ی واقعی (IP/localhost) یا با دامنه‌ای که فایل
  // دیتابیسش provision نشده ⇒ هیچ لودی؛ هرگز دیتابیس اصلی سرو نمی‌شود.
  // دلیل هر دو حالت به صفحه منتقل می‌شود تا با «دامنه ثبت‌نشده» اشتباه نشود.
  if (isProduction && !isLocalDev && !licenseExempt) {
    if (!siteDomain) {
      const block: SiteBlock = { kind: 'domain' };
      warnBlock(null, block, pathname);
      return inactiveResponse(request, isApi, block);
    }
    const { siteDbFileExists } = await import('@/lib/site-db');
    if (!siteDbFileExists(siteDomain)) {
      const block: SiteBlock = { kind: 'db' };
      warnBlock(siteDomain, block, pathname);
      return inactiveResponse(request, isApi, block);
    }
  }

  // APIها احراز هویت/مجوز خودشان را داخل route انجام می‌دهند؛ کانتکست سایت
  // از ALS همین‌جا رسیده — دیگر کاری با session نداریم.
  if (isApi) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  // Signed out, asking for a protected page → send to login, remember where.
  if (!session && !isPublic(pathname)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);

    const response = NextResponse.redirect(login);
    // Clear a stale or tampered cookie so we don't loop on the next request.
    if (request.cookies.has(SESSION_COOKIE)) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  // Signed in, asking for an auth page → nothing to do there. (The shop at
  // `/` and `/shop` stays reachable for signed-in users too — it's storefront,
  // not an auth-only page.)
  if (session && AUTH_PAGES.some((path) => pathname === path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Menu-level access, enforced centrally: admin-only pages need an admin
  // session, grantable menus need a view grant in the session's permission
  // list (their role's menus — see lib/nav-permissions.ts). Pages outside both
  // catalogs (dashboard, own settings, the shop) stay open to staff.
  // Optimistic like the sign-in check above — pages re-verify with
  // canAccessMenu. Customers never reach here; the app layout sends them back.
  if (session && session.role !== 'customer') {
    const needsAdmin = matchingAdminOnlyHref(pathname) !== null;
    const menu = matchingAssignableHref(pathname);
    // صفحاتی که چند دسترسی می‌توانند باز کنند — پروندهٔ مشتری (/customers/[id])
    // هم از دارندگان '/customers' و هم از توکن مستقل '/customers/file' (حالت
    // پشتیبان) باز می‌شود؛ ALTERNATE_GRANTS در lib/nav-permissions.ts.
    const anyOf = matchingAlternateGrants(pathname);
    if (needsAdmin || menu || anyOf) {
      const perms = session.perms ?? [];
      const menuOk = menu !== null && hasMenuPermission(perms, menu, 'view');
      const anyOfOk =
        anyOf !== null && anyOf.some((href) => hasMenuPermission(perms, href, 'view'));
      const allowed = session.role === 'admin' || perms.includes('*') || menuOk || anyOfOk;
      if (!allowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // پلن Core منوهای پرسنل را محدود می‌کند؛ مالک (admin) پنل کامل می‌بیند.
    if (session.role !== 'admin') {
      const allowedByCore = coreAllowedHrefs(license);
      if (allowedByCore) {
        const gated = matchingAdminOnlyHref(pathname) ?? matchingAssignableHref(pathname);
        if (gated && !allowedByCore.has(gated)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  /**
   * Everything except core-admin API routes (they authenticate with x-core-key
   * and pick their site explicitly), Next internals, and static files — API
   * routes are included so the license/tenant gates cover them too.
   */
  matcher: ['/((?!api/core|_next/static|_next/image|favicon.svg|.*\\.[\\w]+$).*)'],
};
