import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Flame, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import OfferCarousel from '../components/OfferCarousel';
import { expireStalePendingOrders } from '../lib/inventorySchema';
import { supabase } from '../lib/supabase';
import { sortCategoriesForMenu } from '../lib/categoryOrdering';
import { fetchMenuPopularity, type MenuPopularityContext } from '../lib/menuPopularity';
import { normalizeImageUrl, setImageFallback } from '../lib/images';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import ScrollReveal from '../components/ScrollReveal';
import { staggerContainer, staggerChild } from '../lib/animations';
import { fetchCustomizationAvailability, itemHasAssignedCustomizations, type CustomizationAvailability } from '../lib/customizations';
import type { Category, MenuItem, Offer } from '../types';

const seoFaqs = [
  {
    question: 'Where is The Supreme Waffle in Vijayawada?',
    answer: 'You can find The Supreme Waffle on Police Station Road, Kanuru, Vijayawada.',
  },
  {
    question: 'What can I order besides waffles?',
    answer: 'The menu also includes thick shakes, milkshakes, fries, momos, burgers, and dessert combos.',
  },
  {
    question: 'Can I order online for takeaway or dine-in pickup?',
    answer: 'Yes. The website supports online ordering for dine-in and takeaway pickup.',
  },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellers, setBestSellers] = useState<MenuItem[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [homeSearch, setHomeSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [popularityContext, setPopularityContext] = useState<MenuPopularityContext>({
    slotKey: 'all_day',
    title: 'Best Sellers',
    subtitle: 'Sorted from recent orders so the most-picked items rise to the top.',
    itemScores: {},
    fallbackItemScores: {},
    categoryScores: {},
    fallbackCategoryScores: {},
    rankedItems: [],
    rankedCategories: [],
    hasLiveData: false,
  });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pendingAddOnItem, setPendingAddOnItem] = useState<{ cartItemId: string; menuItem: MenuItem; quantity: number } | null>(null);
  const [customizationAvailability, setCustomizationAvailability] = useState<CustomizationAvailability | null>(null);
  const navigate = useNavigate();
  const { addItem, removeItem } = useCart();
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      await expireStalePendingOrders();
    } catch (error) {
      console.error('Failed to expire stale pending orders', error);
    }

    const [catRes, allRes, offerRes, availability] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
      supabase.from('offers').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(4),
      fetchCustomizationAvailability(),
    ]);
    const categoryData = catRes.data || [];
    const itemData = allRes.data || [];
    const visibleCategoryData = categoryData.filter((category) => (
      itemData.some((item) => item.category_id === category.id)
    ));

    if (catRes.data) setCategories(sortCategoriesForMenu(visibleCategoryData));
    if (allRes.data) setAllItems(allRes.data);
    if (offerRes.error) showToast(offerRes.error.message || 'Failed to load offers', 'error');
    setOffers(offerRes.data || []);
    setCustomizationAvailability(availability);

    const popularity = await fetchMenuPopularity(itemData, visibleCategoryData);
    setPopularityContext(popularity);
    setBestSellers(popularity.rankedItems.filter((item) => item.is_available !== false).slice(0, 12));
  }, [showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

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
    showToast(`${item.name} added to cart`);

    if (!supportsCustomizations) {
      return;
    }

    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: 1 });
  }, [addItem, customizationAvailability, showToast]);

  const handleConfirmAdd = useCallback((item: MenuItem, qty: number) => {
    if (!item.is_available) {
      showToast(`${item.name} is currently out of stock`, 'error');
      return;
    }

    const supportsCustomizations = itemHasAssignedCustomizations(item, customizationAvailability);
    const cartItemId = addItem(item, qty, []);
    showToast(`${item.name} added to cart`);
    setSelectedItem(null);
    if (!supportsCustomizations) {
      return;
    }
    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: qty });
  }, [addItem, customizationAvailability, showToast]);

  const itemsByCategory = useMemo(() => {
    const sortedCategories = [...categories].sort((left, right) => {
      const categoryScoreDelta = (popularityContext.categoryScores[right.id] || 0) - (popularityContext.categoryScores[left.id] || 0);
      if (categoryScoreDelta !== 0) return categoryScoreDelta;

      const fallbackCategoryDelta = (popularityContext.fallbackCategoryScores[right.id] || 0) - (popularityContext.fallbackCategoryScores[left.id] || 0);
      if (fallbackCategoryDelta !== 0) return fallbackCategoryDelta;

      return left.display_order - right.display_order;
    });

    return sortedCategories.map((category) => ({
      category,
      items: [...allItems.filter((item) => item.category_id === category.id && item.is_available !== false)].sort((left, right) => {
        const itemScoreDelta = (popularityContext.itemScores[right.id] || 0) - (popularityContext.itemScores[left.id] || 0);
        if (itemScoreDelta !== 0) return itemScoreDelta;

        const fallbackItemDelta = (popularityContext.fallbackItemScores[right.id] || 0) - (popularityContext.fallbackItemScores[left.id] || 0);
        if (fallbackItemDelta !== 0) return fallbackItemDelta;

        const ratingDelta = right.rating - left.rating;
        if (ratingDelta !== 0) return ratingDelta;

        return left.display_order - right.display_order;
      }),
    })).filter((group) => group.items.length > 0);
  }, [allItems, categories, popularityContext.categoryScores, popularityContext.fallbackCategoryScores, popularityContext.fallbackItemScores, popularityContext.itemScores]);
  const categorySlugById = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.slug])),
    [categories],
  );
  const averagePrepTime = useMemo(() => {
    if (allItems.length === 0) return 10;
    const totalPrepTime = allItems.reduce((sum, item) => sum + (item.prep_time || 0), 0);
    return Math.max(5, Math.round(totalPrepTime / allItems.length));
  }, [allItems]);
  const menuItemsById = useMemo(
    () => Object.fromEntries(allItems.map((item) => [item.id, { id: item.id, category_id: item.category_id }])),
    [allItems],
  );
  const heroStats = useMemo(() => ([
    { value: `${categories.length || 0}+`, label: 'Categories' },
    { value: `${allItems.length || 0}+`, label: 'Menu picks' },
    { value: `${averagePrepTime} min`, label: 'Avg prep' },
  ]), [allItems.length, averagePrepTime, categories.length]);
  const heroQuickLinks = useMemo(() => {
    if (categories.length > 0) {
      return categories.slice(0, 4).map((category) => ({
        label: category.name,
        to: `/menu?category=${category.slug}`,
      }));
    }

    return [
      { label: 'Waffles', to: '/menu?search=waffle' },
      { label: 'Shakes', to: '/menu?search=shake' },
      { label: 'Combos', to: '/menu?search=combo' },
      { label: 'Snacks', to: '/menu?search=fries' },
    ];
  }, [categories]);
  const homeSearchResults = useMemo(() => {
    const query = homeSearch.trim().toLowerCase();
    if (query.length < 2) return [];

    return allItems
      .filter((item) => (
        item.is_available !== false &&
        (
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        )
      ))
      .slice(0, 5);
  }, [allItems, homeSearch]);

  function handleHomeSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = homeSearch.trim();
    if (!query) return;
    navigate(`/menu?search=${encodeURIComponent(query)}`);
  }

  function openSearchItem(item: MenuItem) {
    navigate(`/menu?item=${encodeURIComponent(item.id)}`);
  }

  return (
    <div className="bg-brand-bg min-h-screen pb-20">
      <section className="px-4 pt-4 pb-3">
        <motion.div
          className="gloss-shell hero-grid overflow-hidden rounded-[30px] px-4 py-4 sm:px-7 sm:py-7"
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,247,214,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(113,154,84,0.2),transparent_34%)]" />
          <div className="pointer-events-none absolute -right-10 top-6 h-32 w-32 rounded-full bg-brand-gold/20 blur-3xl animate-pulse-soft" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-emerald-300/10 blur-3xl animate-float" />

          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <h1 className="sr-only">The Supreme Waffle menu with waffles, shakes, and snacks in Vijayawada</h1>

            <motion.div variants={staggerChild} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
              <div className="space-y-3">
                <form onSubmit={handleHomeSearchSubmit} className="relative">
                  <div className="gloss-shell overflow-visible rounded-[24px] bg-brand-surface/55 p-2 shadow-[0_20px_48px_rgba(8,12,7,0.26)]">
                    <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-black/10 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                      <Search size={18} className="shrink-0 text-brand-gold" strokeWidth={2.5} />
                      <input
                        type="text"
                        value={homeSearch}
                        onChange={(event) => setHomeSearch(event.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                        placeholder="Waffles, shakes..."
                        aria-label="Search menu items"
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-brand-text-dim sm:text-[15px]"
                      />
                      {homeSearch && (
                        <button
                          type="button"
                          onClick={() => setHomeSearch('')}
                          aria-label="Clear search"
                          className="shrink-0 rounded-lg p-1 text-brand-text-dim transition-colors hover:text-white"
                        >
                          <X size={17} strokeWidth={2.5} />
                        </button>
                      )}
                      <button
                        type="submit"
                        aria-label="Search menu"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#F0D487_0%,#D8B24E_58%,#B88629_100%)] text-brand-bg shadow-[0_14px_30px_rgba(216,178,78,0.18),inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform hover:-translate-y-0.5 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5"
                      >
                        <Search size={16} strokeWidth={2.7} className="sm:hidden" />
                        <span className="hidden text-[12px] font-black tracking-[0.12em] sm:inline">Search</span>
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {searchFocused && homeSearchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="gloss-shell absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-[22px] shadow-elevated"
                      >
                        {homeSearchResults.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              openSearchItem(item);
                            }}
                            className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.05] ${index < homeSearchResults.length - 1 ? 'border-b border-white/10' : ''}`}
                          >
                            <img
                              src={normalizeImageUrl(item.image_url)}
                              alt=""
                              className="h-11 w-11 rounded-xl object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={setImageFallback}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-white">{item.name}</span>
                              <span className="block text-xs font-semibold text-brand-gold">₹{item.price}</span>
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {searchFocused && homeSearch.trim().length >= 2 && homeSearchResults.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="gloss-shell absolute left-0 right-0 top-full z-30 mt-3 rounded-[22px] px-4 py-3 text-sm text-brand-text-muted shadow-elevated"
                      >
                        No instant matches found. Press <span className="font-bold text-white">Search</span> to open the full menu results for
                        {' '}
                        <span className="font-bold text-brand-gold">{homeSearch.trim()}</span>.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

                <div className="flex flex-wrap gap-2">
                  {heroQuickLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="gloss-chip max-w-[48%] px-3 py-1.5 text-[11px] text-white transition-colors hover:text-brand-gold sm:max-w-full sm:px-3.5 sm:py-2 sm:text-[12px]"
                    >
                      <span className="truncate">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {heroStats.map((stat) => (
                  <motion.div
                    key={stat.label}
                    variants={staggerChild}
                    className="rounded-[20px] border border-white/10 bg-black/10 px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:px-3"
                  >
                    <div className="gloss-dot mb-3" />
                    <p className="text-[16px] font-black leading-none text-white sm:text-[24px]">{stat.value}</p>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-brand-text-dim sm:text-[11px] sm:tracking-[0.12em]">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {offers.length > 0 && (
        <section className="px-4 pt-1 pb-2">
          <OfferCarousel
            offers={offers}
            categorySlugById={categorySlugById}
            menuItemsById={menuItemsById}
          />
        </section>
      )}

      {categories.length > 0 && (
        <ScrollReveal>
          <section className="px-4 pt-3 pb-1">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="section-label">Pick a lane</p>
                <h2 className="mt-1 text-[18px] font-bold text-white">What are you craving?</h2>
              </div>
            </div>
            <motion.div
              className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              {categories.map((cat) => (
                <motion.div key={cat.id} variants={staggerChild}>
                  <Link
                    to={`/menu?category=${cat.slug}`}
                    className="group flex w-[88px] flex-shrink-0 flex-col items-center gap-2"
                  >
                    <div className="glow-border h-[72px] w-[72px] overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-1 transition-all group-hover:-translate-y-1 group-hover:border-brand-gold/40">
                      <img
                        src={normalizeImageUrl(cat.image_url)}
                        alt={`${cat.name} waffle category`}
                        loading="lazy"
                        decoding="async"
                        onError={setImageFallback}
                        className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <span
                      className="min-h-[2rem] overflow-hidden break-words text-center text-[12px] font-bold leading-tight text-brand-text-muted transition-colors group-hover:text-brand-gold"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {cat.name}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>
        </ScrollReveal>
      )}

      {bestSellers.length > 0 && (
        <ScrollReveal>
          <HorizontalRail
            icon={<Flame size={18} className="text-orange-400" strokeWidth={2.5} />}
            title={popularityContext.title}
            subtitle={popularityContext.subtitle}
            items={bestSellers}
            onImageClick={handleImageClick}
            onAdd={handleAdd}
            linkTo="/menu"
          />
        </ScrollReveal>
      )}

      {itemsByCategory.map((group, idx) => (
        <ScrollReveal key={group.category.id} delay={idx * 0.05}>
          <HorizontalRail
            title={group.category.name}
            items={group.items}
            onImageClick={handleImageClick}
            onAdd={handleAdd}
            linkTo={`/menu?category=${group.category.slug}`}
          />
        </ScrollReveal>
      ))}

      <ScrollReveal>
        <section className="px-4 pt-5 pb-2">
          <div className="gloss-shell rounded-[28px] px-5 py-5 sm:px-6">
            <p className="section-label">Common Questions</p>
            <h2 className="mt-2 text-[22px] font-black text-white">Local waffle search answers</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {seoFaqs.map((item) => (
                <article
                  key={item.question}
                  className="rounded-[22px] border border-white/10 bg-black/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <h3 className="text-[15px] font-bold text-white">{item.question}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-brand-text-muted">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <AnimatePresence>
        {selectedItem && (
          <CustomizationModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onConfirm={(item, qty) => handleConfirmAdd(item, qty)}
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
              showToast(`${item.name} add-ons updated`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HorizontalRail({
  icon,
  title,
  subtitle,
  items,
  onImageClick,
  onAdd,
  linkTo,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  items: MenuItem[];
  onImageClick: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
  linkTo: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    return () => el.removeEventListener('scroll', updateArrows);
  }, [items]);

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  return (
    <section className="pt-4 pb-1">
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="text-[18px] font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] font-medium text-brand-text-dim">{subtitle}</p>
            )}
          </div>
        </div>
        <Link to={linkTo} className="gloss-chip text-brand-gold transition-all hover:gap-1.5">
          See All <ChevronRight size={15} strokeWidth={2.5} />
        </Link>
      </div>
      <div className="relative group/rail">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 snap-x snap-mandatory"
        >
          {items.map((item) => (
            <div key={item.id} className="w-[44vw] min-w-[176px] sm:w-48 lg:w-52 flex-shrink-0 snap-start">
              <ProductCard item={item} onImageClick={onImageClick} onAdd={onAdd} />
            </div>
          ))}
        </div>
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-brand-surface/85 text-white opacity-0 shadow-elevated backdrop-blur-xl transition-all hover:bg-brand-surface-light group-hover/rail:opacity-100 lg:flex"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-brand-surface/85 text-white opacity-0 shadow-elevated backdrop-blur-xl transition-all hover:bg-brand-surface-light group-hover/rail:opacity-100 lg:flex"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </section>
  );
}
