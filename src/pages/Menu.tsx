import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Category, MenuItem, Offer } from '../types';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import { playAddToCartSound } from '../lib/sounds';
import { staggerContainer, staggerChild } from '../lib/animations';
import { fetchCustomizationAvailability, itemHasAssignedCustomizations, type CustomizationAvailability } from '../lib/customizations';
import { getOfferBadgeLabel, getOfferDisplayDescription, getOfferRewardLabel } from '../lib/offers';

function normalizeImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export default function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');
  const [sortBy, setSortBy] = useState<'popular' | 'price_low' | 'price_high'>('popular');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pendingAddOnItem, setPendingAddOnItem] = useState<{ cartItemId: string; menuItem: MenuItem; quantity: number } | null>(null);
  const [customizationAvailability, setCustomizationAvailability] = useState<CustomizationAvailability | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const bannerTimer = useRef<ReturnType<typeof setInterval>>();
  const filterBarRef = useRef<HTMLDivElement>(null);
  const { addItem, removeItem } = useCart();
  const { showToast } = useToast();
  const categoryParam = searchParams.get('category') || 'all';

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
      default: result.sort((a, b) => b.rating - a.rating);
    }
    return result;
  }, [items, categories, activeCategory, search, sortBy]);

  function handleCategoryChange(slug: string) {
    setActiveCategory(slug);
    const nextParams = new URLSearchParams(searchParams);
    if (slug === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', slug);
    }
    setSearchParams(nextParams);
  }

  const handleImageClick = useCallback((item: MenuItem) => {
    setSelectedItem(item);
  }, []);

  const handleAdd = useCallback((item: MenuItem) => {
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
    const supportsCustomizations = itemHasAssignedCustomizations(item, customizationAvailability);
    const cartItemId = addItem(item, qty, []);
    setSelectedItem(null);
    playAddToCartSound();
    showToast(`${item.name} added to cart!`);
    if (!supportsCustomizations) {
      return;
    }
    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: qty });
  }, [addItem, customizationAvailability, showToast]);
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((current) => (current[url] ? current : { ...current, [url]: true }));
  }, []);
  const activeBannerOffer = offers[bannerIdx] || null;
  const activeBannerDescription = activeBannerOffer ? getOfferDisplayDescription(activeBannerOffer) : null;
  const activeBannerReward = activeBannerOffer ? getOfferRewardLabel(activeBannerOffer) : null;
  const requestedBannerBackgroundImage = normalizeImageUrl(activeBannerOffer?.background_image_url);
  const activeBannerBackgroundImage = requestedBannerBackgroundImage && !failedImageUrls[requestedBannerBackgroundImage]
    ? requestedBannerBackgroundImage
    : null;

  return (
    <div className="min-h-screen bg-brand-bg">
      {activeBannerOffer ? (
        <section className="px-4 pt-4 pb-2">
          <div className="relative h-[228px] overflow-hidden rounded-[24px] border border-brand-border bg-brand-surface sm:h-[268px] lg:h-[308px]">
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
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      onError={() => markImageFailed(activeBannerBackgroundImage)}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(216,178,78,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_24%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,14,8,0.82)_0%,rgba(10,14,8,0.68)_26%,rgba(10,14,8,0.34)_54%,rgba(10,14,8,0.18)_100%)]" />
                    <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-32px_60px_rgba(0,0,0,0.18)]" />
                  </>
                )}
                {!activeBannerBackgroundImage && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-surface via-brand-surface-light to-brand-gold/10" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(216,178,78,0.18),_transparent_34%),radial-gradient(circle_at_75%_18%,_rgba(255,255,255,0.05),_transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
                  </>
                )}
                <div className="relative flex h-full items-end px-5 py-5 sm:px-7 sm:py-6 lg:py-7">
                  <div className={`rounded-[22px] border px-5 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] ${
                    activeBannerBackgroundImage
                      ? 'max-w-[320px] border-white/10 bg-[#10170d]/58 backdrop-blur-md sm:max-w-[360px] lg:max-w-[390px]'
                      : 'max-w-xl border-brand-border bg-brand-surface/45'
                  }`}>
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.35 }}
                      className="mb-1.5 inline-block rounded-md bg-brand-gold/20 px-2.5 py-1 text-[12px] font-bold tracking-wide text-brand-gold"
                    >
                      {getOfferBadgeLabel(activeBannerOffer)}
                    </motion.span>
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="mb-1 text-[22px] font-extrabold leading-tight text-white sm:text-[28px]"
                    >
                      {activeBannerOffer.title}
                    </motion.h1>
                    {activeBannerDescription && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="mb-3 whitespace-pre-line text-[13px] font-medium leading-snug text-brand-text-muted sm:text-[14px]"
                      >
                        {activeBannerDescription}
                      </motion.p>
                    )}
                    {activeBannerReward && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25, duration: 0.35 }}
                        className="inline-block text-[22px] font-black tracking-tight text-brand-gold"
                      >
                        {activeBannerReward}
                      </motion.span>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.35 }}
                      className="mt-4"
                    >
                      <button
                        type="button"
                        onClick={() => filterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-gold px-5 py-2.5 text-[14px] font-bold text-brand-bg transition-all hover:brightness-110"
                      >
                        Order Now
                      </button>
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
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-11 text-[15px] font-medium"
                aria-label="Search menu items"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-text-dim hover:text-white transition-colors">
                  <X size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
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
            onClose={() => setSelectedItem(null)}
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
