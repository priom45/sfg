import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useToast } from '../../components/Toast';
import CustomizationAssignmentsManager from '../../components/admin/CustomizationAssignmentsManager';
import { supabase } from '../../lib/supabase';
import type { Category, MenuItem } from '../../types';

interface ItemForm {
  id?: string;
  name: string;
  description: string;
  price: string;
  category_id: string;
  image_url: string;
  prep_time: string;
  is_veg: boolean;
  is_eggless: boolean;
  is_available: boolean;
}

interface CategoryForm {
  id?: string;
  name: string;
  slug: string;
  image_url: string;
}

const emptyItem: ItemForm = {
  name: '', description: '', price: '', category_id: '', image_url: '',
  prep_time: '10', is_veg: false, is_eggless: false, is_available: true,
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  slug: '',
  image_url: '',
};

function isForeignKeyConstraintError(error: { code?: string; message?: string } | null) {
  return error?.code === '23503';
}

function normalizeImageUrl(url: string) {
  const trimmedUrl = url.trim();
  const malformedExtensionSuffixMatch = trimmedUrl.match(/^(https?:\/\/\S+\.(?:png|jpe?g|webp|gif|svg))(?:\d+)$/i);
  return malformedExtensionSuffixMatch?.[1] || trimmedUrl;
}

function normalizeItemName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

async function repairMalformedMenuItemImageUrls(items: MenuItem[]) {
  const corrections = items
    .map((item) => ({
      id: item.id,
      currentImageUrl: item.image_url || '',
      normalizedImageUrl: normalizeImageUrl(item.image_url || ''),
    }))
    .filter((item) => item.currentImageUrl && item.currentImageUrl !== item.normalizedImageUrl);

  if (corrections.length === 0) {
    return { repairedCount: 0, error: null as string | null };
  }

  const results = await Promise.all(
    corrections.map((item) => (
      supabase
        .from('menu_items')
        .update({ image_url: item.normalizedImageUrl })
        .eq('id', item.id)
    )),
  );

  const firstError = results.find((result) => result.error)?.error;
  return {
    repairedCount: firstError ? 0 : corrections.length,
    error: firstError?.message || null,
  };
}

