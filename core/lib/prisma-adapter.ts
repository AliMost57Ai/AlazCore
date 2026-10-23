import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';

/**
 * Prisma 7 driver adapter for the Core panel — own DB at core/data/core.db,
 * plus per-site shop DBs that Core provisions/reads directly.
 *
 * `timestampFormat: 'unixepoch-ms'` keeps existing rows readable: the pre-v7
 * engine stored DateTime values as Unix milliseconds.
 */
export function sqliteUrl(absPath: string): string {
  return `file:${absPath.replace(/\\/g, '/')}`;
}

export function mainDbUrl(): string {
  return sqliteUrl(path.join(process.cwd(), 'data', 'core.db'));
}

export function createPrismaClient(url: string = mainDbUrl()): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url }, { timestampFormat: 'unixepoch-ms' });
  return new PrismaClient({ adapter });
}
