export type SeoSchemaNode = Record<string, unknown>;

export const seoSiteName = 'The Supreme Waffles';
export const seoDefaultTitle = 'Best Waffles & Thick Shakes in Vijayawada | The Supreme Waffles';
export const seoDefaultDescription = 'The Supreme Waffles in Vijayawada serves Belgian waffles, stick waffles, thick shakes, milkshakes, dessert combos, fries, momos, and street food favorites. Order online for the best waffles, shakes, and combo offers in Vijayawada.';
export const seoDefaultImage = '/logo-full.png';
export const seoDefaultKeywords = [
  'The Supreme Waffles',
  'The Supreme Waffles Vijayawada',
  'Supreme Waffles menu',
  'Supreme Waffles offers',
  'Supreme Waffles shakes',
  'Supreme Waffles combos',
  'supreme waffles Vijayawada',
  'best waffles in Vijayawada',
  'waffles in Vijayawada',
  'dessert shop in Vijayawada',
  'dessert shop Vijayawada near me',
  'waffle shop near me',
  'Belgian waffles near me',
  'thick shakes near me',
  'milkshakes near me',
  'ice cream waffles near me',
  'best dessert combo offers Vijayawada',
  'street food waffles Vijayawada',
  'waffle menu',
  'Belgian chocolate waffle',
  'dark fantasy waffle',
  'white chocolate waffle',
  'triple chocolate waffle',
  'KitKat waffle',
  'stick waffle India',
  'hot dog waffle Vijayawada',
  'sweet waffle desserts',
  'milkshakes',
  'thick chocolate shake',
  'Oreo milkshake',
  'KitKat milkshake',
  'caramel milkshake',
  'best thick shakes in Vijayawada',
  'kurkure momos near me',
  'fried momos Vijayawada',
  'peri peri fries near me',
  'chicken burger combo Vijayawada',
  'chicken nuggets near me',
  'buy 1 get 1 shakes offer',
  'combo offers food near me',
  'opening day food offers Vijayawada',
  'discount waffles near me',
  'best deals on desserts',
  'best waffle shop near Benz Circle Vijayawada',
  'affordable waffles under 100 rupees',
  'best milkshakes under 150',
  'budget snack combos Vijayawada',
  'crispy fried momos near me',
  'quick bite desserts Vijayawada',
  'best place for waffles in Vijayawada',
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
  email: 'thesupremewafflee@gmail.com',
  telephone: '+91 98765 43210',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: '+91 98765 43210',
    email: 'thesupremewafflee@gmail.com',
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
  potentialAction: {
    '@type': 'SearchAction',
    target: `${buildSeoUrl('/menu')}?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
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
  email: 'thesupremewafflee@gmail.com',
  telephone: '+91 98765 43210',
  servesCuisine: ['Waffles', 'Belgian Waffles', 'Desserts', 'Milkshakes', 'Thick Shakes', 'Fast Food', 'Street Food'],
  priceRange: '$$',
  menu: buildSeoUrl('/menu'),
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Police Station Road, Kanuru',
    addressLocality: 'Vijayawada',
    addressRegion: 'Andhra Pradesh',
    addressCountry: 'IN',
  },
  areaServed: ['Vijayawada', 'Benz Circle', 'Kanuru'],
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
