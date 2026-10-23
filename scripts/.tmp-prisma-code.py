# -*- coding: utf-8 -*-
"""Rewrite @prisma/client imports and PrismaClient construction for Prisma 7."""
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


# -------- 1) import specifier per directory -------------------------------
changed = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git', '.yarn', 'data', 'generated')]
    for name in files:
        if not name.endswith(('.ts', '.tsx')):
            continue
        path = os.path.join(root, name).replace('\\', '/')
        if path.startswith('./'):
            path = path[2:]
        raw, crlf = slurp(path)
        if "from '@prisma/client'" not in raw:
            continue
        if path.startswith('core/prisma/') or path.startswith('core/scripts/'):
            target = '../lib/generated/prisma/client'
        elif path.startswith('core/'):
            target = '@/lib/generated/prisma/client'
        elif path.startswith('scripts/') or path.startswith('prisma/'):
            target = '../lib/generated/prisma/client'
        else:
            target = '@/lib/generated/prisma/client'
        text = raw.replace('@prisma/client', target)
        spit(path, text, crlf)
        changed.append(path)

print('imports rewritten:', len(changed))
for c in changed:
    print('  ', c)

# -------- 2) construction sites ------------------------------------------
GEN = '../lib/generated/prisma/client'
APP = '@/lib/generated/prisma/client'

sub('prisma/seed.ts',
    "import { PrismaClient } from '%s';\n\nconst prisma = new PrismaClient();" % GEN,
    "import { createPrismaClient } from '../lib/prisma-adapter';\n\nconst prisma = createPrismaClient();")

sub('prisma/../core/prisma/seed.ts',
    "import { PrismaClient } from '%s';\n\nconst prisma = new PrismaClient();" % GEN,
    "import { createPrismaClient } from '../lib/prisma-adapter';\n\nconst prisma = createPrismaClient();")

# --- lib/site-db.ts
sub('lib/site-db.ts',
    "import { PrismaClient } from '%s';" % APP,
    "import { PrismaClient } from '%s';\nimport { createPrismaClient } from './prisma-adapter';" % APP)
sub('lib/site-db.ts',
    'const mainSingleton = globalForMain.prisma ?? new PrismaClient();',
    'const mainSingleton = globalForMain.prisma ?? createPrismaClient();')
sub('lib/site-db.ts',
    """    const url = `file:${absPath.replace(/\\\\/g, '/')}`;
    const client = new PrismaClient({
      datasources: { db: { url } },
    });""",
    """    const url = `file:${absPath.replace(/\\\\/g, '/')}`;
    const client = createPrismaClient(url);""")
sub('lib/site-db.ts',
    """    const client = new PrismaClient({
      datasources: { db: { url: `file:${absPath.replace(/\\\\/g, '/')}` } },
    });""",
    """    const client = createPrismaClient(`file:${absPath.replace(/\\\\/g, '/')}`);""")

# --- lib/site-migrations.test.ts
sub('lib/site-migrations.test.ts',
    "import { PrismaClient } from '%s';" % APP,
    "import { PrismaClient } from '%s';\nimport { createPrismaClient } from './prisma-adapter';" % APP)
sub('lib/site-migrations.test.ts',
    """  prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath.replace(/\\\\/g, '/')}` } },
  });""",
    """  prisma = createPrismaClient(`file:${dbPath.replace(/\\\\/g, '/')}`);""")
sub('lib/site-migrations.test.ts',
    """    const fresh = new PrismaClient({
      datasources: { db: { url: `file:${path.join(tempDir, 'fresh.db').replace(/\\\\/g, '/')}` } },
    });""",
    """    const fresh = createPrismaClient(
      `file:${path.join(tempDir, 'fresh.db').replace(/\\\\/g, '/')}`
    );""")

