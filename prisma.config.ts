/**
 * Prisma CLI config (Prisma 7). The schema no longer carries a datasource URL.
 *
 * The CLI uses this URL for `db push` (publish-time schema sync), `studio` and
 * `migrate diff`. The Next runtime never reads it: it builds a better-sqlite3
 * adapter per database in lib/prisma-adapter.ts, so multi-tenant site DBs keep
 * working. PRISMA_DATABASE_URL lets a script point the CLI at another file.
 */
import path from 'node:path';
import { defineConfig } from 'prisma/config';

const DEFAULT_DB = path.resolve(process.cwd(), 'data', 'app.db');

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.PRISMA_DATABASE_URL ?? `file:${DEFAULT_DB.replace(/\\/g, '/')}`,
  },
});
