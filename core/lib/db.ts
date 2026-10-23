/**
 * PrismaClient singleton — همین الگوی فروشگاه؛ ماندگار روی global تا هات‌ریلود
 * dev سرور، هر بار کانکشن جدید باز نکند.
 */

import { PrismaClient } from './generated/prisma/client';
import { createPrismaClient } from './prisma-adapter';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
