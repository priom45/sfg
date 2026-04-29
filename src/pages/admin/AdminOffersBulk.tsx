import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import type { OfferDiscountType } from '../../types';

type BulkOfferKind = 'display' | 'coupon' | 'automatic';
type BulkDiscountType = Extract<OfferDiscountType, 'percentage' | 'flat'>;

interface BulkOfferDraft {
  localId: string;
  title: string;
  description: string;
  display_badge: string;
  display_reward: string;
  background_image_url: string;
  cta_text: string;
  offer_kind: BulkOfferKind;
  code: string;
  discount_type: BulkDiscountType;
  discount_value: string;
  min_order: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function buildEmptyDraft(base?: Partial<BulkOfferDraft>): BulkOfferDraft {
  const validFrom = new Date();
  const validUntil = new Date(validFrom.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextLocalId = createLocalId();
  const defaults: Omit<BulkOfferDraft, 'localId'> = {
    title: '',
    description: '',
    display_badge: '',
    display_reward: '',
    background_image_url: '',
    cta_text: '',
    offer_kind: 'display',
    code: '',
    discount_type: 'percentage',
    discount_value: '10',
    min_order: '200',
    valid_from: toDateTimeLocalValue(validFrom.toISOString()),
    valid_until: toDateTimeLocalValue(validUntil.toISOString()),
    is_active: true,
  };

  return {
    ...defaults,
    ...base,
    localId: nextLocalId,
  };
}

function isMissingBulkOfferSchema(error: { message?: string } | null) {
  return Boolean(
    error?.message
    && /Could not find the '(display_badge|display_reward|background_image_url|cta_text|is_cart_eligible|offer_mode|trigger_type)' column of 'offers'/.test(error.message),
  );
}

function isUntouchedDraft(draft: BulkOfferDraft) {
  return !draft.title.trim()
    && !draft.description.trim()
    && !draft.display_badge.trim()
    && !draft.display_reward.trim()
    && !draft.background_image_url.trim()
    && !draft.cta_text.trim()
    && !draft.code.trim();
}

function validateDraft(draft: BulkOfferDraft, index: number) {
  if (!draft.title.trim()) {
    return `Offer ${index + 1}: title is required`;
  }

  if (draft.offer_kind === 'coupon' && !draft.code.trim()) {
    return `Offer ${index + 1}: coupon code is required`;
  }

  if (draft.offer_kind !== 'display') {
    const discountValue = Number(draft.discount_value);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return `Offer ${index + 1}: discount value must be greater than 0`;
    }

    if (draft.discount_type === 'percentage' && discountValue > 100) {
      return `Offer ${index + 1}: percentage discounts cannot exceed 100`;
    }

    const minOrder = Number(draft.min_order);
    if (!Number.isFinite(minOrder) || minOrder < 0) {
      return `Offer ${index + 1}: minimum order cannot be negative`;
    }
  }

  const validFrom = new Date(draft.valid_from);
  const validUntil = new Date(draft.valid_until);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
    return `Offer ${index + 1}: valid start and end time are required`;
  }

  if (validUntil <= validFrom) {
    return `Offer ${index + 1}: end time must be after start time`;
  }

  return null;
}

function buildInsertPayload(draft: BulkOfferDraft) {
  const isCartEligible = draft.offer_kind !== 'display';
  const offerMode = draft.offer_kind === 'automatic' ? 'automatic' : 'coupon';

  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    code: draft.offer_kind === 'coupon' ? draft.code.trim().toUpperCase() : null,
    display_badge: draft.display_badge.trim() || null,
    display_reward: draft.display_reward.trim() || null,
    background_image_url: draft.background_image_url.trim() || null,
    cta_text: draft.cta_text.trim() || null,
    is_cart_eligible: isCartEligible,
    offer_mode: isCartEligible ? offerMode : 'automatic',
    trigger_type: 'min_order',
    discount_type: isCartEligible ? draft.discount_type : 'flat',
    discount_value: isCartEligible ? parseFloat(draft.discount_value) || 0 : 0,
    min_order: isCartEligible ? Math.max(0, parseFloat(draft.min_order) || 0) : 0,
    valid_from: toIsoDateTime(draft.valid_from),
    valid_until: toIsoDateTime(draft.valid_until),
    is_active: draft.is_active,
  };
}

