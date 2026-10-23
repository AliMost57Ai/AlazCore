/**
 * Prisma CLI config for the Core panel (Prisma 7) — independent app, own DB.
 * Same split as the shop: CLI URL here, runtime adapter in lib/prisma-adapter.ts.
 */
import path from 'node:path';
import { defineConfig } from 'prisma/config';

const DEFAULT_DB = path.resolve(process.cwd(), 'data', 'core.db');

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.PRISMA_DATABASE_URL ?? `file:${DEFAULT_DB.replace(/\\/g, '/')}`,
  },
});
