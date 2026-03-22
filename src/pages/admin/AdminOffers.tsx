import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useToast } from '../../components/Toast';
import {
  getOfferBadgeLabel,
  getOfferMode,
  getOfferRewardLabel,
  getOfferRuleSummary,
  getOfferTriggerType,
} from '../../lib/offers';
import { supabase } from '../../lib/supabase';
import type { Offer, OfferDiscountType, OfferMode, OfferTriggerType } from '../../types';

interface OfferForm {
  id?: string;
  title: string;
  description: string;
  code: string;
  offer_mode: OfferMode;
  trigger_type: OfferTriggerType;
  discount_type: OfferDiscountType;
  discount_value: string;
  min_order: string;
  required_item_quantity: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function buildEmptyOffer(): OfferForm {
  const validFrom = new Date();
  const validUntil = new Date(validFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    title: '',
    description: '',
    code: '',
    offer_mode: 'coupon',
    trigger_type: 'min_order',
    discount_type: 'percentage',
    discount_value: '10',
    min_order: '200',
    required_item_quantity: '3',
    valid_from: toDateTimeLocalValue(validFrom.toISOString()),
    valid_until: toDateTimeLocalValue(validUntil.toISOString()),
    is_active: true,
  };
}

function mapOfferToForm(offer: Offer): OfferForm {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    code: offer.code || '',
    offer_mode: getOfferMode(offer),
    trigger_type: getOfferTriggerType(offer),
    discount_type: offer.discount_type,
    discount_value: String(offer.discount_value),
    min_order: String(offer.min_order),
    required_item_quantity: String(offer.required_item_quantity || 3),
    valid_from: toDateTimeLocalValue(offer.valid_from),
    valid_until: toDateTimeLocalValue(offer.valid_until),
    is_active: offer.is_active,
  };
}

function isMissingOfferRulesSchema(error: { message?: string } | null) {
  return Boolean(
    error?.message
    && /Could not find the '(offer_mode|trigger_type|required_item_quantity)' column of 'offers'/.test(error.message),
  );
}

function canUseLegacyOfferSchema(offer: OfferForm) {
  return offer.offer_mode === 'coupon'
    && offer.trigger_type === 'min_order'
    && offer.discount_type !== 'free_addons';
}

