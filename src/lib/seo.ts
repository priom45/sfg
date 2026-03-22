export type SeoSchemaNode = Record<string, unknown>;

export const seoSiteName = 'The Supreme Waffle';
export const seoDefaultTitle = `${seoSiteName} | Premium Gourmet Waffles | Order Online`;
export const seoDefaultDescription = 'Order handcrafted Belgian waffles, dessert combos, and shakes from The Supreme Waffle. Explore premium toppings, veg picks, eggless options, and fresh made-to-order favorites.';
export const seoDefaultImage = '/logo-full.png';
export const seoDefaultKeywords = [
  'The Supreme Waffle',
  'gourmet waffles',
  'Belgian waffles',
  'dessert cafe',
  'waffle menu',
  'eggless waffles',
  'waffle takeaway',
  'milkshakes',
  'dessert delivery',
  'best waffles near me',
];

const fallbackSiteUrl = 'https://thesupreme.waffle';
const configuredSiteUrl = trimTrailingSlash((import.meta.env.VITE_SITE_URL as string | undefined)?.trim() || '');
const runtimeOrigin = typeof window !== 'undefined' ? trimTrailingSlash(window.location.origin) : '';

export const seoSiteUrl = configuredSiteUrl || (
  runtimeOrigin && !/(localhost|127\.0\.0\.1)/i.test(runtimeOrigin)
    ? runtimeOrigin
    : fallbackSiteUrl
);

export const organizationSchema = {
  '@type': 'Organization',
  '@id': buildSeoUrl('/#organization'),
  name: seoSiteName,
  url: buildSeoUrl('/'),
  logo: buildSeoUrl('/logo-full.png'),
  image: buildSeoUrl('/logo-full.png'),
  email: 'hello@supremewaffle.com',
  telephone: '+91 98765 43210',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: '+91 98765 43210',
    email: 'hello@supremewaffle.com',
    areaServed: 'IN',
    availableLanguage: ['English', 'Hindi'],
  },
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': buildSeoUrl('/#website'),
  url: buildSeoUrl('/'),
  name: seoSiteName,
  description: seoDefaultDescription,
  inLanguage: 'en-IN',
  publisher: {
    '@id': buildSeoUrl('/#organization'),
  },
};

export const restaurantSchema = {
  '@type': 'Restaurant',
  '@id': buildSeoUrl('/#restaurant'),
  name: seoSiteName,
  url: buildSeoUrl('/'),
  image: [
    buildSeoUrl('/logo-full.png'),
    buildSeoUrl('/image.png'),
  ],
  description: seoDefaultDescription,
  email: 'hello@supremewaffle.com',
  telephone: '+91 98765 43210',
  servesCuisine: ['Waffles', 'Desserts', 'Milkshakes'],
  priceRange: '$$',
  menu: buildSeoUrl('/menu'),
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Police Station Road, Kanuru',
    addressLocality: 'Vijayawada',
    addressCountry: 'IN',
  },
  sameAs: [
    'https://wa.me/919876543210?text=Hi, I have a question about The Supreme Waffle',
  ],
};

export const menuSchema = {
  '@type': 'Menu',
  '@id': buildSeoUrl('/menu#menu'),
  name: `${seoSiteName} Menu`,
  url: buildSeoUrl('/menu'),
  hasMenuSection: [
    { '@type': 'MenuSection', name: 'Classic Waffles' },
    { '@type': 'MenuSection', name: 'Belgian Waffles' },
    { '@type': 'MenuSection', name: 'Chocolate Waffles' },
    { '@type': 'MenuSection', name: 'Fruit Waffles' },
    { '@type': 'MenuSection', name: 'Savory Waffles' },
    { '@type': 'MenuSection', name: 'Milkshakes' },
  ],
};

export function buildSeoUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path === '/'
    ? '/'
    : `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  return normalizedPath === '/'
    ? `${seoSiteUrl}/`
    : `${seoSiteUrl}${normalizedPath}`;
}

export function humanizeSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildSchemaGraph(nodes: SeoSchemaNode[]) {
  if (nodes.length === 1) {
    return {
      '@context': 'https://schema.org',
      ...nodes[0],
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: buildSeoUrl(item.path),
    })),
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}
