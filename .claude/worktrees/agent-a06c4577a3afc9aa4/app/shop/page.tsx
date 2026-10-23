import { redirect } from 'next/navigation';

/**
 * The shop landing lives at the site root now — `/shop` keeps working for
 * anyone (or any bookmark) still pointing here.
 */
export default function ShopRedirectPage() {
  redirect('/');
}