# --- root scripts
simple_scripts = [
    'scripts/check-site-user.ts',
    'scripts/check-gateway-usage.ts',
    'scripts/repair-product-qty-dev.ts',
    'scripts/check-cols.ts',
    'scripts/raw-debug.ts',
    'scripts/new-site-migration.ts',
    'scripts/migrate-sites.ts',
]
for path in simple_scripts:
    sub(path, "import { PrismaClient } from '%s';" % GEN,
        "import { createPrismaClient } from '../lib/prisma-adapter';")

sub('scripts/check-site-user.ts',
    'const prisma = new PrismaClient({ datasources: { db: { url } } });',
    'const prisma = createPrismaClient(url);')
sub('scripts/check-gateway-usage.ts',
    'const prisma = new PrismaClient({ datasources: { db: { url } } });',
    'const prisma = createPrismaClient(url);')
sub('scripts/repair-product-qty-dev.ts',
    'const prisma = new PrismaClient();',
    'const prisma = createPrismaClient();')
sub('scripts/check-cols.ts',
    'const prisma = new PrismaClient();',
    'const prisma = createPrismaClient();')
sub('scripts/raw-debug.ts',
    'const prisma = new PrismaClient({ datasources: { db: { url } } });',
    'const prisma = createPrismaClient(url);')
sub('scripts/new-site-migration.ts',
    'const base = new PrismaClient({ datasources: { db: { url: tmpUrl } } });',
    'const base = createPrismaClient(tmpUrl);')
sub('scripts/migrate-sites.ts',
    'const client = new PrismaClient({ datasources: { db: { url } } });',
    'const client = createPrismaClient(url);')

# --- scripts/migrate-site-uploads.ts (needs the client type too)
sub('scripts/migrate-site-uploads.ts',
    "import { PrismaClient } from '%s';" % GEN,
    "import { createPrismaClient } from '../lib/prisma-adapter';\nimport type { PrismaClient } from '%s';" % GEN)
sub('scripts/migrate-site-uploads.ts',
    """    const client = new PrismaClient({
      datasources: { db: { url: `file:${dbPath.replace(/\\\\/g, '/')}` } },
    });""",
    """    const client = createPrismaClient(`file:${dbPath.replace(/\\\\/g, '/')}`);""")

# --- scripts/check-bindings.ts used to require Core's client directly
sub('scripts/check-bindings.ts',
    "const { PrismaClient } = require('../core/node_modules/@prisma/client');",
    "import { createPrismaClient } from '../core/lib/prisma-adapter';")
sub('scripts/check-bindings.ts',
    'const prisma = new PrismaClient({ datasources: { db: { url } } }) as unknown as {',
    'const prisma = createPrismaClient(url) as unknown as {')

# --- core/lib/db.ts
sub('core/lib/db.ts',
    "import { PrismaClient } from '%s';" % APP,
    "import { PrismaClient } from '%s';\nimport { createPrismaClient } from './prisma-adapter';" % APP)
sub('core/lib/db.ts',
    'export const prisma = globalForPrisma.prisma ?? new PrismaClient();',
    'export const prisma = globalForPrisma.prisma ?? createPrismaClient();')

# --- core/lib/provision.ts
sub('core/lib/provision.ts',
    "import { PrismaClient } from '%s';" % APP,
    "import { PrismaClient } from '%s';\nimport { createPrismaClient } from './prisma-adapter';" % APP)
sub('core/lib/provision.ts',
    'const client = new PrismaClient({ datasources: { db: { url } } });',
    'const client = createPrismaClient(url);')

# --- core/scripts/backfill-ticket-displayid.ts
sub('core/scripts/backfill-ticket-displayid.ts',
    "import { PrismaClient } from '%s';" % GEN,
    "import { createPrismaClient } from '../lib/prisma-adapter';")
sub('core/scripts/backfill-ticket-displayid.ts',
    """  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH.replace(/\\\\/g, '/')}` } },
  });""",
    """  const prisma = createPrismaClient(`file:${DB_PATH.replace(/\\\\/g, '/')}`);""")

print('construction sites rewritten')
