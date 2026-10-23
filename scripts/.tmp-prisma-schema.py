# -*- coding: utf-8 -*-
"""One-off migration helper: Prisma 6 -> 7 API (schema, config, adapters, imports).

Normalizes to LF for matching, writes back with CRLF when the source used it.
"""
import io
import os


def slurp(path):
    with io.open(path, encoding='utf-8', newline='') as f:
        raw = f.read()
    return raw, '\r\n' in raw


def spit(path, text, crlf):
    data = text.replace('\r\n', '\n')
    if crlf:
        data = data.replace('\n', '\r\n')
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(data)


def sub(path, old, new, count=1):
    raw, crlf = slurp(path)
    text = raw.replace('\r\n', '\n')
    old_lf = old.replace('\r\n', '\n')
    found = text.count(old_lf)
    if found != count:
        raise SystemExit('MISMATCH %s: expected %d, found %d for:\n%s' % (path, count, found, old_lf[:300]))
    spit(path, text.replace(old_lf, new.replace('\r\n', '\n')), crlf)


def create(path, text):
    spit(path, text.lstrip('\n'), True)


# ---------------------------------------------------------------- schemas
root_schema = 'prisma/schema.prisma'
sub(
    root_schema,
    '''datasource db {
  provider = "sqlite"
  // Relative to this file → data/app.db at the project root, outside public/.
  // Hardcoded on purpose: CLI, seed script, and the Next runtime all resolve
  // the same file with zero .env setup on a fresh clone.
  url      = "file:../data/app.db"
}

generator client {
  provider = "prisma-client-js"
}
''',
    '''datasource db {
  provider = "sqlite"
  // Prisma 7: the connection URL lives in prisma.config.ts (CLI) and in
  // lib/prisma-adapter.ts (runtime, per site). Same file: data/app.db.
}

generator client {
  // Rust-free client generated as TypeScript inside the app tree.
  // moduleFormat/importFileExtension are pinned to what Next, Jest and tsx
  // all resolve: CommonJS globals + extensionless relative imports.
  provider            = "prisma-client"
  output              = "../lib/generated/prisma"
  moduleFormat        = "cjs"
  importFileExtension = ""
}
''',
)

core_schema = 'core/prisma/schema.prisma'
sub(
    core_schema,
    '''datasource db {
  provider = "sqlite"
  // Relative to this file → core/data/core.db at the core app root.
  url      = "file:../data/core.db"
}

generator client {
  provider = "prisma-client-js"
}
''',
    '''datasource db {
  provider = "sqlite"
  // Prisma 7: URL lives in core/prisma.config.ts (CLI) and in
  // core/lib/prisma-adapter.ts (runtime). Same file: core/data/core.db.
}

generator client {
  provider            = "prisma-client"
  output              = "../lib/generated/prisma"
  moduleFormat        = "cjs"
  importFileExtension = ""
}
''',
)

# ---------------------------------------------------------------- prisma config
root_config = r'''
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
'''

core_config = r'''
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
'''
create('prisma.config.ts', root_config)
create('core/prisma.config.ts', core_config)

# ---------------------------------------------------------------- adapters
root_adapter = r'''
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
'''
create('lib/prisma-adapter.ts', root_adapter)

core_adapter = r'''
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
'''
create('core/lib/prisma-adapter.ts', core_adapter)

print('schemas, configs and adapters written')
