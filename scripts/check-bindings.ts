import path from 'node:path';
import { createPrismaClient } from '../core/lib/prisma-adapter';

/**
 * بازرسی تخصیص‌های یک دامنه در Core — ابزار دود-تست.
 * Usage: npx tsx scripts/check-bindings.ts <domain>
 */

const domain = process.argv[2] ?? 'shop2.ir';
const url = `file:${path.join(process.cwd(), 'core', 'data', 'core.db').replace(/\\/g, '/')}`;
const prisma = createPrismaClient(url) as unknown as {
  domain: {
    findUnique: (args: { where: { domain: string }; include?: Record<string, true> }) => Promise<{
      gateways: { gateway: string; isActive: boolean }[];
      smsPanels: { provider: string; isActive: boolean }[];
    } | null>;
  };
  $disconnect: () => Promise<void>;
};

prisma.domain
  .findUnique({
    where: { domain },
    include: { gateways: true, smsPanels: true },
  })
  .then((d) => {
    if (!d) {
      console.log('domain not found:', domain);
      return prisma.$disconnect();
    }
    console.log(
      'gateways:',
      d.gateways.map((g) => `${g.gateway}:${g.isActive ? 'on' : 'off'}`).join(', ')
    );
    console.log(
      'sms:',
      d.smsPanels.map((s) => `${s.provider}:${s.isActive ? 'on' : 'off'}`).join(', ')
    );
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('ERR', e.message);
    process.exit(1);
  });