export default function AdminOffersBulk() {
  const [drafts, setDrafts] = useState<BulkOfferDraft[]>(() => [buildEmptyDraft()]);
  const [saving, setSaving] = useState(false);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const { showToast } = useToast();

  const activeCount = useMemo(() => drafts.filter((draft) => draft.is_active).length, [drafts]);
  const couponCount = useMemo(() => drafts.filter((draft) => draft.offer_kind === 'coupon').length, [drafts]);
  const automaticCount = useMemo(() => drafts.filter((draft) => draft.offer_kind === 'automatic').length, [drafts]);

  const updateDraft = useCallback((localId: string, patch: Partial<BulkOfferDraft>) => {
    setDrafts((current) => current.map((draft) => (
      draft.localId === localId
        ? { ...draft, ...patch }
        : draft
    )));
  }, []);

  const appendDrafts = useCallback((count: number, base?: Partial<BulkOfferDraft>) => {
    setDrafts((current) => [
      ...current,
      ...Array.from({ length: count }, () => buildEmptyDraft(base)),
    ]);
  }, []);

  const duplicateDraft = useCallback((localId: string) => {
    setDrafts((current) => {
      const source = current.find((draft) => draft.localId === localId);
      if (!source) return current;

      return [...current, buildEmptyDraft({
        ...source,
        code: source.offer_kind === 'coupon' ? source.code : '',
      })];
    });
  }, []);

  const removeDraft = useCallback((localId: string) => {
    setDrafts((current) => {
      if (current.length === 1) {
        return [buildEmptyDraft()];
      }

      return current.filter((draft) => draft.localId !== localId);
    });
  }, []);

  useEffect(() => {
    async function inspectSchema() {
      const { error } = await supabase
        .from('offers')
        .select('id, display_badge, display_reward, background_image_url, cta_text, is_cart_eligible, offer_mode, trigger_type')
        .limit(1);

      if (error) {
        if (isMissingBulkOfferSchema(error)) {
          setSchemaReady(false);
          return;
        }

        showToast(error.message || 'Failed to inspect offers schema', 'error');
        setSchemaReady(null);
        return;
      }

      setSchemaReady(true);
    }

    void inspectSchema();
  }, [showToast]);

  async function saveOffers() {
    if (schemaReady === false) {
      showToast('Run the latest offers migrations before using bulk add', 'error');
      return;
    }

    const draftsToSave = drafts
      .map((draft, index) => ({ draft, index }))
      .filter(({ draft }) => !isUntouchedDraft(draft));
    if (draftsToSave.length === 0) {
      showToast('Add at least one offer before saving', 'error');
      return;
    }

    for (const entry of draftsToSave) {
      const message = validateDraft(entry.draft, entry.index);
      if (message) {
        showToast(message, 'error');
        return;
      }
    }

    setSaving(true);

    const payload = draftsToSave.map(({ draft }) => buildInsertPayload(draft));
    const { error } = await supabase.from('offers').insert(payload);

    if (error) {
      if (isMissingBulkOfferSchema(error)) {
        setSchemaReady(false);
        showToast('Run the latest offers migrations before using bulk add', 'error');
      } else {
        showToast(error.message || 'Failed to save offers', 'error');
      }
      setSaving(false);
      return;
    }

    showToast(payload.length === 1 ? '1 offer added' : `${payload.length} offers added`);
    setDrafts([buildEmptyDraft()]);
    setSaving(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/admin/offers" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-gold">
            <ArrowLeft size={14} />
            Back to Offers
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold text-white">Bulk Add Offers</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-text-muted">
            Quickly create many standard offer cards in one save. Use the regular offers editor for free-item rules,
            quantity triggers, image uploads, or banner links to categories and products.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => appendDrafts(1)}
            className="btn-outline px-4 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-1">
              <Plus size={14} />
              Add Row
            </span>
          </button>
          <button
            type="button"
            onClick={() => appendDrafts(5)}
            className="btn-outline px-4 py-2 text-sm"
          >
            Add 5 Rows
          </button>
          <button
            type="button"
            onClick={() => void saveOffers()}
            disabled={saving || schemaReady === false}
            className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-1">
              <Save size={14} />
              {saving ? 'Saving...' : 'Save All'}
            </span>
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim">Rows</p>
          <p className="mt-2 text-2xl font-black text-white">{drafts.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim">Active</p>
          <p className="mt-2 text-2xl font-black text-white">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim">Coupons</p>
          <p className="mt-2 text-2xl font-black text-white">{couponCount}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim">Automatic</p>
          <p className="mt-2 text-2xl font-black text-white">{automaticCount}</p>
        </div>
      </div>

      {schemaReady === false && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-white">
            Bulk add needs the extended offers schema before it can save new records.
          </p>
          <p className="mt-1 text-xs text-brand-text-muted">
            Open the regular{' '}
            <Link to="/admin/offers" className="font-semibold text-brand-gold">
              Offers
            </Link>{' '}
            page first if you need the migration guidance already built into the admin.
          </p>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-brand-border bg-brand-surface p-4">
        <p className="text-sm font-semibold text-white">Bulk page scope</p>
        <p className="mt-1 text-sm text-brand-text-muted">
          This page is for fast display promos, simple coupon codes, and automatic minimum-order discounts.
          Every row uses the menu page as the CTA target and the minimum-order trigger if it affects pricing.
        </p>
      </div>

      <div className="space-y-4">
        {drafts.map((draft, index) => {
          const isPricingOffer = draft.offer_kind !== 'display';

          return (
            <div key={draft.localId} className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim">
                    Offer {index + 1}
                  </p>
                  <p className="mt-1 text-sm text-brand-text-muted">
                    {draft.offer_kind === 'display'
                      ? 'Display only. Visible on customer offer surfaces without changing pricing.'
                      : draft.offer_kind === 'coupon'
                        ? 'Coupon offer. Customers must enter a code in cart.'
                        : 'Automatic offer. Discount applies when the minimum order matches.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => duplicateDraft(draft.localId)}
                    className="btn-outline px-3 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Copy size={14} />
                      Duplicate
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.localId)}
                    className="btn-outline px-3 py-2 text-sm text-red-300 hover:text-red-200"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Trash2 size={14} />
                      Remove
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  placeholder="Offer Title"
                  value={draft.title}
                  onChange={(e) => updateDraft(draft.localId, { title: e.target.value })}
                  className="input-field"
                />

                <select
                  value={draft.offer_kind}
                  onChange={(e) => updateDraft(draft.localId, {
                    offer_kind: e.target.value as BulkOfferKind,
                    code: e.target.value === 'coupon' ? draft.code : '',
                  })}
                  className="input-field"
                >
                  <option value="display">Display Only</option>
                  <option value="coupon">Coupon Code</option>
                  <option value="automatic">Automatic Discount</option>
                </select>

                <input
                  placeholder="Top Badge (optional)"
                  value={draft.display_badge}
                  onChange={(e) => updateDraft(draft.localId, { display_badge: e.target.value })}
                  className="input-field"
                />

                <input
                  placeholder="Bottom Highlight (optional)"
                  value={draft.display_reward}
                  onChange={(e) => updateDraft(draft.localId, { display_reward: e.target.value })}
                  className="input-field"
                />

                <input
                  placeholder="Button Text (optional)"
                  value={draft.cta_text}
                  onChange={(e) => updateDraft(draft.localId, { cta_text: e.target.value })}
                  className="input-field"
                />

                <input
                  placeholder="Background Image URL (optional)"
                  value={draft.background_image_url}
                  onChange={(e) => updateDraft(draft.localId, { background_image_url: e.target.value })}
                  className="input-field"
                />

                {draft.offer_kind === 'coupon' && (
                  <input
                    placeholder="Coupon Code"
                    value={draft.code}
                    onChange={(e) => updateDraft(draft.localId, { code: e.target.value.toUpperCase() })}
                    className="input-field"
                  />
                )}

                {isPricingOffer && (
                  <>
                    <select
                      value={draft.discount_type}
                      onChange={(e) => updateDraft(draft.localId, { discount_type: e.target.value as BulkDiscountType })}
                      className="input-field"
                    >
                      <option value="percentage">Percentage Discount</option>
                      <option value="flat">Flat Amount Discount</option>
                    </select>

                    <input
                      placeholder="Discount Value"
                      type="number"
                      min={1}
                      value={draft.discount_value}
                      onChange={(e) => updateDraft(draft.localId, { discount_value: e.target.value })}
                      className="input-field"
                    />

                    <input
                      placeholder="Minimum Order Value"
                      type="number"
                      min={0}
                      value={draft.min_order}
                      onChange={(e) => updateDraft(draft.localId, { min_order: e.target.value })}
                      className="input-field"
                    />
                  </>
                )}

                <input
                  type="datetime-local"
                  value={draft.valid_from}
                  onChange={(e) => updateDraft(draft.localId, { valid_from: e.target.value })}
                  className="input-field"
                />

                <input
                  type="datetime-local"
                  value={draft.valid_until}
                  onChange={(e) => updateDraft(draft.localId, { valid_until: e.target.value })}
                  className="input-field"
                />

                <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-bg/20 px-3 text-sm text-brand-text-muted">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => updateDraft(draft.localId, { is_active: e.target.checked })}
                    className="rounded"
                  />
                  Active
                </label>
              </div>

              <textarea
                placeholder="Description / combo lines"
                value={draft.description}
                onChange={(e) => updateDraft(draft.localId, { description: e.target.value })}
                className="input-field mt-3 resize-none"
                rows={4}
              />

              <p className="mt-3 text-xs text-brand-text-dim">
                Tip: use line breaks in the description for combo items exactly as they should appear on the customer offers page.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
