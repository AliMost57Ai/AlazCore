import type { Metadata } from 'next';
import { IconHeartOff } from '@tabler/icons-react';
import { Grid, GridCol, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ThemeProductCard from '@/components/themes/shared/ThemeProductCard';
import { requireSession } from '@/lib/auth';
import { listFavoriteProducts } from '@/lib/favorites';
import { faNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'علاقه‌مندی‌ها',
};

/**
 * لیست علاقه‌مندی‌های مشتری — کالاهایی که با قلب نشان‌کرده است. همان کارت
 * ویترین رندر می‌شود (لینک به صفحه محصول، قلب فعال روی هر کارت برای حذف).
 */
export default async function FavoritesPage() {
  const session = await requireSession('/account/favorites');
  const products = await listFavoriteProducts(session.sub);

  return (
    <Stack gap="lg">
      <PageHeader
        title="علاقه‌مندی‌ها"
        description={`${faNumber(products.length)} کالا — با قلب روی کارت‌ها یا صفحه محصول اضافه و حذف می‌شود.`}
      />

      {products.length === 0 ? (
        <Stack gap="sm" align="center" py="xl">
          <IconHeartOff size={40} stroke={1.4} opacity={0.4} />
          <Text size="sm" c="dimmed" ta="center">
            هنوز کالایی نشان نکرده‌اید — روی قلب هر کالا در فروشگاه بزنید تا این‌جا ذخیره شود.
          </Text>
        </Stack>
      ) : (
        <Grid gutter="md">
          {products.map((product) => (
            // GridCol مستقیم import می‌شود: این یک Server Component است و static
            // property (Grid.Col) روی client reference در دسترس نیست — الگوی dashboard.
            <GridCol key={product.id} span={{ base: 6, sm: 4, md: 3 }}>
              <ThemeProductCard product={product} />
            </GridCol>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
