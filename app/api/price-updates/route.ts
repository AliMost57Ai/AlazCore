import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  applyPriceUpdate,
  validatePriceUpdateRequest,
  type PriceUpdateRequest,
} from '@/lib/price-updates';

/**
 * POST /api/price-updates — batch price update (needs the price-updates:edit
 * grant). Body: { scope: 'category' | 'product', targetId, adjustType: 'fixed' | 'percent', adjustValue }.
 *
 * Moves the product prices (and explicit variant prices) in scope and writes
 * one PriceChange history row per actual change. Orders are never touched —
 * their itemsJson already snapshots the prices the customer paid.
 */
export async function POST(request: Request) {
  const session = await requireApiMenu('/price-updates', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const body: unknown = await request.json().catch(() => null);
  const errors = validatePriceUpdateRequest(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  const input = body as PriceUpdateRequest;
  const result = await applyPriceUpdate(input, session.name);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ applied: result.applied, changes: result.changes });
}
