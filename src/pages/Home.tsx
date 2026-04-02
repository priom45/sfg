import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Clock, Sparkles, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import OfferCarousel from '../components/OfferCarousel';
import { supabase } from '../lib/supabase';
import { sortCategoriesForMenu } from '../lib/categoryOrdering';
import { fetchMenuPopularity, type MenuPopularityContext } from '../lib/menuPopularity';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import ScrollReveal from '../components/ScrollReveal';
import { staggerContainer, staggerChild } from '../lib/animations';
import { fetchCustomizationAvailability, itemHasAssignedCustomizations, type CustomizationAvailability } from '../lib/customizations';
import type { Category, MenuItem, Offer } from '../types';

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellers, setBestSellers] = useState<MenuItem[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
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
  const { addItem, removeItem } = useCart();
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const [catRes, allRes, offerRes, availability] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
      supabase.from('offers').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(4),
      fetchCustomizationAvailability(),
    ]);
    const categoryData = catRes.data || [];
    const itemData = allRes.data || [];

    if (catRes.data) setCategories(sortCategoriesForMenu(catRes.data));
    if (allRes.data) setAllItems(allRes.data);
    if (offerRes.error) showToast(offerRes.error.message || 'Failed to load offers', 'error');
    setOffers(offerRes.data || []);
    setCustomizationAvailability(availability);

    const popularity = await fetchMenuPopularity(itemData, categoryData);
    setPopularityContext(popularity);
    setBestSellers(popularity.rankedItems.slice(0, 12));
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
      items: [...allItems.filter((item) => item.category_id === category.id)].sort((left, right) => {
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
  const menuItemsById = useMemo(
    () => Object.fromEntries(allItems.map((item) => [item.id, { id: item.id, category_id: item.category_id }])),
    [allItems],
  );

  return (
    <div className="bg-brand-bg min-h-screen pb-20">
      {offers.length > 0 && (
        <section className="px-4 pt-4 pb-2">
          <OfferCarousel
            offers={offers}
            categorySlugById={categorySlugById}
            menuItemsById={menuItemsById}
          />
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
            title={popularityContext.title}
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
      <div className="px-4 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="text-[18px] font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] font-medium text-brand-text-dim">{subtitle}</p>
            )}
          </div>
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
