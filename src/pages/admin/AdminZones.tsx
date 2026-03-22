import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import type { DeliveryZone } from '../../types';

interface ZoneForm {
  id?: string;
  pincode: string;
  area_name: string;
  delivery_fee: string;
  min_order: string;
  estimated_time: string;
  is_active: boolean;
}

const emptyZone: ZoneForm = {
  pincode: '', area_name: '', delivery_fee: '30', min_order: '150', estimated_time: '30', is_active: true,
};

export default function AdminZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ZoneForm | null>(null);
  const { showToast } = useToast();

  const loadZones = useCallback(async () => {
    const { data, error } = await supabase.from('delivery_zones').select('*').order('area_name');
    setZones(data || []);
    if (error) {
      showToast(error.message || 'Failed to load delivery zones', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { void loadZones(); }, [loadZones]);

  async function saveZone() {
    if (!editing || !editing.pincode.trim()) {
      showToast('Pincode is required', 'error');
      return;
    }
    const payload = {
      pincode: editing.pincode.trim(),
      area_name: editing.area_name.trim(),
      delivery_fee: parseFloat(editing.delivery_fee) || 30,
      min_order: parseFloat(editing.min_order) || 150,
      estimated_time: parseInt(editing.estimated_time) || 30,
      is_active: editing.is_active,
    };

    const { error } = editing.id
      ? await supabase.from('delivery_zones').update(payload).eq('id', editing.id)
      : await supabase.from('delivery_zones').insert(payload);

    if (error) {
      showToast(error.message || 'Failed to save delivery zone', 'error');
      return;
    }

    showToast(editing.id ? 'Delivery zone updated' : 'Delivery zone added');
    setEditing(null);
    await loadZones();
  }

  async function deleteZone(id: string) {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) {
      showToast(error.message || 'Failed to delete delivery zone', 'error');
      return;
    }
    showToast('Delivery zone deleted');
    await loadZones();
  }

  if (loading) {
    return <div className="animate-pulse"><div className="h-8 bg-brand-surface rounded w-40 mb-4" /><div className="h-40 bg-brand-surface rounded-xl" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-white">Delivery Zones</h1>
        <button onClick={() => setEditing({ ...emptyZone })} className="flex items-center gap-1 text-sm text-brand-gold font-semibold">
          <Plus size={16} /> Add Zone
        </button>
      </div>

      {editing && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Pincode" value={editing.pincode} onChange={(e) => setEditing({ ...editing, pincode: e.target.value })} className="input-field" />
            <input placeholder="Area Name" value={editing.area_name} onChange={(e) => setEditing({ ...editing, area_name: e.target.value })} className="input-field" />
            <input placeholder="Delivery Fee" type="number" value={editing.delivery_fee} onChange={(e) => setEditing({ ...editing, delivery_fee: e.target.value })} className="input-field" />
            <input placeholder="Min Order" type="number" value={editing.min_order} onChange={(e) => setEditing({ ...editing, min_order: e.target.value })} className="input-field" />
            <input placeholder="Est. Time (min)" type="number" value={editing.estimated_time} onChange={(e) => setEditing({ ...editing, estimated_time: e.target.value })} className="input-field" />
            <label className="flex items-center gap-2 text-sm text-brand-text-muted">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="rounded" />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={saveZone} className="btn-primary text-sm px-4 py-2 flex items-center gap-1"><Save size={14} />{editing.id ? 'Update' : 'Add'}</button>
            <button onClick={() => setEditing(null)} className="btn-outline text-sm px-4 py-2 flex items-center gap-1"><X size={14} />Cancel</button>
          </div>
        </div>
      )}

      {zones.length === 0 ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-10 text-center text-brand-text-muted">No delivery zones</div>
      ) : (
        <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-bg text-brand-text-dim text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Pincode</th>
                  <th className="px-4 py-3 text-left font-medium">Area</th>
                  <th className="px-4 py-3 text-left font-medium">Fee</th>
                  <th className="px-4 py-3 text-left font-medium">Min Order</th>
                  <th className="px-4 py-3 text-left font-medium">ETA</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-brand-surface-light/70 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">{zone.pincode}</td>
                    <td className="px-4 py-3 text-brand-text-muted">{zone.area_name}</td>
                    <td className="px-4 py-3 text-white">₹{zone.delivery_fee}</td>
                    <td className="px-4 py-3 text-white">₹{zone.min_order}</td>
                    <td className="px-4 py-3 text-white">{zone.estimated_time} min</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${zone.is_active ? 'text-green-400' : 'text-brand-text-dim'}`}>
                        {zone.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditing({
                            id: zone.id, pincode: zone.pincode, area_name: zone.area_name,
                            delivery_fee: String(zone.delivery_fee), min_order: String(zone.min_order),
                            estimated_time: String(zone.estimated_time), is_active: zone.is_active,
                          })}
                          className="p-1.5 hover:bg-brand-surface-light/70 rounded text-brand-text-dim hover:text-white"
                        >
                          <Save size={14} />
                        </button>
                        <button onClick={() => deleteZone(zone.id)} className="p-1.5 hover:bg-red-500/10 rounded text-brand-text-dim hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
