import type { CartItem, Offer, OfferDiscountType, OfferMode, OfferTriggerType } from '../types';

export interface OfferPricingContext {
  subtotal: number;
  itemCount: number;
  addOnTotal: number;
}

export interface AutomaticOfferResult {
  offer: Offer;
  discountAmount: number;
}

function normalizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number) {
  const normalized = normalizeNumber(value);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
}

export function getOfferMode(offer: Offer): OfferMode {
  return offer.offer_mode === 'automatic' ? 'automatic' : 'coupon';
}

export function getOfferTriggerType(offer: Offer): OfferTriggerType {
  return offer.trigger_type === 'item_quantity' ? 'item_quantity' : 'min_order';
}

export function getOfferDiscountType(offer: Offer): OfferDiscountType {
  return offer.discount_type === 'free_addons'
    ? 'free_addons'
    : offer.discount_type === 'flat'
      ? 'flat'
      : 'percentage';
}

export function getOfferCode(offer: Offer) {
  return typeof offer.code === 'string' && offer.code.trim() ? offer.code.trim().toUpperCase() : null;
}

export function getRequiredItemQuantity(offer: Offer) {
  const quantity = offer.required_item_quantity ?? null;
  return quantity && quantity > 0 ? quantity : null;
}

export function getCartAddOnTotal(items: CartItem[]) {
  return items.reduce((sum, item) => (
    sum + item.customizations.reduce((customizationSum, customization) => customizationSum + customization.price, 0) * item.quantity
  ), 0);
}

export function getOfferBadgeLabel(offer: Offer) {
  return getOfferMode(offer) === 'coupon' ? getOfferCode(offer) || 'COUPON' : 'AUTO OFFER';
}

export function getOfferRewardLabel(offer: Offer) {
  switch (getOfferDiscountType(offer)) {
    case 'percentage':
      return `${formatNumber(offer.discount_value)}% OFF`;
    case 'flat':
      return `₹${formatNumber(offer.discount_value)} OFF`;
    case 'free_addons':
      return 'FREE ADD-ONS';
    default:
      return offer.title;
  }
}

export function getOfferRuleSummary(offer: Offer) {
  const triggerType = getOfferTriggerType(offer);
  const rewardLabel = getOfferRewardLabel(offer);

  if (triggerType === 'item_quantity') {
    const requiredQuantity = getRequiredItemQuantity(offer) || 1;
    return getOfferDiscountType(offer) === 'free_addons'
      ? `Buy ${requiredQuantity} items and unlock free add-ons`
      : `Buy ${requiredQuantity} items and unlock ${rewardLabel.toLowerCase()}`;
  }

  const minOrder = Math.max(0, normalizeNumber(offer.min_order));
  return getOfferDiscountType(offer) === 'free_addons'
    ? `Free add-ons on orders above ₹${formatNumber(minOrder)}`
    : `${rewardLabel} on orders above ₹${formatNumber(minOrder)}`;
}

export function getOfferEligibilityError(offer: Offer, context: OfferPricingContext) {
  if (getOfferTriggerType(offer) === 'item_quantity') {
    const requiredQuantity = getRequiredItemQuantity(offer) || 1;
    if (context.itemCount < requiredQuantity) {
      const remainingItems = requiredQuantity - context.itemCount;
      return `Add ${remainingItems} more item${remainingItems === 1 ? '' : 's'} to use this offer`;
    }
    return null;
  }

  const minimumOrder = Math.max(0, normalizeNumber(offer.min_order));
  if (context.subtotal < minimumOrder) {
    return `Minimum order of ₹${formatNumber(minimumOrder)} required`;
  }

  return null;
}

export function getOfferDiscountAmount(offer: Offer, context: OfferPricingContext) {
  if (getOfferEligibilityError(offer, context)) {
    return 0;
  }

  let discountAmount = 0;
  switch (getOfferDiscountType(offer)) {
    case 'percentage':
      discountAmount = Math.round(context.subtotal * (normalizeNumber(offer.discount_value) / 100));
      break;
    case 'flat':
      discountAmount = normalizeNumber(offer.discount_value);
      break;
    case 'free_addons':
      discountAmount = context.addOnTotal;
      break;
  }

  return Math.min(context.subtotal, Math.max(0, discountAmount));
}

export function getBestAutomaticOffer(offers: Offer[], context: OfferPricingContext): AutomaticOfferResult | null {
  const applicableOffers = offers
    .filter((offer) => getOfferMode(offer) === 'automatic')
    .map((offer) => ({
      offer,
      discountAmount: getOfferDiscountAmount(offer, context),
    }))
    .filter((result) => result.discountAmount > 0)
    .sort((left, right) => right.discountAmount - left.discountAmount);

  return applicableOffers[0] || null;
}