export default function AdminMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategoryForm);
  const [showCatForm, setShowCatForm] = useState(false);
  const categoryFormRef = useRef<HTMLDivElement | null>(null);
  const itemFormRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const [catRes, itemRes] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').order('display_order'),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) {
      const normalizedItems = itemRes.data.map((item) => ({
        ...item,
        image_url: normalizeImageUrl(item.image_url || ''),
      }));
      setItems(normalizedItems);

      const repairResult = await repairMalformedMenuItemImageUrls(itemRes.data);
      if (repairResult.error) {
        showToast(repairResult.error, 'error');
      } else if (repairResult.repairedCount > 0) {
        showToast(`Fixed ${repairResult.repairedCount} broken image URL${repairResult.repairedCount > 1 ? 's' : ''}`);
      }
    }
    if (catRes.error) {
      showToast(catRes.error.message || 'Failed to load categories', 'error');
    }
    if (itemRes.error) {
      showToast(itemRes.error.message || 'Failed to load menu items', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!showCatForm) return;
    categoryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showCatForm]);

  useEffect(() => {
    if (!editing) return;
    itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  const sortedItems = [...items].sort((a, b) => {
    if (a.is_available !== b.is_available) {
      return Number(b.is_available) - Number(a.is_available);
    }

    return a.display_order - b.display_order;
  });
  const categoryItemCountById = Object.fromEntries(
    categories.map((category) => [
      category.id,
      items.filter((item) => item.category_id === category.id).length,
    ]),
  );
  const categoryAvailableItemCountById = Object.fromEntries(
    categories.map((category) => [
      category.id,
      items.filter((item) => item.category_id === category.id && item.is_available).length,
    ]),
  );

  async function saveItem() {
    if (!editing) return;

    if (!editing.name.trim()) {
      showToast('Item name is required', 'error');
      return;
    }

    if (!editing.category_id) {
      showToast('Select a category before saving the item', 'error');
      return;
    }

    const payload = {
      name: normalizeItemName(editing.name),
      description: editing.description,
      price: parseFloat(editing.price) || 0,
      category_id: editing.category_id,
      image_url: normalizeImageUrl(editing.image_url),
      prep_time: parseInt(editing.prep_time) || 10,
      is_veg: editing.is_veg,
      is_eggless: editing.is_eggless,
      is_available: editing.is_available,
      display_order: editing.id
        ? undefined
        : items.reduce((maxOrder, item) => Math.max(maxOrder, item.display_order), -1) + 1,
    };

    const actionLabel = editing.id ? 'update' : 'add';
    const { error } = editing.id
      ? await supabase.from('menu_items').update(payload).eq('id', editing.id)
      : await supabase.from('menu_items').insert(payload);

    if (error) {
      showToast(error.message || `Failed to ${actionLabel} item`, 'error');
      return;
    }

    if (editing.id) {
      showToast('Item updated');
    } else {
      showToast('Item added');
    }
    setEditing(null);
    await loadData();
  }

  async function deleteItem(id: string) {
    const currentItem = items.find((item) => item.id === id);
    const { error } = await supabase.from('menu_items').delete().eq('id', id);

    if (isForeignKeyConstraintError(error)) {
      const { error: archiveError } = await supabase
        .from('menu_items')
        .update({ is_available: false })
        .eq('id', id);

      if (archiveError) {
        showToast(archiveError.message || 'Failed to archive item', 'error');
        return;
      }

      showToast(
        currentItem?.is_available === false
          ? 'This item is already removed from the menu'
          : 'This item exists in past orders, so it was removed from the menu',
      );
      await loadData();
      return;
    }

    if (error) {
      showToast(error.message || 'Failed to delete item', 'error');
      return;
    }
    showToast('Item deleted');
    await loadData();
  }

  async function toggleItemAvailability(item: MenuItem, nextAvailability: boolean) {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: nextAvailability })
      .eq('id', item.id);

    if (error) {
      showToast(error.message || `Failed to mark ${item.name} as ${nextAvailability ? 'in stock' : 'out of stock'}`, 'error');
      return;
    }

    showToast(nextAvailability ? `${item.name} is now in stock` : `${item.name} marked out of stock`);
    await loadData();
  }

  async function toggleCategoryAvailability(category: Category, nextAvailability: boolean) {
    const categoryItemCount = categoryItemCountById[category.id] || 0;

    if (categoryItemCount === 0) {
      showToast('This category has no items yet', 'error');
      return;
    }

    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: nextAvailability })
      .eq('category_id', category.id);

    if (error) {
      showToast(
        error.message || `Failed to mark ${category.name} as ${nextAvailability ? 'in stock' : 'out of stock'}`,
        'error',
      );
      return;
    }

    showToast(
      nextAvailability
        ? `${category.name} is now in stock`
        : `${category.name} marked out of stock`,
    );
    await loadData();
  }

  async function saveCategory() {
    if (!catForm.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    const slug = catForm.slug || catForm.name.toLowerCase().replace(/\s+/g, '-');
    const payload = {
      name: catForm.name.trim(),
      slug,
      image_url: normalizeImageUrl(catForm.image_url),
    };
    const { error } = catForm.id
      ? await supabase.from('categories').update(payload).eq('id', catForm.id)
      : await supabase.from('categories').insert({
        ...payload,
        display_order: categories.length,
      });

    if (error) {
      showToast(error.message || `Failed to ${catForm.id ? 'update' : 'add'} category`, 'error');
      return;
    }

    setCatForm(emptyCategoryForm);
    setShowCatForm(false);
    showToast(catForm.id ? 'Category updated' : 'Category added');
    await loadData();
  }

  function startCategoryEdit(category: Category) {
    setCatForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      image_url: category.image_url,
    });
    setShowCatForm(true);
  }

  async function deleteCategory(id: string) {
    const { count, error: linkedItemsError } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (linkedItemsError) {
      showToast(linkedItemsError.message || 'Failed to check category items', 'error');
      return;
    }

    if ((count || 0) > 0) {
      showToast('This category still has menu items. Move or archive those items first.', 'error');
      return;
    }

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      showToast(error.message || 'Failed to delete category', 'error');
      return;
    }
    showToast('Category deleted');
    await loadData();
  }

  if (loading) {
    return <div className="animate-pulse"><div className="h-8 bg-brand-surface rounded w-32 mb-4" /><div className="h-40 bg-brand-surface rounded-xl" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-white mb-6">Menu Management</h1>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Categories</h2>
          <button
            onClick={() => {
              setCatForm(emptyCategoryForm);
              setShowCatForm(true);
            }}
            className="flex items-center gap-1 text-sm text-brand-gold font-semibold"
          >
            <Plus size={16} /> Add Category
          </button>
        </div>

        {showCatForm && (
          <div ref={categoryFormRef} className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-4 space-y-3">
            <h3 className="text-sm font-bold text-white">{catForm.id ? 'Edit Category' : 'Add Category'}</h3>
            <input placeholder="Category Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="input-field" />
            <input placeholder="Image URL" value={catForm.image_url} onChange={(e) => setCatForm({ ...catForm, image_url: e.target.value })} className="input-field" />
            <div className="flex gap-2">
              <button onClick={saveCategory} className="btn-primary text-sm px-4 py-2 flex items-center gap-1"><Save size={14} />{catForm.id ? 'Update' : 'Save'}</button>
              <button
                onClick={() => {
                  setCatForm(emptyCategoryForm);
                  setShowCatForm(false);
                }}
                className="btn-outline text-sm px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => {
            const totalItems = categoryItemCountById[cat.id] || 0;
            const availableItems = categoryAvailableItemCountById[cat.id] || 0;
            const hasItems = totalItems > 0;
            const shouldMarkIn = hasItems && availableItems === 0;

            return (
              <div key={cat.id} className="rounded-xl border border-brand-border bg-brand-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{cat.name}</p>
                    <p className="mt-1 text-xs text-brand-text-muted">
                      {hasItems
                        ? `${availableItems}/${totalItems} item${totalItems === 1 ? '' : 's'} in stock`
                        : 'No items in this category'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startCategoryEdit(cat)} className="rounded-lg p-2 text-brand-text-dim transition-colors hover:bg-brand-surface-light/70 hover:text-white"><Pencil size={14} /></button>
                    <button onClick={() => deleteCategory(cat.id)} className="rounded-lg p-2 text-brand-text-dim transition-colors hover:bg-red-500/10 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      hasItems && availableItems > 0
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border border-red-500/20 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {hasItems && availableItems > 0 ? 'Visible To Customers' : 'Hidden From Customers'}
                  </span>
                  <button
                    onClick={() => void toggleCategoryAvailability(cat, shouldMarkIn)}
                    disabled={!hasItems}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      !hasItems
                        ? 'cursor-not-allowed bg-brand-surface-light/40 text-brand-text-dim'
                        : shouldMarkIn
                          ? 'text-emerald-300 hover:bg-emerald-500/10'
                          : 'text-red-300 hover:bg-red-500/10'
                    }`}
                  >
                    {shouldMarkIn ? 'Mark All In' : 'Mark All Out'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Menu Items</h2>
          <button
            onClick={() => {
              if (categories.length === 0) {
                showToast('Add a category before creating a menu item', 'error');
                return;
              }
              setEditing({ ...emptyItem, category_id: categories[0]?.id || '' });
            }}
            className="flex items-center gap-1 text-sm text-brand-gold font-semibold"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        {editing && (
          <div ref={itemFormRef} className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Item Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input-field" />
              <select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className="input-field">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Price" type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} className="input-field" />
              <input placeholder="Prep Time (min)" type="number" value={editing.prep_time} onChange={(e) => setEditing({ ...editing, prep_time: e.target.value })} className="input-field" />
            </div>
            <input placeholder="Image URL" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="input-field" />
            <textarea placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input-field resize-none" rows={2} />
            <label className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-surface-light/40 px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={editing.is_available}
                onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })}
                className="h-4 w-4 accent-brand-gold"
              />
              <span>
                {editing.is_available ? 'In stock and visible to customers' : 'Out of stock and hidden from customers'}
              </span>
            </label>
            <p className="text-sm text-brand-text-muted">
              Add-ons are assigned from the Add-On Management section below.
            </p>
            <div className="flex gap-2">
              <button onClick={saveItem} className="btn-primary text-sm px-4 py-2 flex items-center gap-1"><Save size={14} />{editing.id ? 'Update' : 'Add'}</button>
              <button onClick={() => setEditing(null)} className="btn-outline text-sm px-4 py-2 flex items-center gap-1"><X size={14} />Cancel</button>
            </div>
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className="bg-brand-surface rounded-xl border border-brand-border p-10 text-center text-brand-text-muted">
            No menu items to show
          </div>
        ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <div key={item.id} className="bg-brand-surface rounded-xl border border-brand-border p-3 flex items-center gap-4">
              <img
                src={item.image_url || '/image.png'}
                alt={item.name}
                onError={(event) => {
                  if (event.currentTarget.src.endsWith('/image.png')) return;
                  event.currentTarget.src = '/image.png';
                }}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm truncate text-white">{item.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      item.is_available
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-300 border border-red-500/20'
                    }`}
                  >
                    {item.is_available ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                <p className="text-xs text-brand-text-muted">₹{item.price} &bull; {item.prep_time} min</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void toggleItemAvailability(item, !item.is_available)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    item.is_available
                      ? 'text-red-300 hover:bg-red-500/10'
                      : 'text-emerald-300 hover:bg-emerald-500/10'
                  }`}
                >
                  {item.is_available ? 'Mark Out' : 'Mark In'}
                </button>
                <button
                  onClick={() => setEditing({
                    id: item.id, name: normalizeItemName(item.name), description: item.description,
                    price: String(item.price), category_id: item.category_id,
                    image_url: normalizeImageUrl(item.image_url), prep_time: String(item.prep_time),
                    is_veg: item.is_veg, is_eggless: item.is_eggless, is_available: item.is_available,
                  })}
                  className="p-2 hover:bg-brand-surface-light/70 rounded-lg text-brand-text-dim hover:text-white transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteItem(item.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-brand-text-dim hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <CustomizationAssignmentsManager />
    </div>
  );
}
