import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useToast } from '../../components/Toast';
import {
  getOfferBadgeLabel,
  getOfferDisplayDescription,
  getOfferMode,
  getOfferRewardLabel,
  getOfferRuleSummary,
  getOfferTriggerType,
  isOfferCartEligible,
} from '../../lib/offers';
import { supabase } from '../../lib/supabase';
import type { Offer, OfferDiscountType, OfferMode, OfferTriggerType } from '../../types';

interface OfferForm {
  id?: string;
  title: string;
  description: string;
  code: string;
  display_badge: string;
  display_reward: string;
  background_image_url: string;
  is_cart_eligible: boolean;
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

const DISPLAY_SCHEMA_SQL = `ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS display_badge text,
  ADD COLUMN IF NOT EXISTS display_reward text,
  ADD COLUMN IF NOT EXISTS is_cart_eligible boolean NOT NULL DEFAULT true;

UPDATE offers
SET is_cart_eligible = true
WHERE is_cart_eligible IS NULL;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS background_image_url text;`;

const RULES_SCHEMA_SQL = `ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_mode text NOT NULL DEFAULT 'coupon',
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'min_order',
  ADD COLUMN IF NOT EXISTS required_item_quantity integer;`;

const OFFER_IMAGE_BUCKET = 'offer-images';
const MAX_OFFER_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_OFFER_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const OFFER_IMAGE_STORAGE_SQL = `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offer-images',
  'offer-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can view offer images'
  ) THEN
    CREATE POLICY "Public can view offer images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'offer-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can upload offer images'
  ) THEN
    CREATE POLICY "Admins can upload offer images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'offer-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can update offer images'
  ) THEN
    CREATE POLICY "Admins can update offer images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'offer-images' AND public.is_admin())
      WITH CHECK (bucket_id = 'offer-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can delete offer images'
  ) THEN
    CREATE POLICY "Admins can delete offer images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'offer-images' AND public.is_admin());
  END IF;
END $$;`;

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function normalizeImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const sanitized = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return sanitized || 'offer-image';
}

function isMissingOfferImageStorage(error: { message?: string } | null) {
  return Boolean(
    error?.message
    && /(bucket.*not found|resource was not found|storage.*not found|row-level security|permission denied|Unauthorized)/i.test(error.message),
  );
}

