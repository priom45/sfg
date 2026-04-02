import { useEffect, useState } from 'react';
import { Clock, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { MenuItem } from '../types';
import { useCart } from '../contexts/CartContext';

interface ProductCardProps {
  item: MenuItem;
  onImageClick: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

export default function ProductCard({ item, onImageClick, onAdd }: ProductCardProps) {
  const { items, updateQuantity, removeItem } = useCart();
  const [imageSrc, setImageSrc] = useState(item.image_url || '/image.png');

  const cartItems = items.filter((ci) => ci.menu_item.id === item.id);
  const totalQty = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);

  useEffect(() => {
    setImageSrc(item.image_url || '/image.png');
  }, [item.image_url]);

  if (item.is_available === false) {
    return null;
  }

  function handleIncrement() {
    if (totalQty === 0) {
      onAdd(item);
    } else {
      const last = cartItems[cartItems.length - 1];
      updateQuantity(last.id, last.quantity + 1);
    }
  }

  function handleDecrement() {
    if (totalQty <= 0) return;
    const last = cartItems[cartItems.length - 1];
    if (last.quantity <= 1) {
      removeItem(last.id);
    } else {
      updateQuantity(last.id, last.quantity - 1);
    }
  }

  function openImagePreview() {
    onImageClick(item);
  }

  return (
    <motion.div
      className="card group"
      whileHover={{ y: -5, boxShadow: '0 10px 26px rgba(8,12,7,0.44), 0 0 1px rgba(216,178,78,0.12)' }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <motion.button
        type="button"
        onClick={openImagePreview}
        whileTap={{ scale: 0.985 }}
        className="relative block w-full overflow-hidden bg-brand-surface-light aspect-[5/6] text-left"
        aria-label={`Open ${item.name}`}
      >
        <img
          src={imageSrc}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (imageSrc !== '/image.png') {
              setImageSrc('/image.png');
            }
          }}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-brand-overlay to-transparent" />
      </motion.button>

      <div className="p-3">
        <motion.h3
          className="min-h-[2.3rem] overflow-hidden break-words text-[15px] font-bold leading-[1.15] text-white"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.name}
        </motion.h3>

        <div className="flex items-center gap-1.5 mt-1">
          <Clock size={12} className="text-brand-text-dim" strokeWidth={2.2} />
          <span className="text-[12px] font-semibold text-brand-text-dim">{item.prep_time} min</span>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[17px] font-extrabold text-brand-gold tracking-tight">
            {'\u20B9'}{item.price}
          </span>

          <AnimatePresence mode="wait" initial={false}>
            {totalQty > 0 ? (
              <motion.div
                key="stepper"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-0 border-2 border-brand-gold rounded-lg overflow-hidden"
              >
                <motion.button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDecrement();
                  }}
                  whileTap={{ scale: 0.85 }}
                  className="w-8 h-8 flex items-center justify-center text-brand-gold hover:bg-brand-gold/10 transition-colors"
                >
                  <Minus size={16} strokeWidth={2.5} />
                </motion.button>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={totalQty}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="w-7 text-center text-[14px] font-extrabold text-brand-gold"
                  >
                    {totalQty}
                  </motion.span>
                </AnimatePresence>
                <motion.button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleIncrement();
                  }}
                  whileTap={{ scale: 0.85 }}
                  className="w-8 h-8 flex items-center justify-center text-brand-gold hover:bg-brand-gold/10 transition-colors"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                key="add"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdd(item);
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="border-2 border-brand-gold text-brand-gold text-[13px] font-extrabold px-4 py-1.5 rounded-lg
                           hover:bg-brand-gold hover:text-brand-bg transition-all"
              >
                ADD
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
