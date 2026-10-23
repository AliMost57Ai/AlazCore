import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { normalizePhone } from '@/lib/users';

/** A saved delivery address of the signed-in customer. */
export interface AddressDTO {
  id: string;
  title: string;
  receiverName: string;
  receiverPhone: string;
  body: string;
  postalCode: string;
}

function toDTO(row: {
  id: string;
  title: string;
  receiverName: string;
  receiverPhone: string;
  body: string;
  postalCode: string | null;
}): AddressDTO {
  return {
    id: row.id,
    title: row.title,
    receiverName: row.receiverName,
    receiverPhone: row.receiverPhone,
    body: row.body,
    postalCode: row.postalCode ?? '',
  };
}

/** Lists the signed-in customer's saved delivery addresses. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const rows = await prisma.address.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ addresses: rows.map(toDTO) });
}

interface AddressBody {
  title?: unknown;
  receiverName?: unknown;
  receiverPhone?: unknown;
  body?: unknown;
  postalCode?: unknown;
}

/** Saves a new delivery address for the signed-in customer. */
export async function POST(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: AddressBody;
  try {
    body = (await request.json()) as AddressBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const receiverName = typeof body.receiverName === 'string' ? body.receiverName.trim() : '';
  const receiverPhoneRaw = typeof body.receiverPhone === 'string' ? body.receiverPhone : '';
  const addressBody = typeof body.body === 'string' ? body.body.trim() : '';
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';

  const receiverPhone = normalizePhone(receiverPhoneRaw);
  if (title.length < 2) {
    return NextResponse.json({ error: 'عنوان آدرس باید حداقل ۲ نویسه باشد.' }, { status: 400 });
  }
  if (receiverName.length < 3) {
    return NextResponse.json({ error: 'نام گیرنده باید حداقل ۳ نویسه باشد.' }, { status: 400 });
  }
  if (!receiverPhone) {
    return NextResponse.json(
      { error: 'شماره موبایل گیرنده باید با ۰۹ شروع شود و ۱۱ رقم باشد.' },
      { status: 400 }
    );
  }
  if (addressBody.length < 10) {
    return NextResponse.json({ error: 'متن آدرس باید حداقل ۱۰ نویسه باشد.' }, { status: 400 });
  }
  if (postalCode && !/^\d{10}$/.test(postalCode)) {
    return NextResponse.json({ error: 'کد پستی باید ۱۰ رقم باشد.' }, { status: 400 });
  }

  const row = await prisma.address.create({
    data: {
      userId: session.sub,
      title,
      receiverName,
      receiverPhone,
      body: addressBody,
      postalCode: postalCode || null,
    },
  });

  return NextResponse.json({ address: toDTO(row) }, { status: 201 });
}
