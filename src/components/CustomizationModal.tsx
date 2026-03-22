import { useState, useEffect } from 'react';
import { X, Minus, Plus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import type { MenuItem, CustomizationGroup, CustomizationOption, SelectedCustomization } from '../types';
import { supabase } from '../lib/supabase';
import { modalOverlay, modalSheet } from '../lib/animations';

interface Props {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (item: MenuItem, quantity: number, customizations: SelectedCustomization[]) => void;
}

export default function CustomizationModal({ item, onClose, onConfirm }: Props) {
  const [groups, setGroups] = useState<(CustomizationGroup & { options: CustomizationOption[] })[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomizations();
  }, []);

  async function loadCustomizations() {
    const { data: groupsData } = await supabase
      .from('customization_groups')
      .select('*')
      .order('display_order');

    if (groupsData) {
      const { data: optionsData } = await supabase
        .from('customization_options')
        .select('*')
        .eq('is_available', true)
        .order('display_order');

      const grouped = groupsData.map((g) => ({
        ...g,
        options: (optionsData || []).filter((o) => o.group_id === g.id),
      }));
      setGroups(grouped);
    }
    setLoading(false);
  }

  function toggleOption(groupId: string, optionId: string, selectionType: string) {
    setSelected((prev) => {
      const current = prev[groupId] || [];
      if (selectionType === 'single') {
        return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      }
      return {
        ...prev,
        [groupId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId],
      };
    });
  }

  function getSelectedCustomizations(): SelectedCustomization[] {
    const result: SelectedCustomization[] = [];
    for (const group of groups) {
      const selectedIds = selected[group.id] || [];
      for (const optionId of selectedIds) {
        const option = group.options.find((o) => o.id === optionId);
        if (option) {
          result.push({ group_name: group.name, option_name: option.name, price: option.price });
        }
      }
    }
    return result;
  }

  const customizationsTotal = getSelectedCustomizations().reduce((sum, c) => sum + c.price, 0);
  const totalPrice = (item.price + customizationsTotal) * quantity;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <motion.div
        variants={modalOverlay}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 bg-brand-overlay backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        variants={modalSheet}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative bg-brand-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[80vh] sm:max-h-[90vh] flex flex-col shadow-elevated border border-brand-border mb-16 sm:mb-0"
      >
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <div>
            <h3 className="font-extrabold text-[18px] text-white">{item.name}</h3>
            <p className="text-[14px] font-semibold text-brand-text-dim">{'\u20B9'}{item.price} base price</p>
          </div>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.85 }}
            className="p-2 hover:bg-brand-surface-light/70 rounded-xl transition-colors"
          >
            <X size={22} className="text-brand-text-dim" strokeWidth={2.5} />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-brand-surface-light rounded w-24 mb-3" />
                  <div className="space-y-2">
                    <div className="h-12 bg-brand-surface-light/70 rounded-xl" />
                    <div className="h-12 bg-brand-surface-light/70 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-brand-text-dim text-sm text-center py-4">No customization options available</p>
          ) : (
            groups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-bold text-[15px] text-white">{group.name}</h4>
                  <span className="text-[13px] font-semibold text-brand-text-dim">
                    {group.selection_type === 'single' ? 'Choose one' : 'Choose multiple'}
                  </span>
                  {group.is_required && (
                    <span className="text-[13px] text-brand-gold font-bold">Required</span>
                  )}
                </div>
                <div className="space-y-2">
                  {group.options.map((option) => {
                    const isSelected = (selected[group.id] || []).includes(option.id);
                    return (
                      <motion.button
                        key={option.id}
                        onClick={() => toggleOption(group.id, option.id, group.selection_type)}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? 'border-brand-gold bg-brand-gold/10'
                            : 'border-brand-border hover:border-brand-border-strong'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={isSelected ? { scale: 1, backgroundColor: '#D8B24E', borderColor: '#D8B24E' } : { scale: 1, backgroundColor: 'transparent', borderColor: '#869078' }}
                            transition={{ duration: 0.2 }}
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                              >
                                <Check size={12} className="text-brand-bg" />
                              </motion.div>
                            )}
                          </motion.div>
                          <span className="text-[14px] font-semibold text-white">{option.name}</span>
                        </div>
                        {option.price > 0 && (
                          <span className="text-[14px] font-bold text-brand-text-muted">+{'\u20B9'}{option.price}</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex-shrink-0 border-t border-brand-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4">
          <div className="flex items-center justify-center gap-5">
            <motion.button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              whileTap={{ scale: 0.85 }}
              className="w-10 h-10 rounded-xl border border-brand-border flex items-center justify-center text-white hover:border-brand-gold/30 transition-colors"
            >
              <Minus size={16} />
            </motion.button>
            <span className="text-[20px] font-extrabold w-8 text-center tabular-nums text-white">{quantity}</span>
            <motion.button
              onClick={() => setQuantity(quantity + 1)}
              whileTap={{ scale: 0.85 }}
              className="w-10 h-10 rounded-xl bg-brand-gold text-brand-bg flex items-center justify-center hover:brightness-110 transition-all"
            >
              <Plus size={16} />
            </motion.button>
          </div>

          {customizationsTotal > 0 && (
            <div className="flex items-center justify-center gap-2 text-[12px] text-brand-text-dim">
              <span>Base {'\u20B9'}{item.price}</span>
              <span className="text-brand-text-dim/50">+</span>
              <span>Add-ons {'\u20B9'}{customizationsTotal}</span>
              {quantity > 1 && (
                <>
                  <span className="text-brand-text-dim/50">x</span>
                  <span>{quantity}</span>
                </>
              )}
            </div>
          )}

          <motion.button
            onClick={() => onConfirm(item, quantity, getSelectedCustomizations())}
            whileTap={{ scale: 0.97 }}
            className="btn-primary w-full text-center flex items-center justify-center gap-2"
          >
            <span>Add to Cart</span>
            <span className="font-extrabold">{'\u20B9'}{totalPrice.toFixed(0)}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
