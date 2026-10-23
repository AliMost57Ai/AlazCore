import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';

/**
 * Prisma 7 needs a driver adapter instead of the removed `datasources` option.
 *
 * Two details matter for this app:
 *  - every DB (main + one per site) gets its own adapter/client, so the
 *    multi-tenant routing in lib/site-db.ts keeps working unchanged;
 *  - `timestampFormat: 'unixepoch-ms'` is required for existing databases:
 *    the pre-v7 engine stored every DateTime as Unix milliseconds. The new
 *    default (ISO-8601) would misread every stored date.
 */
export function sqliteUrl(absPath: string): string {
  return `file:${absPath.replace(/\\/g, '/')}`;
}

/** Main (non-site) database — data/app.db, same file the CLI pushes to. */
export function mainDbUrl(): string {
  return sqliteUrl(path.join(process.cwd(), 'data', 'app.db'));
}

export function createPrismaClient(url: string = mainDbUrl()): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url }, { timestampFormat: 'unixepoch-ms' });
  return new PrismaClient({ adapter });
}