export default function AdminOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OfferForm | null>(null);
  const { showToast } = useToast();
  const activeOffers = offers.filter((offer) => offer.is_active);
  const carouselOffers = activeOffers.slice(0, 4);

  const loadOffers = useCallback(async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      showToast(error.message || 'Failed to load offers', 'error');
    }
    setOffers(data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  async function saveOffer() {
    if (!editing || !editing.title.trim()) {
      showToast('Offer title is required', 'error');
      return;
    }

    if (editing.offer_mode === 'coupon' && !editing.code.trim()) {
      showToast('Coupon code is required for coupon offers', 'error');
      return;
    }

    if (editing.trigger_type === 'item_quantity' && (!Number.isFinite(Number(editing.required_item_quantity)) || Number(editing.required_item_quantity) < 1)) {
      showToast('Item quantity trigger must be at least 1', 'error');
      return;
    }

    const validFrom = toIsoDateTime(editing.valid_from);
    const validUntil = toIsoDateTime(editing.valid_until);
    if (new Date(validUntil) <= new Date(validFrom)) {
      showToast('Offer end time must be after the start time', 'error');
      return;
    }

    const basePayload = {
      title: editing.title.trim(),
      description: editing.description.trim(),
      code: editing.offer_mode === 'coupon' ? editing.code.trim().toUpperCase() : null,
      discount_type: editing.discount_type,
      discount_value: editing.discount_type === 'free_addons' ? 0 : parseFloat(editing.discount_value) || 0,
      min_order: editing.trigger_type === 'min_order' ? parseFloat(editing.min_order) || 0 : 0,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: editing.is_active,
    };

    const payload = {
      ...basePayload,
      offer_mode: editing.offer_mode,
      trigger_type: editing.trigger_type,
      required_item_quantity: editing.trigger_type === 'item_quantity'
        ? Math.max(1, parseInt(editing.required_item_quantity, 10) || 1)
        : null,
    };

    let { error } = editing.id
      ? await supabase.from('offers').update(payload).eq('id', editing.id)
      : await supabase.from('offers').insert(payload);

    if (error && isMissingOfferRulesSchema(error)) {
      if (!canUseLegacyOfferSchema(editing)) {
        showToast(
          'Run Supabase migration 20260321143000_extend_offers_for_rule_based_promotions.sql before using automatic, quantity, or free add-on offers',
          'error',
        );
        return;
      }

      const fallbackResult = editing.id
        ? await supabase.from('offers').update(basePayload).eq('id', editing.id)
        : await supabase.from('offers').insert(basePayload);

      error = fallbackResult.error;

      if (!error) {
        showToast('Offer saved. Run the latest offers migration to enable advanced offer rules.');
        setEditing(null);
        await loadOffers();
        return;
      }
    }

    if (error) {
      showToast(error.message || 'Failed to save offer', 'error');
      return;
    }

    showToast(editing.id ? 'Offer updated' : 'Offer added');
    setEditing(null);
    await loadOffers();
  }

  async function deleteOffer(id: string) {
    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (error) {
      showToast(error.message || 'Failed to delete offer', 'error');
      return;
    }

    showToast('Offer deleted');
    await loadOffers();
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-brand-surface rounded w-32 mb-4" />
        <div className="h-40 bg-brand-surface rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Offers</h1>
          <p className="mt-1 text-sm text-brand-text-muted">
            The homepage carousel shows the newest 4 active offers from this list.
          </p>
        </div>
        <button onClick={() => setEditing(buildEmptyOffer())} className="flex items-center gap-1 text-sm text-brand-gold font-semibold">
          <Plus size={16} /> Add Offer
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-brand-border bg-brand-surface p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Homepage carousel</h2>
            <p className="text-sm text-brand-text-muted">
              Add, edit, deactivate, or delete offers here to change the carousel. Only 4 active offers are shown at once.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
            {carouselOffers.length}/4 slides filled
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => {
            const offer = carouselOffers[index];

            return (
              <div
                key={index}
                className="rounded-lg border border-brand-border bg-brand-bg/40 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-text-dim">
                  Slide {index + 1}
                </p>
                {offer ? (
                  <>
                    <p className="mt-2 text-sm font-bold text-white">{offer.title}</p>
                    <p className="mt-1 text-xs text-brand-text-muted">
                      {offer.description || getOfferRuleSummary(offer)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-brand-text-muted">
                    Empty slot. Add or activate another offer to fill this slide.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Offer Title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="input-field"
            />

            <select
              value={editing.offer_mode}
              onChange={(e) => setEditing({
                ...editing,
                offer_mode: e.target.value as OfferMode,
                code: e.target.value === 'coupon' ? editing.code : '',
              })}
              className="input-field"
            >
              <option value="coupon">Coupon Code</option>
              <option value="automatic">Automatic Offer</option>
            </select>

            {editing.offer_mode === 'coupon' && (
              <input
                placeholder="Coupon Code"
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                className="input-field"
              />
            )}

            <select
              value={editing.trigger_type}
              onChange={(e) => setEditing({ ...editing, trigger_type: e.target.value as OfferTriggerType })}
              className="input-field"
            >
              <option value="min_order">Trigger: Minimum Order Value</option>
              <option value="item_quantity">Trigger: Item Quantity</option>
            </select>

            <select
              value={editing.discount_type}
              onChange={(e) => setEditing({ ...editing, discount_type: e.target.value as OfferDiscountType })}
              className="input-field"
            >
              <option value="percentage">Percentage Discount</option>
              <option value="flat">Flat Amount Discount</option>
              <option value="free_addons">Free Add-Ons</option>
            </select>

            {editing.discount_type !== 'free_addons' && (
              <input
                placeholder="Discount Value"
                type="number"
                value={editing.discount_value}
                onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })}
                className="input-field"
              />
            )}

            {editing.trigger_type === 'min_order' ? (
              <input
                placeholder="Minimum Order Value"
                type="number"
                value={editing.min_order}
                onChange={(e) => setEditing({ ...editing, min_order: e.target.value })}
                className="input-field"
              />
            ) : (
              <input
                placeholder="Required Item Quantity"
                type="number"
                min={1}
                value={editing.required_item_quantity}
                onChange={(e) => setEditing({ ...editing, required_item_quantity: e.target.value })}
                className="input-field"
              />
            )}

            <input
              type="datetime-local"
              value={editing.valid_from}
              onChange={(e) => setEditing({ ...editing, valid_from: e.target.value })}
              className="input-field"
            />

            <input
              type="datetime-local"
              value={editing.valid_until}
              onChange={(e) => setEditing({ ...editing, valid_until: e.target.value })}
              className="input-field"
            />

            <label className="flex items-center gap-2 text-sm text-brand-text-muted">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                className="rounded"
              />
              Active
            </label>
          </div>

          <textarea
            placeholder="Description"
            value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            className="input-field resize-none"
            rows={2}
          />

          <div className="rounded-lg border border-brand-border bg-brand-bg/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim mb-1">Preview</p>
            <p className="text-sm font-semibold text-white">
              {editing.description.trim() || getOfferRuleSummary({
                ...editing,
                id: editing.id || 'preview-offer',
                code: editing.code || null,
                discount_value: editing.discount_type === 'free_addons' ? 0 : parseFloat(editing.discount_value) || 0,
                min_order: parseFloat(editing.min_order) || 0,
                required_item_quantity: parseInt(editing.required_item_quantity, 10) || null,
                valid_from: toIsoDateTime(editing.valid_from),
                valid_until: toIsoDateTime(editing.valid_until),
              })}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={saveOffer} className="btn-primary text-sm px-4 py-2 flex items-center gap-1">
              <Save size={14} />{editing.id ? 'Update' : 'Add'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-outline text-sm px-4 py-2 flex items-center gap-1">
              <X size={14} />Cancel
            </button>
          </div>
        </div>
      )}

      {offers.length === 0 ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-10 text-center text-brand-text-muted">No offers</div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const carouselPosition = carouselOffers.findIndex((carouselOffer) => carouselOffer.id === offer.id);

            return (
              <div key={offer.id} className="bg-brand-surface rounded-xl border border-brand-border p-4 flex items-start gap-4">
                <div className="w-14 h-14 bg-brand-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-gold font-black text-[11px] text-center leading-tight px-1">
                    {getOfferRewardLabel(offer)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{offer.title}</h3>
                    <span className="bg-brand-surface-light text-brand-text-muted text-xs px-2 py-0.5 rounded font-mono">
                      {getOfferBadgeLabel(offer)}
                    </span>
                    <span className="text-xs text-brand-text-dim">
                      {getOfferMode(offer) === 'automatic' ? 'Auto applied' : 'Coupon'}
                    </span>
                    {carouselPosition >= 0 && (
                      <span className="rounded bg-brand-gold/15 px-2 py-0.5 text-xs font-semibold text-brand-gold">
                        Homepage #{carouselPosition + 1}
                      </span>
                    )}
                    {!offer.is_active && <span className="text-xs text-brand-text-dim">Inactive</span>}
                  </div>
                  <p className="text-xs text-brand-text-muted mt-1">
                    {offer.description || getOfferRuleSummary(offer)}
                  </p>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(mapOfferToForm(offer))}
                    className="p-2 hover:bg-brand-surface-light/70 rounded text-brand-text-dim hover:text-white"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void deleteOffer(offer.id)}
                    className="p-2 hover:bg-red-500/10 rounded text-brand-text-dim hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
