import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Category, MenuItem } from '../types';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../components/Toast';
import { playAddToCartSound } from '../lib/sounds';
import { staggerContainer, staggerChild } from '../lib/animations';

export default function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');
  const [vegOnly, setVegOnly] = useState(false);
  const [egglessOnly, setEgglessOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'price_low' | 'price_high'>('popular');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { addItem } = useCart();
  const { showToast } = useToast();
  const categoryParam = searchParams.get('category') || 'all';

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    setActiveCategory(categoryParam);
  }, [categoryParam]);

  async function loadData() {
    const [catRes, itemRes] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setItems(itemRes.data);
    setLoading(false);
  }

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
    if (vegOnly) result = result.filter((i) => i.is_veg);
    if (egglessOnly) result = result.filter((i) => i.is_eggless);
    switch (sortBy) {
      case 'price_low': result.sort((a, b) => a.price - b.price); break;
      case 'price_high': result.sort((a, b) => b.price - a.price); break;
      default: result.sort((a, b) => b.rating - a.rating);
    }
    return result;
  }, [items, categories, activeCategory, search, vegOnly, egglessOnly, sortBy]);

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === 'all') {
      return 'Waffle Menu';
    }

    return categories.find((category) => category.slug === activeCategory)?.name || humanizeCategory(activeCategory);
  }, [activeCategory, categories]);

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

  return (
    <div className="min-h-screen bg-brand-bg">
      <section className="section-padding pt-6 pb-2">
        <div className="max-w-3xl">
          <span className="section-label">Menu</span>
          <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
            {activeCategory === 'all' ? 'Waffle Menu' : `${activeCategoryLabel} Menu`}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-text-muted sm:text-base">
            Browse handcrafted waffles, dessert combos, and shakes. Use filters to find bestselling, veg, or eggless options faster.
          </p>
        </div>
      </section>

      <div className="bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border sticky top-[60px] lg:top-[68px] z-30">
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
                autoFocus
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
          <div className="flex items-center gap-2.5">
            <motion.button
              onClick={() => setVegOnly(!vegOnly)}
              whileTap={{ scale: 0.93 }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-all ${
                vegOnly ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-brand-surface text-brand-text-dim border border-brand-border'
              }`}
            >
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 rounded-sm flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              </div>
              Veg
            </motion.button>
            <motion.button
              onClick={() => setEgglessOnly(!egglessOnly)}
              whileTap={{ scale: 0.93 }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-all ${
                egglessOnly ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30' : 'bg-brand-surface text-brand-text-dim border border-brand-border'
              }`}
            >
              Eggless
            </motion.button>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
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
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            key={`${activeCategory}-${vegOnly}-${egglessOnly}-${sortBy}`}
          >
            {filteredItems.map((item) => (
              <motion.div key={item.id} variants={staggerChild}>
                <ProductCard item={item} onAdd={setSelectedItem} />
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
            onConfirm={(item, qty, customizations) => {
              addItem(item, qty, customizations);
              setSelectedItem(null);
              playAddToCartSound();
              showToast(`${item.name} added to cart!`);
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

function humanizeCategory(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
