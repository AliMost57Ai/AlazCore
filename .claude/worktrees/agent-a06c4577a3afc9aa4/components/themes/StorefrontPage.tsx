import ThemeBeautyShop from './beautyshop/ThemeBeautyShop';
import ThemeDigiMarket from './digimarket/ThemeDigiMarket';
import ThemeDigiShop from './digishop/ThemeDigiShop';
import type { StorefrontProps } from './shared/types';
import ThemeSoftKala from './softkala/ThemeSoftKala';

/**
 * Renders the storefront landing page with the ACTIVE theme — the single
 * dispatch point the public shop page (app/page.tsx) talks to. Adding a
 * theme means registering it here and in lib/themes.ts.
 */
export default function StorefrontPage(props: StorefrontProps) {
  switch (props.theme.id) {
    case 'digimarket':
      return <ThemeDigiMarket {...props} />;
    case 'digishop':
      return <ThemeDigiShop {...props} />;
    case 'softkala':
      return <ThemeSoftKala {...props} />;
    case 'beautyshop':
    default:
      return <ThemeBeautyShop {...props} />;
  }
}
