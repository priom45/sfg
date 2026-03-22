import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildBreadcrumbSchema,
  buildSchemaGraph,
  buildSeoUrl,
  humanizeSlug,
  menuSchema,
  organizationSchema,
  restaurantSchema,
  seoDefaultDescription,
  seoDefaultImage,
  seoDefaultKeywords,
  seoDefaultTitle,
  seoSiteName,
  websiteSchema,
} from '../lib/seo';

type SeoMetadata = {
  title: string;
  description: string;
  path: string;
  robots: string;
  image?: string;
  keywords?: string[];
  type?: 'website' | 'article';
  schema?: Record<string, unknown>;
};

const defaultRobots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const noIndexRobots = 'noindex, nofollow, noarchive';

export default function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const metadata = getRouteMetadata(location.pathname, location.search);
    const canonicalUrl = buildSeoUrl(metadata.path);
    const imageUrl = buildSeoUrl(metadata.image || seoDefaultImage);
    const keywords = (metadata.keywords || seoDefaultKeywords).join(', ');

    document.documentElement.setAttribute('lang', 'en-IN');
    document.title = metadata.title;

    setNamedMeta('description', metadata.description);
    setNamedMeta('keywords', keywords);
    setNamedMeta('author', seoSiteName);
    setNamedMeta('application-name', seoSiteName);
    setNamedMeta('robots', metadata.robots);
    setNamedMeta('googlebot', metadata.robots);
    setNamedMeta('twitter:card', 'summary_large_image');
    setNamedMeta('twitter:title', metadata.title);
    setNamedMeta('twitter:description', metadata.description);
    setNamedMeta('twitter:image', imageUrl);
    setNamedMeta('twitter:image:alt', `${seoSiteName} logo and desserts`);

    setPropertyMeta('og:site_name', seoSiteName);
    setPropertyMeta('og:locale', 'en_IN');
    setPropertyMeta('og:type', metadata.type || 'website');
    setPropertyMeta('og:title', metadata.title);
    setPropertyMeta('og:description', metadata.description);
    setPropertyMeta('og:url', canonicalUrl);
    setPropertyMeta('og:image', imageUrl);
    setPropertyMeta('og:image:alt', `${seoSiteName} logo and desserts`);

    setLinkTag('link[rel="canonical"]', {
      rel: 'canonical',
      href: canonicalUrl,
    });
    setLinkTag('link[rel="alternate"][hreflang="en-IN"]', {
      rel: 'alternate',
      href: canonicalUrl,
      hreflang: 'en-IN',
    });
    setLinkTag('link[rel="alternate"][hreflang="x-default"]', {
      rel: 'alternate',
      href: canonicalUrl,
      hreflang: 'x-default',
    });

    setJsonLd(metadata.schema);
  }, [location.pathname, location.search]);

  return null;
}

