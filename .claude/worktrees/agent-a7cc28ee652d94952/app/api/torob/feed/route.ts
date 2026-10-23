import { NextResponse, type NextRequest } from 'next/server';
import { listProducts } from '@/lib/products';
import { getSiteSettings } from '@/lib/theme-settings';

/**
 * Torob product feed (torob.com/sell) — the merchant submits a feed URL in
 * the Torob seller panel and Torob's crawler pulls it on its schedule. This
 * endpoint serves the store's visible, in-stock products as Torob's XML
 * structure: one <product> per item with the Torob-field content model
 * (id_1-1 style ids, price in Rial, availability).
 *
 * Public by design — the feed is exactly what the storefront shows anyone,
 * and Torob's crawler is anonymous.
 */
export async function GET(request: NextRequest) {
  const [products, site] = await Promise.all([
    listProducts({ visibility: true }),
    getSiteSettings(),
  ]);

  const origin = request.nextUrl.origin;
  const siteName = site.siteName || 'فروشگاه';

  // Only products a Torob shopper could actually buy.
  const purchasable = products.filter((product) => product.qty > 0);
  const priceToman = (price: number, discountPercent: number) =>
    Math.round(price * (1 - discountPercent / 100));

  // XML text content is escaped — product names are free-form admin input.
  const esc = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const rows = purchasable
    .map((product, index) => {
      const rowId = index + 1;
      const image = product.images[0] ? `${origin}/api/files/${product.images[0].path}` : '';
      const price = priceToman(product.price, product.discountPercent);
      const lastUpdate = product.updatedAt.slice(0, 10).replace(/-/g, '/');

      return [
        `    <product>`,
        `      <id_1-${rowId}>${esc(product.id)}</id_1-${rowId}>`,
        `      <price_1-${rowId}>${price * 10}</price_1-${rowId}>`,
        `      <availability_1-${rowId}>in stock</availability_1-${rowId}>`,
        `      <title_1-${rowId}>${esc(product.name)}</title_1-${rowId}>`,
        `      <link_1-${rowId}>${esc(`${origin}/shop/${product.slug}`)}</link_1-${rowId}>`,
        image ? `      <image_link_1-${rowId}>${esc(image)}</image_link_1-${rowId}>` : '',
        `      <last_update_1-${rowId}>${lastUpdate}</last_update_1-${rowId}>`,
        `    </product>`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<products type="array" for="${esc(siteName)}">
${rows}
</products>
`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      // Torob crawls on its own schedule — a short fresh window keeps the
      // feed current without hammering the origin per request.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
