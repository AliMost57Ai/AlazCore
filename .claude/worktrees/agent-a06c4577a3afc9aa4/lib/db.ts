/**
 * PrismaClient singleton.
 *
 * Next.js dev hot-reload creates a new module registry per compilation; without
 * the global cache each reload would open another SQLite connection pool until
 * the file handles run out. The global survives reloads, so exactly one client
 * exists for the lifetime of the dev server.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
