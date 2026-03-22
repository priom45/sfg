import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useToast } from '../../components/Toast';
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

const emptyItem: ItemForm = {
  name: '', description: '', price: '', category_id: '', image_url: '',
  prep_time: '10', is_veg: false, is_eggless: false, is_available: true,
};

export default function AdminMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [catForm, setCatForm] = useState({ name: '', slug: '', image_url: '' });
  const [showCatForm, setShowCatForm] = useState(false);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    const [catRes, itemRes] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').order('display_order'),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setItems(itemRes.data);
    if (catRes.error) {
      showToast(catRes.error.message || 'Failed to load categories', 'error');
    }
    if (itemRes.error) {
      showToast(itemRes.error.message || 'Failed to load menu items', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

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
      name: editing.name,
      description: editing.description,
      price: parseFloat(editing.price) || 0,
      category_id: editing.category_id,
      image_url: editing.image_url,
      prep_time: parseInt(editing.prep_time) || 10,
      is_veg: editing.is_veg,
      is_eggless: editing.is_eggless,
      is_available: editing.is_available,
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
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) {
      showToast(error.message || 'Failed to delete item', 'error');
      return;
    }
    showToast('Item deleted');
    await loadData();
  }

  async function saveCategory() {
    if (!catForm.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    const slug = catForm.slug || catForm.name.toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('categories').insert({
      name: catForm.name,
      slug,
      image_url: catForm.image_url,
      display_order: categories.length,
    });

    if (error) {
      showToast(error.message || 'Failed to add category', 'error');
      return;
    }

    setCatForm({ name: '', slug: '', image_url: '' });
    setShowCatForm(false);
    showToast('Category added');
    await loadData();
  }

  async function deleteCategory(id: string) {
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
          <button onClick={() => setShowCatForm(true)} className="flex items-center gap-1 text-sm text-brand-gold font-semibold">
            <Plus size={16} /> Add Category
          </button>
        </div>

        {showCatForm && (
          <div className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-4 space-y-3">
            <input placeholder="Category Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="input-field" />
            <input placeholder="Image URL" value={catForm.image_url} onChange={(e) => setCatForm({ ...catForm, image_url: e.target.value })} className="input-field" />
            <div className="flex gap-2">
              <button onClick={saveCategory} className="btn-primary text-sm px-4 py-2 flex items-center gap-1"><Save size={14} />Save</button>
              <button onClick={() => setShowCatForm(false)} className="btn-outline text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm">
              <span className="font-medium text-white">{cat.name}</span>
              <button onClick={() => deleteCategory(cat.id)} className="text-brand-text-dim hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Menu Items</h2>
          <button
            onClick={() => setEditing({ ...emptyItem, category_id: categories[0]?.id || '' })}
            className="flex items-center gap-1 text-sm text-brand-gold font-semibold"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        {editing && (
          <div className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-4 space-y-3">
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
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-brand-text-muted">
                <input type="checkbox" checked={editing.is_veg} onChange={(e) => setEditing({ ...editing, is_veg: e.target.checked })} className="rounded" />
                Vegetarian
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text-muted">
                <input type="checkbox" checked={editing.is_eggless} onChange={(e) => setEditing({ ...editing, is_eggless: e.target.checked })} className="rounded" />
                Eggless
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text-muted">
                <input type="checkbox" checked={editing.is_available} onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })} className="rounded" />
                Available
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={saveItem} className="btn-primary text-sm px-4 py-2 flex items-center gap-1"><Save size={14} />{editing.id ? 'Update' : 'Add'}</button>
              <button onClick={() => setEditing(null)} className="btn-outline text-sm px-4 py-2 flex items-center gap-1"><X size={14} />Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-brand-surface rounded-xl border border-brand-border p-3 flex items-center gap-4">
              <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm truncate text-white">{item.name}</h3>
                  {item.is_veg && <span className="badge-veg text-[10px]">VEG</span>}
                  {!item.is_available && <span className="text-[10px] bg-brand-surface-light text-brand-text-dim px-1.5 py-0.5 rounded">Unavailable</span>}
                </div>
                <p className="text-xs text-brand-text-muted">₹{item.price} &bull; {item.prep_time} min</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing({
                    id: item.id, name: item.name, description: item.description,
                    price: String(item.price), category_id: item.category_id,
                    image_url: item.image_url, prep_time: String(item.prep_time),
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
      </div>
    </div>
  );
}
