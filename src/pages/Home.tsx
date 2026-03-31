import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Clock, Sparkles, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { getOfferBadgeLabel, getOfferCtaText, getOfferDisplayDescription, getOfferRewardLabel } from '../lib/offers';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import ScrollReveal from '../components/ScrollReveal';
import { staggerContainer, staggerChild } from '../lib/animations';
import { fetchCustomizationAvailability, itemHasAssignedCustomizations, type CustomizationAvailability } from '../lib/customizations';
import type { Category, MenuItem, Offer } from '../types';

function normalizeImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellers, setBestSellers] = useState<MenuItem[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pendingAddOnItem, setPendingAddOnItem] = useState<{ cartItemId: string; menuItem: MenuItem; quantity: number } | null>(null);
  const [customizationAvailability, setCustomizationAvailability] = useState<CustomizationAvailability | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const bannerTimer = useRef<ReturnType<typeof setInterval>>();
  const { addItem, removeItem } = useCart();
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const [catRes, bestRes, allRes, offerRes, availability] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('rating', { ascending: false }).limit(10),
      supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
      supabase.from('offers').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(4),
      fetchCustomizationAvailability(),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (bestRes.data) setBestSellers(bestRes.data);
    if (allRes.data) setAllItems(allRes.data);
    if (offerRes.error) showToast(offerRes.error.message || 'Failed to load offers', 'error');
    setOffers(offerRes.data || []);
    setCustomizationAvailability(availability);
  }, [showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

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

  const handleImageClick = useCallback((item: MenuItem) => {
    setSelectedItem(item);
  }, []);

  const handleAdd = useCallback((item: MenuItem) => {
    const supportsCustomizations = itemHasAssignedCustomizations(item, customizationAvailability);
    const cartItemId = addItem(item, 1, []);
    showToast(`${item.name} added to cart`);

    if (!supportsCustomizations) {
      return;
    }

    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: 1 });
  }, [addItem, customizationAvailability, showToast]);

  const handleConfirmAdd = useCallback((item: MenuItem, qty: number) => {
    const supportsCustomizations = itemHasAssignedCustomizations(item, customizationAvailability);
    const cartItemId = addItem(item, qty, []);
    showToast(`${item.name} added to cart`);
    setSelectedItem(null);
    if (!supportsCustomizations) {
      return;
    }
    setPendingAddOnItem({ cartItemId, menuItem: item, quantity: qty });
  }, [addItem, customizationAvailability, showToast]);
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((current) => (current[url] ? current : { ...current, [url]: true }));
  }, []);

  const itemsByCategory = categories.map((cat) => ({
    category: cat,
    items: allItems.filter((it) => it.category_id === cat.id),
  })).filter((g) => g.items.length > 0);
  const activeBannerOffer = offers[bannerIdx] || null;
  const activeBannerDescription = activeBannerOffer ? getOfferDisplayDescription(activeBannerOffer) : null;
  const activeBannerReward = activeBannerOffer ? getOfferRewardLabel(activeBannerOffer) : null;
  const activeBannerCtaText = activeBannerOffer ? getOfferCtaText(activeBannerOffer) : 'Order Now';
  const requestedBannerBackgroundImage = normalizeImageUrl(activeBannerOffer?.background_image_url);
  const activeBannerBackgroundImage = requestedBannerBackgroundImage && !failedImageUrls[requestedBannerBackgroundImage]
    ? requestedBannerBackgroundImage
    : null;

  return (
    <div className="bg-brand-bg min-h-screen pb-20">
      {activeBannerOffer && (
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
                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="mb-1.5 text-[18px] font-extrabold leading-[1.02] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.28)] sm:text-[30px] lg:text-[34px]"
                    >
                      {activeBannerOffer.title}
                    </motion.h3>
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
                      <Link
                        to="/menu"
                        className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-bg shadow-[0_14px_30px_rgba(216,178,78,0.18)] transition-all hover:-translate-y-0.5 hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-[14px]"
                      >
                        {activeBannerCtaText}
                      </Link>
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
                  />
                ))}
              </div>
            )}
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
              {i > 0 && <span className="text-brand-gold-muted mr-1">|</span>}
              <item.icon size={13} className="text-brand-gold-muted flex-shrink-0" strokeWidth={2.2} />
              <span>{item.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {categories.length > 0 && (
        <ScrollReveal>
          <section className="px-4 pt-3 pb-1">
            <h2 className="text-[18px] font-bold text-white mb-3">What are you craving?</h2>
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
                    className="flex w-[84px] flex-shrink-0 flex-col items-center gap-1.5 group"
                  >
                    <div className="w-[68px] h-[68px] rounded-full overflow-hidden border-2 border-brand-border group-hover:border-brand-gold/50 transition-all">
                      <img
                        src={cat.image_url}
                        alt={`${cat.name} waffle category`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
            title="Best Sellers"
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
  items,
  onImageClick,
  onAdd,
  linkTo,
}: {
  icon?: React.ReactNode;
  title: string;
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
      <div className="px-4 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[18px] font-bold text-white">{title}</h2>
        </div>
        <Link to={linkTo} className="text-brand-gold text-[13px] font-bold flex items-center gap-0.5 hover:gap-1.5 transition-all">
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
            className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-surface border border-brand-border rounded-full items-center justify-center text-white hover:bg-brand-surface-light opacity-0 group-hover/rail:opacity-100 transition-all shadow-elevated z-10"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-surface border border-brand-border rounded-full items-center justify-center text-white hover:bg-brand-surface-light opacity-0 group-hover/rail:opacity-100 transition-all shadow-elevated z-10"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </section>
  );
}