function getRouteMetadata(pathname: string, search: string): SeoMetadata {
  if (pathname.startsWith('/admin')) {
    return {
      title: `Admin | ${seoSiteName}`,
      description: 'Secure admin access for The Supreme Waffle team.',
      path: '/admin/login',
      robots: noIndexRobots,
    };
  }

  if (pathname.startsWith('/chef')) {
    return {
      title: `Kitchen Dashboard | ${seoSiteName}`,
      description: 'Secure kitchen dashboard for The Supreme Waffle operations.',
      path: '/chef/login',
      robots: noIndexRobots,
    };
  }

  if (pathname.startsWith('/order-success')) {
    return {
      title: `Order Confirmation | ${seoSiteName}`,
      description: 'Order confirmation page for The Supreme Waffle customers.',
      path: '/order-success',
      robots: noIndexRobots,
    };
  }

  if (pathname.startsWith('/track')) {
    return {
      title: `Track Your Order | ${seoSiteName}`,
      description: 'Track your Supreme Waffle order in real time.',
      path: '/track',
      robots: noIndexRobots,
    };
  }

  if (pathname === '/cart') {
    return {
      title: `Your Cart | ${seoSiteName}`,
      description: 'Review your cart before placing your Supreme Waffle order.',
      path: '/cart',
      robots: noIndexRobots,
    };
  }

  if (pathname === '/auth') {
    return {
      title: `Sign In | ${seoSiteName}`,
      description: 'Secure sign in for The Supreme Waffle customers, admins, and chefs.',
      path: '/auth',
      robots: noIndexRobots,
    };
  }

  if (pathname === '/profile') {
    return {
      title: `Your Profile | ${seoSiteName}`,
      description: 'Manage your The Supreme Waffle profile and saved details.',
      path: '/profile',
      robots: noIndexRobots,
    };
  }

  if (pathname === '/my-orders') {
    return {
      title: `My Orders | ${seoSiteName}`,
      description: 'View and manage your The Supreme Waffle orders.',
      path: '/my-orders',
      robots: noIndexRobots,
    };
  }

  if (pathname === '/menu') {
    const searchParams = new URLSearchParams(search);
    const categorySlug = searchParams.get('category');
    const categoryName = categorySlug ? humanizeSlug(categorySlug) : '';
    const title = categoryName
      ? `${categoryName} Menu | ${seoSiteName}`
      : `Waffle Menu | ${seoSiteName}`;
    const description = categoryName
      ? `Browse ${categoryName.toLowerCase()} waffles, desserts, shakes, and premium toppings from The Supreme Waffle menu.`
      : 'Browse the full Supreme Waffle menu with Belgian waffles, fruit waffles, dessert combos, shakes, veg picks, and eggless options.';

    return {
      title,
      description,
      path: '/menu',
      robots: defaultRobots,
      keywords: [...seoDefaultKeywords, 'waffle menu online', 'dessert menu'],
      schema: buildSchemaGraph([
        {
          '@type': 'CollectionPage',
          '@id': buildSeoUrl('/menu#webpage'),
          url: buildSeoUrl('/menu'),
          name: title,
          description,
          isPartOf: {
            '@id': buildSeoUrl('/#website'),
          },
          about: {
            '@id': buildSeoUrl('/#restaurant'),
          },
        },
        menuSchema,
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Menu', path: '/menu' },
        ]),
      ]),
    };
  }

  if (pathname === '/about') {
    return {
      title: `About Us | ${seoSiteName}`,
      description: 'Learn about The Supreme Waffle, our handcrafted dessert philosophy, kitchen standards, and customer support channels.',
      path: '/about',
      robots: defaultRobots,
      keywords: [...seoDefaultKeywords, 'about The Supreme Waffle', 'waffle cafe story'],
      schema: buildSchemaGraph([
        {
          '@type': 'AboutPage',
          '@id': buildSeoUrl('/about#webpage'),
          url: buildSeoUrl('/about'),
          name: `About ${seoSiteName}`,
          description: 'Learn about The Supreme Waffle, our handcrafted desserts, and our customer-first service.',
          isPartOf: {
            '@id': buildSeoUrl('/#website'),
          },
          about: {
            '@id': buildSeoUrl('/#restaurant'),
          },
        },
        organizationSchema,
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ]),
      ]),
    };
  }

  if (pathname === '/privacy') {
    return {
      title: `Privacy Policy | ${seoSiteName}`,
      description: 'Read how The Supreme Waffle collects, uses, and stores customer and order information.',
      path: '/privacy',
      robots: defaultRobots,
      schema: buildSchemaGraph([
        {
          '@type': 'WebPage',
          '@id': buildSeoUrl('/privacy#webpage'),
          url: buildSeoUrl('/privacy'),
          name: `Privacy Policy | ${seoSiteName}`,
          description: 'Privacy policy for The Supreme Waffle website and ordering experience.',
          isPartOf: {
            '@id': buildSeoUrl('/#website'),
          },
        },
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Privacy Policy', path: '/privacy' },
        ]),
      ]),
    };
  }

  if (pathname === '/terms') {
    return {
      title: `Terms Of Service | ${seoSiteName}`,
      description: 'Read the terms that govern use of The Supreme Waffle website, accounts, and ordering experience.',
      path: '/terms',
      robots: defaultRobots,
      schema: buildSchemaGraph([
        {
          '@type': 'WebPage',
          '@id': buildSeoUrl('/terms#webpage'),
          url: buildSeoUrl('/terms'),
          name: `Terms Of Service | ${seoSiteName}`,
          description: 'Terms of service for The Supreme Waffle website and order platform.',
          isPartOf: {
            '@id': buildSeoUrl('/#website'),
          },
        },
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Terms Of Service', path: '/terms' },
        ]),
      ]),
    };
  }

  return {
    title: seoDefaultTitle,
    description: seoDefaultDescription,
    path: '/',
    robots: defaultRobots,
    keywords: [...seoDefaultKeywords, 'premium waffles', 'handcrafted desserts'],
    schema: buildSchemaGraph([
      {
        '@type': 'WebPage',
        '@id': buildSeoUrl('/#webpage'),
        url: buildSeoUrl('/'),
        name: seoDefaultTitle,
        description: seoDefaultDescription,
        isPartOf: {
          '@id': buildSeoUrl('/#website'),
        },
      },
      websiteSchema,
      organizationSchema,
      restaurantSchema,
    ]),
  };
}

function setNamedMeta(name: string, content: string) {
  upsertHeadTag(`meta[name="${name}"]`, 'meta', {
    name,
    content,
  });
}

function setPropertyMeta(property: string, content: string) {
  upsertHeadTag(`meta[property="${property}"]`, 'meta', {
    property,
    content,
  });
}

function setLinkTag(selector: string, attributes: Record<string, string>) {
  upsertHeadTag(selector, 'link', attributes);
}

function setJsonLd(schema?: Record<string, unknown>) {
  const existing = document.head.querySelector<HTMLScriptElement>('#app-seo-schema');

  if (!schema) {
    existing?.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = 'app-seo-schema';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);

  if (!existing) {
    document.head.appendChild(script);
  }
}

function upsertHeadTag(
  selector: string,
  tagName: 'meta' | 'link',
  attributes: Record<string, string>,
) {
  const existing = document.head.querySelector<HTMLElement>(selector);
  const element = existing || document.createElement(tagName);

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  if (!existing) {
    document.head.appendChild(element);
  }
}
