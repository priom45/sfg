import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { buildBreadcrumbSchema, buildSchemaGraph, buildSeoUrl, seoDefaultKeywords, seoSiteName } from '../lib/seo';
import type { Category, MenuItem, Offer } from '../types';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import { playAddToCartSound } from '../lib/sounds';
import { staggerContainer, staggerChild } from '../lib/animations';
import { fetchCustomizationAvailability, itemHasAssignedCustomizations, type CustomizationAvailability } from '../lib/customizations';
import { getOfferBadgeLabel, getOfferCtaHref, getOfferCtaText, getOfferDisplayDescription, getOfferRewardLabel } from '../lib/offers';

function normalizeImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function setNamedMeta(name: string, content: string) {
  upsertHeadTag(`meta[name="${name}"]`, 'meta', { name, content });
}

function setPropertyMeta(property: string, content: string) {
  upsertHeadTag(`meta[property="${property}"]`, 'meta', { property, content });
}

function setJsonLd(scriptId: string, schema?: Record<string, unknown>) {
  const existing = document.head.querySelector<HTMLScriptElement>(`#${scriptId}`);

  if (!schema) {
    existing?.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = scriptId;
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

type SuggestedCategoryContext = {
  title: string;
  subtitle: string;
  categories: Category[];
};

function normalizeCategoryText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function categoryMatchesToken(category: Category, token: string) {
  return normalizeCategoryText(`${category.name} ${category.slug}`).includes(token);
}

function pickSuggestedCategories(categories: Category[], tokenGroups: string[][], limit = 6) {
  const picked: Category[] = [];
  const usedIds = new Set<string>();

  tokenGroups.forEach((tokens) => {
    const match = categories.find((category) => (
      !usedIds.has(category.id)
      && tokens.some((token) => categoryMatchesToken(category, token))
    ));

    if (!match) return;

    picked.push(match);
    usedIds.add(match.id);
  });

  if (picked.length >= limit) {
    return picked.slice(0, limit);
  }

  return [
    ...picked,
    ...categories.filter((category) => !usedIds.has(category.id)).slice(0, limit - picked.length),
  ];
}

function buildSuggestedCategoryContext(categories: Category[], now = new Date()): SuggestedCategoryContext {
  const hour = now.getHours();
  const month = now.getMonth();
  const isSummerWindow = [2, 3, 4, 5].includes(month);

  if (hour >= 12 && hour < 17) {
    return {
      title: isSummerWindow ? 'Summer Afternoon Picks' : 'Afternoon Picks',
      subtitle: isSummerWindow
        ? 'Lead with cold scoops, milkshakes, thick shakes, and lighter dessert categories.'
        : 'Push colder, lighter categories while the afternoon is hottest.',
      categories: pickSuggestedCategories(categories, [
        ['ice cream', 'scoop'],
        ['milkshake'],
        ['thick shake'],
        ['cone'],
        ['belgian'],
        ['stick waffle'],
      ]),
    };
  }

  if (hour >= 17 && hour < 22) {
    return {
      title: 'Evening Cravings',
      subtitle: 'Rotate savory snack categories first, then keep drinks nearby for add-ons.',
      categories: pickSuggestedCategories(categories, [
        ['chaat'],
        ['fries'],
        ['chicken snack'],
        ['momo'],
        ['burger'],
        ['milkshake'],
      ]),
    };
  }

  return {
    title: 'Trending Categories',
    subtitle: 'Keep best-selling waffles and easy add-on drinks in front by default.',
    categories: pickSuggestedCategories(categories, [
      ['belgian'],
      ['stick waffle'],
      ['cone'],
      ['milkshake'],
      ['thick shake'],
      ['fries'],
    ]),
  };
}

function getRotatingCategoryWindow(categories: Category[], startIndex: number, size: number) {
  if (categories.length <= size) {
    return categories;
  }

  return Array.from({ length: size }, (_, offset) => categories[(startIndex + offset) % categories.length]);
}

export default function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');
  const [sortBy, setSortBy] = useState<'popular' | 'price_low' | 'price_high'>('popular');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pendingAddOnItem, setPendingAddOnItem] = useState<{ cartItemId: string; menuItem: MenuItem; quantity: number } | null>(null);
  const [customizationAvailability, setCustomizationAvailability] = useState<CustomizationAvailability | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [suggestedCategoryIdx, setSuggestedCategoryIdx] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const bannerTimer = useRef<ReturnType<typeof setInterval>>();
  const suggestionTimer = useRef<ReturnType<typeof setInterval>>();
  const filterBarRef = useRef<HTMLDivElement>(null);
  const { addItem, removeItem } = useCart();
  const { showToast } = useToast();
  const categoryParam = searchParams.get('category') || 'all';
  const searchParam = searchParams.get('search') || '';
  const itemParam = searchParams.get('item');

  const loadData = useCallback(async () => {
    const [catRes, itemRes, offerRes, availability] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
      supabase.from('offers').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(4),
      fetchCustomizationAvailability(),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setItems(itemRes.data);
    if (offerRes.error) showToast(offerRes.error.message || 'Failed to load offers', 'error');
    setOffers(offerRes.data || []);
    setCustomizationAvailability(availability);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    setActiveCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);

  useEffect(() => {
    if (!itemParam || items.length === 0 || categories.length === 0) {
      return;
    }

    const targetItem = items.find((item) => item.id === itemParam);
    if (!targetItem) {
      return;
    }

    const targetCategory = categories.find((category) => category.id === targetItem.category_id);
    if (targetCategory && activeCategory !== targetCategory.slug) {
      setActiveCategory(targetCategory.slug);
    }

    setSelectedItem((current) => (current?.id === targetItem.id ? current : targetItem));
  }, [activeCategory, categories, itemParam, items]);

  useEffect(() => {
    setBannerIdx((current) => {
      if (offers.length === 0) return 0;
      return current % offers.length;
    });
  }, [offers.length]);

  useEffect(() => {
    if (bannerTimer.current) clearInterval(bannerTimer.current);
    if (offers.length <= 1) return;
    bannerTimer.current = setInterval(() => {
      setBannerIdx((i) => (i + 1) % offers.length);
    }, 4000);
    return () => {
      if (bannerTimer.current) clearInterval(bannerTimer.current);
    };
  }, [offers.length]);

  const suggestedCategoryContext = useMemo(
    () => buildSuggestedCategoryContext(categories),
    [categories],
  );
  const suggestedCategoryPriority = useMemo(
    () => new Map(suggestedCategoryContext.categories.map((category, index) => [
      category.id,
      suggestedCategoryContext.categories.length - index,
    ])),
    [suggestedCategoryContext.categories],
  );
  const visibleSuggestedCategories = useMemo(
    () => getRotatingCategoryWindow(suggestedCategoryContext.categories, suggestedCategoryIdx, 3),
    [suggestedCategoryContext.categories, suggestedCategoryIdx],
  );

  useEffect(() => {
    setSuggestedCategoryIdx(0);
  }, [suggestedCategoryContext.title, suggestedCategoryContext.categories.length]);

  useEffect(() => {
    if (suggestionTimer.current) clearInterval(suggestionTimer.current);
    if (suggestedCategoryContext.categories.length <= 3) return;

    suggestionTimer.current = setInterval(() => {
      setSuggestedCategoryIdx((current) => (current + 1) % suggestedCategoryContext.categories.length);
    }, 3500);

    return () => {
      if (suggestionTimer.current) clearInterval(suggestionTimer.current);
    };
  }, [suggestedCategoryContext.categories]);

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (activeCategory !== 'all') {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) result = result.filter((i) => i.category_id === cat.id);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'price_low': result.sort((a, b) => a.price - b.price); break;
      case 'price_high': result.sort((a, b) => b.price - a.price); break;
      default:
        result.sort((a, b) => {
          if (activeCategory === 'all' && !search.trim()) {
            const categoryBoost = (suggestedCategoryPriority.get(b.category_id) || 0) - (suggestedCategoryPriority.get(a.category_id) || 0);
            if (categoryBoost !== 0) return categoryBoost;
          }

          const ratingDelta = b.rating - a.rating;
          if (ratingDelta !== 0) return ratingDelta;

          return a.display_order - b.display_order;
        });
    }
    return result;
  }, [items, categories, activeCategory, search, sortBy, suggestedCategoryPriority]);
  const currentCategory = useMemo(
    () => (activeCategory === 'all' ? null : categories.find((category) => category.slug === activeCategory) || null),
    [activeCategory, categories],
  );

  function handleCategoryChange(slug: string) {
    setActiveCategory(slug);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('item');
    if (slug === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', slug);
    }
    setSearchParams(nextParams);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set('search', value);
    } else {
      nextParams.delete('search');
    }
    setSearchParams(nextParams, { replace: true });
  }

  const closeSelectedItem = useCallback(() => {
    setSelectedItem(null);
    if (!itemParam) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('item');
    setSearchParams(nextParams, { replace: true });
  }, [itemParam, searchParams, setSearchParams]);

  const handleImageClick = useCallback((item: MenuItem) => {
    setSelectedItem(item);
  }, []);

  const handleAdd = useCallback((item: MenuItem) => {
    if (!item.is_available) {
      showToast(`${item.name} is currently out of stock`, 'error');
      return;
    }

    const supportsCustomizations = itemHasAssignedCustomizations(item, customizationAvailability);
    const cartItemId = addItem(item, 1, []);
    playAddToCartSound();
    showToast(`${item.name} added to cart!`);

    if (!supportsCustomizations) {
      return;
    }

    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: 1 });
  }, [addItem, customizationAvailability, showToast]);

  const handleBaseConfirm = useCallback((item: MenuItem, qty: number) => {
    if (!item.is_available) {
      showToast(`${item.name} is currently out of stock`, 'error');
      return;
    }

    const supportsCustomizations = itemHasAssignedCustomizations(item, customizationAvailability);
    const cartItemId = addItem(item, qty, []);
    playAddToCartSound();
    showToast(`${item.name} added to cart!`);
    setSelectedItem(null);
    if (itemParam) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('item');
      setSearchParams(nextParams, { replace: true });
    }
    if (!supportsCustomizations) {
      return;
    }
    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: qty });
  }, [addItem, customizationAvailability, itemParam, searchParams, setSearchParams, showToast]);
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((current) => (current[url] ? current : { ...current, [url]: true }));
  }, []);
  const categorySlugById = Object.fromEntries(categories.map((category) => [category.id, category.slug]));
  const menuItemsById = Object.fromEntries(items.map((item) => [item.id, { id: item.id, category_id: item.category_id }]));
  const activeBannerOffer = offers[bannerIdx] || null;
  const activeBannerDescription = activeBannerOffer ? getOfferDisplayDescription(activeBannerOffer) : null;
  const activeBannerReward = activeBannerOffer ? getOfferRewardLabel(activeBannerOffer) : null;
  const activeBannerCtaText = activeBannerOffer ? getOfferCtaText(activeBannerOffer) : 'Order Now';
  const activeBannerCtaHref = activeBannerOffer
    ? getOfferCtaHref(activeBannerOffer, { categorySlugById, menuItemsById })
    : '/menu';
  const requestedBannerBackgroundImage = normalizeImageUrl(activeBannerOffer?.background_image_url);
  const activeBannerBackgroundImage = requestedBannerBackgroundImage && !failedImageUrls[requestedBannerBackgroundImage]
    ? requestedBannerBackgroundImage
    : null;
  const shouldScrollBannerCta = activeBannerCtaHref === '/menu';

  useEffect(() => {
    if (loading || categories.length === 0) {
      return;
    }

    const highlightedItems = filteredItems.slice(0, 24);
    const menuDescription = currentCategory
      ? `Browse ${currentCategory.name} at ${seoSiteName}, including ${highlightedItems.slice(0, 4).map((item) => item.name).join(', ')}.`
      : `Browse the full ${seoSiteName} menu including waffles, shakes, chats, fries, momos, burgers, and desserts.`;
    const keywordSet = new Set([
      ...seoDefaultKeywords,
      ...(currentCategory ? [currentCategory.name.toLowerCase(), `${currentCategory.name.toLowerCase()} menu`] : ['full dessert menu', 'waffle shop menu']),
      ...highlightedItems.slice(0, 8).map((item) => item.name.toLowerCase()),
    ]);

    setNamedMeta('keywords', Array.from(keywordSet).join(', '));
    setNamedMeta('description', menuDescription);
    setPropertyMeta('og:description', menuDescription);
    setNamedMeta('twitter:description', menuDescription);

    const breadcrumbItems = [
      { name: 'Home', path: '/' },
      { name: 'Menu', path: '/menu' },
      ...(currentCategory ? [{ name: currentCategory.name, path: `/menu?category=${currentCategory.slug}` }] : []),
    ];

    const schema = buildSchemaGraph([
      {
        '@type': search.trim() ? 'SearchResultsPage' : 'CollectionPage',
        '@id': buildSeoUrl(`/menu${currentCategory ? `?category=${currentCategory.slug}` : ''}${search.trim() ? `${currentCategory ? '&' : '?'}search=${encodeURIComponent(search.trim())}` : ''}#webpage`),
        url: buildSeoUrl(`/menu${currentCategory ? `?category=${currentCategory.slug}` : ''}${search.trim() ? `${currentCategory ? '&' : '?'}search=${encodeURIComponent(search.trim())}` : ''}`),
        name: currentCategory ? `${currentCategory.name} Menu | ${seoSiteName}` : `${seoSiteName} Menu`,
        description: menuDescription,
        about: {
          '@type': 'Menu',
          name: currentCategory ? `${currentCategory.name} Menu Section` : `${seoSiteName} Menu`,
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          numberOfItems: highlightedItems.length,
          itemListElement: highlightedItems.map((item, index) => {
            const itemCategory = categories.find((category) => category.id === item.category_id);
            const itemUrl = `/menu?${new URLSearchParams({
              ...(itemCategory ? { category: itemCategory.slug } : {}),
              item: item.id,
            }).toString()}`;

            return {
              '@type': 'ListItem',
              position: index + 1,
              url: buildSeoUrl(itemUrl),
              item: {
                '@type': 'MenuItem',
                name: item.name,
                description: item.description,
                image: buildSeoUrl(item.image_url),
                offers: {
                  '@type': 'Offer',
                  priceCurrency: 'INR',
                  price: item.price.toFixed(2),
                  availability: item.is_available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                  url: buildSeoUrl(itemUrl),
                },
              },
            };
          }),
        },
      },
      {
        '@type': 'Menu',
        '@id': buildSeoUrl('/menu#live-menu'),
        name: `${seoSiteName} Menu`,
        hasMenuSection: categories.map((category) => ({
          '@type': 'MenuSection',
          name: category.name,
          url: buildSeoUrl(`/menu?category=${category.slug}`),
        })),
      },
      buildBreadcrumbSchema(breadcrumbItems),
    ]);

    setJsonLd('menu-search-schema', schema);

    return () => {
      setJsonLd('menu-search-schema');
    };
  }, [categories, currentCategory, filteredItems, loading, search]);

  return (
    <div className="min-h-screen bg-brand-bg">
      {activeBannerOffer ? (
        <section className="px-4 pt-4 pb-2">
          <div className="relative h-[240px] overflow-hidden rounded-[24px] border border-brand-border bg-brand-surface sm:h-[268px] lg:h-[308px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={bannerIdx}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {activeBannerBackgroundImage && (
                  <>
                    <img
                      src={activeBannerBackgroundImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-[76%_center] sm:object-center"
                      onError={() => markImageFailed(activeBannerBackgroundImage)}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,11,7,0.97)_0%,rgba(8,11,7,0.92)_34%,rgba(8,11,7,0.56)_58%,rgba(8,11,7,0.14)_100%)] sm:bg-[linear-gradient(90deg,rgba(8,11,7,0.96)_0%,rgba(8,11,7,0.84)_20%,rgba(8,11,7,0.54)_42%,rgba(8,11,7,0.2)_68%,rgba(8,11,7,0.08)_100%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,7,0.12)_0%,rgba(8,11,7,0.04)_42%,rgba(8,11,7,0.28)_100%)]" />
                    <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-40px_72px_rgba(0,0,0,0.2)]" />
                  </>
                )}
                {!activeBannerBackgroundImage && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-surface via-brand-surface-light to-brand-gold/10" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(216,178,78,0.18),_transparent_34%),radial-gradient(circle_at_75%_18%,_rgba(255,255,255,0.05),_transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
                  </>
                )}
                <div className="relative flex h-full items-end px-4 py-4 sm:items-center sm:px-7 sm:py-6 lg:px-10 lg:py-7">
                  <div className={activeBannerBackgroundImage ? 'max-w-[54%] sm:max-w-[340px] lg:max-w-[410px]' : 'max-w-xl'}>
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.35 }}
                      className="mb-2 inline-block rounded-md border border-brand-gold/15 bg-brand-gold/18 px-2 py-1 text-[10px] font-bold tracking-wide text-brand-gold sm:px-2.5 sm:text-[12px]"
                    >
                      {getOfferBadgeLabel(activeBannerOffer)}
                    </motion.span>
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="mb-1.5 text-[18px] font-extrabold leading-[1.02] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.28)] sm:text-[30px] lg:text-[34px]"
                    >
                      {activeBannerOffer.title}
                    </motion.h1>
                    {activeBannerDescription && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="mb-2.5 whitespace-pre-line text-[11.5px] font-medium leading-[1.28] text-white/84 drop-shadow-[0_3px_10px_rgba(0,0,0,0.24)] sm:mb-3 sm:text-[14px] sm:leading-snug lg:text-[15px]"
                      >
                        {activeBannerDescription}
                      </motion.p>
                    )}
                    {activeBannerReward && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25, duration: 0.35 }}
                        className="inline-block text-[16px] font-black tracking-tight text-brand-gold drop-shadow-[0_4px_14px_rgba(0,0,0,0.26)] sm:text-[24px] lg:text-[28px]"
                      >
                        {activeBannerReward}
                      </motion.span>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.35 }}
                      className="mt-3 sm:mt-4"
                    >
                      {shouldScrollBannerCta ? (
                        <button
                          type="button"
                          onClick={() => filterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-bg shadow-[0_14px_30px_rgba(216,178,78,0.18)] transition-all hover:-translate-y-0.5 hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-[14px]"
                        >
                          {activeBannerCtaText}
                        </button>
                      ) : (
                        <Link
                          to={activeBannerCtaHref}
                          className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-bg shadow-[0_14px_30px_rgba(216,178,78,0.18)] transition-all hover:-translate-y-0.5 hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-[14px]"
                        >
                          {activeBannerCtaText}
                        </Link>
                      )}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            {offers.length > 1 && (
              <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {offers.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setBannerIdx(i)}
                    className={`h-[3px] rounded-full transition-all duration-300 ${
                      i === bannerIdx ? 'w-6 bg-brand-gold' : 'w-2 bg-brand-text/25'
                    }`}
                    aria-label={`Show offer ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="section-padding pt-6 pb-2">
          <div className="max-w-3xl">
            <span className="section-label">Menu</span>
            <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
              Waffle Menu
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-text-muted sm:text-base">
              Browse handcrafted waffles, dessert combos, and shakes. Use search and sorting to find your picks faster.
            </p>
          </div>
        </section>
      )}

      <motion.div
        className="px-4 py-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center gap-3 text-[12px] font-semibold text-brand-text-dim">
          {[
            { icon: Clock, text: '10-min prep' },
            { icon: Sparkles, text: 'Fresh & Handcrafted' },
          ].map((item, i) => (
            <motion.div key={item.text} variants={staggerChild} className="flex items-center gap-1.5 whitespace-nowrap">
              {i > 0 && <span className="mr-1 text-brand-gold-muted">|</span>}
              <item.icon size={13} className="flex-shrink-0 text-brand-gold-muted" strokeWidth={2.2} />
              <span>{item.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div ref={filterBarRef} className="sticky top-[60px] z-30 border-b border-brand-border bg-brand-bg/95 backdrop-blur-xl lg:top-[68px]">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-gold" strokeWidth={2.5} />
              <input
                type="text"
                placeholder="Search waffles, shakes, and toppings..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input-field pl-11 text-[15px] font-medium"
                aria-label="Search menu items"
              />
              {search && (
                <button onClick={() => handleSearchChange('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-text-dim hover:text-white transition-colors">
                  <X size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
          {activeCategory === 'all' && !search.trim() && visibleSuggestedCategories.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-brand-gold/15 bg-[linear-gradient(135deg,rgba(216,178,78,0.12),rgba(19,27,17,0.96)_52%,rgba(216,178,78,0.04))] p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-gold/85">
                    {suggestedCategoryContext.title}
                  </p>
                  <p className="mt-1 max-w-2xl text-[12px] font-medium leading-relaxed text-brand-text-dim">
                    {suggestedCategoryContext.subtitle}
                  </p>
                </div>
                {suggestedCategoryContext.categories.length > 3 && (
                  <div className="flex gap-1.5 pt-1">
                    {suggestedCategoryContext.categories.map((category, index) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSuggestedCategoryIdx(index)}
                        className={`h-1.5 rounded-full transition-all ${
                          index === suggestedCategoryIdx ? 'w-5 bg-brand-gold' : 'w-1.5 bg-brand-gold/30'
                        }`}
                        aria-label={`Show suggestion ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {visibleSuggestedCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleCategoryChange(category.slug)}
                    className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1.5 text-[12px] font-bold text-brand-gold transition-all hover:border-brand-gold/45 hover:bg-brand-gold/15"
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide relative">
            <CategoryPill
              label="All"
              slug="all"
              active={activeCategory === 'all'}
              onClick={() => handleCategoryChange('all')}
            />
            {categories.map((cat) => (
              <CategoryPill
                key={cat.id}
                label={cat.name}
                slug={cat.slug}
                active={activeCategory === cat.slug}
                onClick={() => handleCategoryChange(cat.slug)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-semibold text-brand-text-dim">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={14} className="text-brand-text-dim" strokeWidth={2.5} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-[13px] bg-transparent font-bold text-brand-text-muted focus:outline-none cursor-pointer"
            >
              <option value="popular">Popular</option>
              <option value="price_low">Price: Low</option>
              <option value="price_high">Price: High</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 items-start">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Search size={24} className="text-brand-text-dim" strokeWidth={2.5} />
            </div>
            <h3 className="text-[17px] font-bold text-white mb-1.5">No waffles found</h3>
            <p className="text-brand-text-dim text-[14px] font-medium">Try adjusting your filters or search terms</p>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 items-start"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            key={`${activeCategory}-${sortBy}`}
          >
            {filteredItems.map((item) => (
              <motion.div key={item.id} variants={staggerChild} className="self-start">
                <ProductCard item={item} onImageClick={handleImageClick} onAdd={handleAdd} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedItem && (
          <CustomizationModal
            item={selectedItem}
            onClose={closeSelectedItem}
            onConfirm={(item, qty) => handleBaseConfirm(item, qty)}
            showCustomizations={false}
          />
        )}
        {pendingAddOnItem && (
          <CustomizationModal
            item={pendingAddOnItem.menuItem}
            initialQuantity={pendingAddOnItem.quantity}
            onClose={() => setPendingAddOnItem(null)}
            onConfirm={(item, qty, customizations) => {
              removeItem(pendingAddOnItem.cartItemId);
              addItem(item, qty, customizations);
              setPendingAddOnItem(null);
              showToast(`${item.name} add-ons updated!`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryPill({ label, active, onClick }: { label: string; slug: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative whitespace-nowrap px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${
        active
          ? 'text-brand-bg'
          : 'bg-brand-surface text-brand-text-muted border border-brand-border hover:border-brand-border'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeCategoryPill"
          className="absolute inset-0 bg-brand-gold rounded-lg"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