function buildEmptyOffer(): OfferForm {
  const validFrom = new Date();
  const validUntil = new Date(validFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    title: '',
    description: '',
    code: '',
    display_badge: '',
    display_reward: '',
    background_image_url: '',
    is_cart_eligible: true,
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
    display_badge: offer.display_badge || '',
    display_reward: offer.display_reward || '',
    background_image_url: offer.background_image_url || '',
    is_cart_eligible: offer.is_cart_eligible !== false,
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

function buildPreviewOffer(offer: OfferForm): Offer {
  const isCartEligible = offer.is_cart_eligible;

  return {
    id: offer.id || 'preview-offer',
    title: offer.title.trim() || 'Offer title',
    description: offer.description,
    code: isCartEligible && offer.offer_mode === 'coupon' && offer.code.trim() ? offer.code.trim().toUpperCase() : null,
    display_badge: offer.display_badge.trim() || null,
    display_reward: offer.display_reward.trim() || null,
    background_image_url: offer.background_image_url.trim() || null,
    is_cart_eligible: isCartEligible,
    offer_mode: isCartEligible ? offer.offer_mode : 'automatic',
    trigger_type: isCartEligible ? offer.trigger_type : 'min_order',
    discount_type: isCartEligible ? offer.discount_type : 'flat',
    discount_value: isCartEligible && offer.discount_type !== 'free_addons' ? parseFloat(offer.discount_value) || 0 : 0,
    min_order: isCartEligible && offer.trigger_type === 'min_order' ? parseFloat(offer.min_order) || 0 : 0,
    required_item_quantity: isCartEligible && offer.trigger_type === 'item_quantity'
      ? Math.max(1, parseInt(offer.required_item_quantity, 10) || 1)
      : null,
    valid_from: toIsoDateTime(offer.valid_from),
    valid_until: toIsoDateTime(offer.valid_until),
    is_active: offer.is_active,
  };
}

function isMissingOfferRulesSchema(error: { message?: string } | null) {
  return Boolean(
    error?.message
    && /Could not find the '(offer_mode|trigger_type|required_item_quantity)' column of 'offers'/.test(error.message),
  );
}

function isMissingOfferDisplaySchema(error: { message?: string } | null) {
  return Boolean(
    error?.message
    && /Could not find the '(display_badge|display_reward|background_image_url|is_cart_eligible)' column of 'offers'/.test(error.message),
  );
}

function canUseLegacyOfferSchema(offer: OfferForm) {
  return offer.is_cart_eligible
    && offer.offer_mode === 'coupon'
    && offer.trigger_type === 'min_order'
    && offer.discount_type !== 'free_addons';
}

function canUseLegacyOfferDisplaySchema(offer: OfferForm) {
  return offer.is_cart_eligible
    && !offer.display_badge.trim()
    && !offer.display_reward.trim()
    && !offer.background_image_url.trim();
}

export default function AdminOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OfferForm | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const [displaySchemaAvailable, setDisplaySchemaAvailable] = useState<boolean | null>(null);
  const [rulesSchemaAvailable, setRulesSchemaAvailable] = useState<boolean | null>(null);
  const [offerImageUploadAvailable, setOfferImageUploadAvailable] = useState<boolean | null>(null);
  const [uploadingBackgroundImage, setUploadingBackgroundImage] = useState(false);
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();
  const activeOffers = offers.filter((offer) => offer.is_active);
  const carouselOffers = activeOffers.slice(0, 4);
  const previewOffer = editing ? buildPreviewOffer(editing) : null;
  const previewDescription = previewOffer ? getOfferDisplayDescription(previewOffer) : null;
  const previewRewardLabel = previewOffer ? getOfferRewardLabel(previewOffer) : null;
  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((current) => (current[url] ? current : { ...current, [url]: true }));
  }, []);

  const uploadOfferBackgroundImage = useCallback(async (file: File) => {
    if (!editing) {
      return;
    }

    if (displaySchemaAvailable === false) {
      showToast(
        'Run migrations 20260330120000 and 20260330123000 before saving background images, custom labels, or display-only promos.',
        'error',
      );
      return;
    }

    if (!ACCEPTED_OFFER_IMAGE_TYPES.includes(file.type)) {
      showToast('Use a PNG, JPG, WEBP, or GIF image', 'error');
      return;
    }

    if (file.size > MAX_OFFER_IMAGE_SIZE_BYTES) {
      showToast('Offer background images must be 5 MB or smaller', 'error');
      return;
    }

    setUploadingBackgroundImage(true);

    const filePath = `backgrounds/${editing.id || 'draft'}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from(OFFER_IMAGE_BUCKET).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      if (isMissingOfferImageStorage(error)) {
        setOfferImageUploadAvailable(false);
        showToast(
          'Offer image uploads are not ready. Run the offer-images storage migration in Supabase first.',
          'error',
        );
      } else {
        showToast(error.message || 'Failed to upload background image', 'error');
      }
      setUploadingBackgroundImage(false);
      return;
    }

    const { data } = supabase.storage.from(OFFER_IMAGE_BUCKET).getPublicUrl(filePath);
    const nextUrl = data.publicUrl;

    setEditing((current) => (current ? { ...current, background_image_url: nextUrl } : current));
    setOfferImageUploadAvailable(true);
    setFailedImageUrls((current) => {
      if (!current[nextUrl]) return current;
      const next = { ...current };
      delete next[nextUrl];
      return next;
    });
    setUploadingBackgroundImage(false);
    showToast('Background image uploaded');
  }, [displaySchemaAvailable, editing, showToast]);

  const handleBackgroundImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    void uploadOfferBackgroundImage(file);
  }, [uploadOfferBackgroundImage]);

  const loadOffers = useCallback(async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      showToast(error.message || 'Failed to load offers', 'error');
    }

    const loadedOffers = data || [];
    setOffers(loadedOffers);

    if (loadedOffers.length > 0) {
      const sampleOffer = loadedOffers[0] as Record<string, unknown>;
      setDisplaySchemaAvailable(
        ['display_badge', 'display_reward', 'background_image_url', 'is_cart_eligible']
          .every((column) => Object.prototype.hasOwnProperty.call(sampleOffer, column)),
      );
      setRulesSchemaAvailable(
        ['offer_mode', 'trigger_type', 'required_item_quantity']
          .every((column) => Object.prototype.hasOwnProperty.call(sampleOffer, column)),
      );
    } else {
      setDisplaySchemaAvailable(null);
      setRulesSchemaAvailable(null);
    }

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

    if (editing.is_cart_eligible && editing.offer_mode === 'coupon' && !editing.code.trim()) {
      showToast('Coupon code is required for coupon offers', 'error');
      return;
    }

    if (
      editing.is_cart_eligible
      && editing.trigger_type === 'item_quantity'
      && (!Number.isFinite(Number(editing.required_item_quantity)) || Number(editing.required_item_quantity) < 1)
    ) {
      showToast('Item quantity trigger must be at least 1', 'error');
      return;
    }

    const validFrom = toIsoDateTime(editing.valid_from);
    const validUntil = toIsoDateTime(editing.valid_until);
    if (new Date(validUntil) <= new Date(validFrom)) {
      showToast('Offer end time must be after the start time', 'error');
      return;
    }

    const resolvedOfferMode: OfferMode = editing.is_cart_eligible ? editing.offer_mode : 'automatic';
    const resolvedTriggerType: OfferTriggerType = editing.is_cart_eligible ? editing.trigger_type : 'min_order';

    const legacyPayload = {
      title: editing.title.trim(),
      description: editing.description.trim(),
      code: resolvedOfferMode === 'coupon' ? editing.code.trim().toUpperCase() : null,
      discount_type: editing.is_cart_eligible ? editing.discount_type : 'flat',
      discount_value: editing.is_cart_eligible && editing.discount_type !== 'free_addons'
        ? parseFloat(editing.discount_value) || 0
        : 0,
      min_order: editing.is_cart_eligible && resolvedTriggerType === 'min_order'
        ? parseFloat(editing.min_order) || 0
        : 0,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: editing.is_active,
    };

    const rulesPayload = {
      ...legacyPayload,
      offer_mode: resolvedOfferMode,
      trigger_type: resolvedTriggerType,
      required_item_quantity: editing.is_cart_eligible && resolvedTriggerType === 'item_quantity'
        ? Math.max(1, parseInt(editing.required_item_quantity, 10) || 1)
        : null,
    };

    const displayPayload = {
      ...rulesPayload,
      display_badge: editing.display_badge.trim() || null,
      display_reward: editing.display_reward.trim() || null,
      background_image_url: editing.background_image_url.trim() || null,
      is_cart_eligible: editing.is_cart_eligible,
    };

    const legacyDisplayPayload = {
      ...legacyPayload,
      display_badge: editing.display_badge.trim() || null,
      display_reward: editing.display_reward.trim() || null,
      background_image_url: editing.background_image_url.trim() || null,
      is_cart_eligible: editing.is_cart_eligible,
    };

    const savePayload = (
      payload: typeof legacyPayload | typeof rulesPayload | typeof displayPayload | typeof legacyDisplayPayload,
    ) => (
      editing.id
        ? supabase.from('offers').update(payload).eq('id', editing.id)
        : supabase.from('offers').insert(payload)
    );

    let usedLegacyDisplayFallback = false;
    let usedLegacyRulesFallback = false;
    const requiresDisplaySchema = Boolean(
      !editing.is_cart_eligible
      || editing.display_badge.trim()
      || editing.display_reward.trim()
      || editing.background_image_url.trim()
    );
    const requiresRulesSchema = !canUseLegacyOfferSchema(editing);
    const droppedDisplayFields = Boolean(
      editing.display_badge.trim()
      || editing.display_reward.trim()
      || editing.background_image_url.trim(),
    );

    if (requiresDisplaySchema && displaySchemaAvailable === false) {
      showToast(
        'Run migrations 20260330120000 and 20260330123000 before saving background images, custom labels, or display-only promos.',
        'error',
      );
      return;
    }

    if (requiresRulesSchema && rulesSchemaAvailable === false) {
      showToast(
        'Run Supabase migration 20260321143000_extend_offers_for_rule_based_promotions.sql before using automatic, quantity, or free add-on offers',
        'error',
      );
      return;
    }

    let { error } = await savePayload(displayPayload);

    if (error && isMissingOfferDisplaySchema(error)) {
      setDisplaySchemaAvailable(false);
      if (requiresDisplaySchema || !canUseLegacyOfferDisplaySchema(editing)) {
        showToast(
          'Run migrations 20260330120000 and 20260330123000 before saving background images, custom labels, or display-only promos.',
          'error',
        );
        return;
      }

      usedLegacyDisplayFallback = true;
      ({ error } = await savePayload(rulesPayload));
    }

    if (error && isMissingOfferRulesSchema(error)) {
      setRulesSchemaAvailable(false);
      if (!canUseLegacyOfferSchema(editing)) {
        showToast(
          'Run Supabase migration 20260321143000_extend_offers_for_rule_based_promotions.sql before using automatic, quantity, or free add-on offers',
          'error',
        );
        return;
      }

      usedLegacyRulesFallback = true;
      ({ error } = await savePayload(
        displaySchemaAvailable === false || usedLegacyDisplayFallback
          ? legacyPayload
          : legacyDisplayPayload,
      ));

      if (error && isMissingOfferDisplaySchema(error)) {
        setDisplaySchemaAvailable(false);
        if (requiresDisplaySchema || !canUseLegacyOfferDisplaySchema(editing)) {
          showToast(
            'Run migrations 20260330120000 and 20260330123000 before saving background images, custom labels, or display-only promos.',
            'error',
          );
          return;
        }

        usedLegacyDisplayFallback = true;
        ({ error } = await savePayload(legacyPayload));
      }
    }

    if (error) {
      showToast(error.message || 'Failed to save offer', 'error');
      return;
    }

    if (!usedLegacyDisplayFallback) {
      setDisplaySchemaAvailable(true);
    }

    if (!usedLegacyRulesFallback) {
      setRulesSchemaAvailable(true);
    }

    if (usedLegacyRulesFallback) {
      showToast('Offer saved. Run the latest offers migration to enable advanced offer rules.');
    } else if (usedLegacyDisplayFallback) {
      showToast(
        droppedDisplayFields
          ? 'Offer updated, but display-only fields were skipped because migrations 20260330120000 and 20260330123000 are missing.'
          : 'Offer saved. Run the latest offers display migrations to enable promo-only cards and custom labels.',
      );
    } else {
      showToast(editing.id ? 'Offer updated' : 'Offer added');
    }
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
            const requestedSlideBackgroundImage = normalizeImageUrl(offer?.background_image_url);
            const slideBackgroundImage = requestedSlideBackgroundImage && !failedImageUrls[requestedSlideBackgroundImage]
              ? requestedSlideBackgroundImage
              : null;

            return (
              <div
                key={index}
                className="relative overflow-hidden rounded-lg border border-brand-border bg-brand-bg/40 p-3"
              >
                {slideBackgroundImage && (
                  <>
                    <img
                      src={slideBackgroundImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => markImageFailed(slideBackgroundImage)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-bg/95 via-brand-bg/80 to-brand-bg/45" />
                  </>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-text-dim">
                  Slide {index + 1}
                </p>
                <div className="relative">
                  {offer ? (
                    <>
                      <p className="mt-2 text-sm font-bold text-white">{offer.title}</p>
                      {getOfferDisplayDescription(offer) && (
                        <p className="mt-1 whitespace-pre-line text-xs text-brand-text-muted">
                          {getOfferDisplayDescription(offer)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-brand-text-muted">
                      Empty slot. Add or activate another offer to fill this slide.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {displaySchemaAvailable === false && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-white">
            Background image URLs and custom offer labels are disabled because the `offers` table is missing the new display columns.
          </p>
          <p className="mt-1 text-xs text-brand-text-muted">
            Run this SQL once in the Supabase SQL Editor for the current project, then refresh this page.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-brand-bg/70 p-3 text-xs text-brand-text-muted">{DISPLAY_SCHEMA_SQL}</pre>
        </div>
      )}

      {rulesSchemaAvailable === false && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-white">
            Advanced automatic and quantity-based offers are disabled because the `offers` table is missing the rule-based columns.
          </p>
          <p className="mt-1 text-xs text-brand-text-muted">
            Run this SQL once in the Supabase SQL Editor for the current project, then refresh this page.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-brand-bg/70 p-3 text-xs text-brand-text-muted">{RULES_SCHEMA_SQL}</pre>
        </div>
      )}

      {offerImageUploadAvailable === false && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-white">
            Offer image uploads are disabled because the `offer-images` storage bucket or its admin policies are missing.
          </p>
          <p className="mt-1 text-xs text-brand-text-muted">
            Run this SQL once in the Supabase SQL Editor for the current project, then retry the upload.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-brand-bg/70 p-3 text-xs text-brand-text-muted">{OFFER_IMAGE_STORAGE_SQL}</pre>
        </div>
      )}

      {editing && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Offer Title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="input-field"
            />

            <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-bg/30 px-3 text-sm text-brand-text-muted">
              <input
                type="checkbox"
                checked={editing.is_cart_eligible}
                onChange={(e) => setEditing({
                  ...editing,
                  is_cart_eligible: e.target.checked,
                  offer_mode: e.target.checked ? editing.offer_mode : 'automatic',
                  code: e.target.checked ? editing.code : '',
                })}
                className="rounded"
              />
              Affects cart pricing and coupons
            </label>

            <input
              placeholder="Top Badge (optional)"
              value={editing.display_badge}
              onChange={(e) => setEditing({ ...editing, display_badge: e.target.value })}
              disabled={displaySchemaAvailable === false}
              className="input-field"
            />

            <input
              placeholder="Bottom Highlight (optional, e.g. ₹149)"
              value={editing.display_reward}
              onChange={(e) => setEditing({ ...editing, display_reward: e.target.value })}
              disabled={displaySchemaAvailable === false}
              className="input-field"
            />

            <div className="sm:col-span-2 rounded-xl border border-brand-border bg-brand-bg/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Background Image URL (optional)"
                  value={editing.background_image_url}
                  onChange={(e) => setEditing({ ...editing, background_image_url: e.target.value })}
                  disabled={displaySchemaAvailable === false}
                  className="input-field flex-1"
                />
                <input
                  ref={backgroundImageInputRef}
                  type="file"
                  accept={ACCEPTED_OFFER_IMAGE_TYPES.join(',')}
                  onChange={handleBackgroundImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => backgroundImageInputRef.current?.click()}
                  disabled={displaySchemaAvailable === false || uploadingBackgroundImage}
                  className="btn-outline px-4 py-2 text-sm"
                >
                  {uploadingBackgroundImage ? 'Uploading...' : (
                    <span className="inline-flex items-center gap-1">
                      <ImagePlus size={14} />
                      Upload Image
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, background_image_url: '' })}
                  disabled={!editing.background_image_url}
                  className="btn-outline px-4 py-2 text-sm"
                >
                  Clear Image
                </button>
              </div>
              <p className="mt-2 text-xs text-brand-text-dim">
                Upload a PNG, JPG, WEBP, or GIF up to 5 MB, or paste a direct public image URL.
              </p>
            </div>

            {editing.is_cart_eligible && (
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
            )}

            {editing.is_cart_eligible && editing.offer_mode === 'coupon' && (
              <input
                placeholder="Coupon Code"
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                className="input-field"
              />
            )}

            {editing.is_cart_eligible && (
              <>
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
              </>
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
            placeholder="Description / combo lines"
            value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            className="input-field resize-none"
            rows={4}
          />

          <div className="rounded-lg border border-brand-border bg-brand-bg/40 p-3">
            <p className="mb-2 text-xs text-brand-text-dim">
              Use line breaks in the description to list combo items exactly as they should appear on the banner.
            </p>
            <p className="mb-2 whitespace-pre-line text-xs text-brand-text-dim">
              Example:
              {'\n'}Kurkure Momos (6 pcs)
              {'\n'}Any Milkshake
            </p>
            <p className="text-xs text-brand-text-dim">
              Add a background image URL or upload an image to show promo art behind the slide text on Home and Menu.
            </p>
            {displaySchemaAvailable === false && (
              <p className="mt-2 text-xs text-amber-300">
                The background image field is currently disabled until the display-field migration is applied in Supabase.
              </p>
            )}
            {offerImageUploadAvailable === false && (
              <p className="mt-2 text-xs text-amber-300">
                Image uploads need the `offer-images` storage migration before the Upload Image button will work.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-brand-border bg-brand-bg/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-dim mb-1">Preview</p>
            {previewOffer && (
              <div className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface-light/30 p-3">
                {normalizeImageUrl(previewOffer.background_image_url) && !failedImageUrls[normalizeImageUrl(previewOffer.background_image_url) as string] && (
                  <>
                    <img
                      src={normalizeImageUrl(previewOffer.background_image_url) as string}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => markImageFailed(normalizeImageUrl(previewOffer.background_image_url) as string)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-bg/95 via-brand-surface/85 to-brand-surface/35" />
                  </>
                )}
                <div className="relative flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded-md bg-brand-gold/20 px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand-gold">
                    {getOfferBadgeLabel(previewOffer)}
                  </span>
                  <span className="text-[11px] text-brand-text-dim">
                    {isOfferCartEligible(previewOffer)
                      ? (getOfferMode(previewOffer) === 'automatic' ? 'Auto applied' : 'Coupon')
                      : 'Display only'}
                  </span>
                </div>
                <p className="relative mt-2 text-sm font-bold text-white">{previewOffer.title}</p>
                {previewDescription && (
                  <p className="relative mt-1 whitespace-pre-line text-sm text-brand-text-muted">
                    {previewDescription}
                  </p>
                )}
                {!previewDescription && isOfferCartEligible(previewOffer) && (
                  <p className="relative mt-1 text-sm text-brand-text-muted">{getOfferRuleSummary(previewOffer)}</p>
                )}
                {previewRewardLabel && (
                  <p className="relative mt-3 text-lg font-black tracking-tight text-brand-gold">{previewRewardLabel}</p>
                )}
              </div>
            )}
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
            const rewardLabel = getOfferRewardLabel(offer);
            const description = getOfferDisplayDescription(offer);
            const requestedBackgroundImageUrl = normalizeImageUrl(offer.background_image_url);
            const backgroundImageUrl = requestedBackgroundImageUrl && !failedImageUrls[requestedBackgroundImageUrl]
              ? requestedBackgroundImageUrl
              : null;

            return (
              <div key={offer.id} className="bg-brand-surface rounded-xl border border-brand-border p-4 flex items-start gap-4">
                {backgroundImageUrl ? (
                  <img
                    src={backgroundImageUrl}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
                    onError={() => markImageFailed(backgroundImageUrl)}
                  />
                ) : (
                  <div className="w-14 h-14 bg-brand-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-gold font-black text-[11px] text-center leading-tight px-1">
                      {rewardLabel || 'PROMO'}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{offer.title}</h3>
                    <span className="bg-brand-surface-light text-brand-text-muted text-xs px-2 py-0.5 rounded font-mono">
                      {getOfferBadgeLabel(offer)}
                    </span>
                    <span className="text-xs text-brand-text-dim">
                      {isOfferCartEligible(offer)
                        ? (getOfferMode(offer) === 'automatic' ? 'Auto applied' : 'Coupon')
                        : 'Display only'}
                    </span>
                    {carouselPosition >= 0 && (
                      <span className="rounded bg-brand-gold/15 px-2 py-0.5 text-xs font-semibold text-brand-gold">
                        Homepage #{carouselPosition + 1}
                      </span>
                    )}
                    {!offer.is_active && <span className="text-xs text-brand-text-dim">Inactive</span>}
                  </div>
                    {description && (
                      <p className="mt-1 whitespace-pre-line text-xs text-brand-text-muted">
                        {description}
                      </p>
                    )}
                    {backgroundImageUrl && (
                      <p className="mt-1 text-[11px] text-brand-text-dim">Background image set</p>
                    )}
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
