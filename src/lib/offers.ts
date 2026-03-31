import type { CartItem, MenuItem, Offer, OfferDiscountType, OfferMode, OfferTriggerType } from '../types';

export interface OfferPricingContext {
  subtotal: number;
  itemCount: number;
  addOnTotal: number;
  items?: CartItem[];
  menuItemsById?: Record<string, Pick<MenuItem, 'id' | 'name' | 'image_url' | 'price' | 'category_id'>>;
  categoryNamesById?: Record<string, string>;
}

export interface AutomaticOfferResult {
  offer: Offer;
  discountAmount: number;
  estimatedValue: number;
  freeItems: OfferRewardItem[];
}

export interface OfferRewardItem {
  menu_item_id: string;
  item_name: string;
  image_url: string;
  quantity: number;
  unit_price: number;
  offer_id: string;
  offer_title: string;
}

function normalizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function normalizeOptionalText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatNumber(value: number) {
  const normalized = normalizeNumber(value);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
}

export function getOfferMode(offer: Offer): OfferMode {
  return offer.offer_mode === 'automatic' ? 'automatic' : 'coupon';
}

export function isOfferCartEligible(offer: Offer) {
  return offer.is_cart_eligible !== false;
}

export function getOfferTriggerType(offer: Offer): OfferTriggerType {
  return offer.trigger_type === 'item_quantity' ? 'item_quantity' : 'min_order';
}

export function getOfferDiscountType(offer: Offer): OfferDiscountType {
  return offer.discount_type === 'free_addons'
    ? 'free_addons'
    : offer.discount_type === 'free_item'
      ? 'free_item'
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

export function getRewardItemQuantity(offer: Offer) {
  const quantity = offer.reward_item_quantity ?? null;
  return quantity && quantity > 0 ? quantity : 1;
}

function getOfferQualifyingItemId(offer: Offer) {
  return normalizeOptionalText(offer.qualifying_menu_item_id);
}

function getOfferQualifyingCategoryId(offer: Offer) {
  return normalizeOptionalText(offer.qualifying_category_id);
}

function getOfferRewardItemId(offer: Offer) {
  return normalizeOptionalText(offer.reward_menu_item_id);
}

function getOfferItemCount(offer: Offer, context: OfferPricingContext) {
  if (getOfferTriggerType(offer) !== 'item_quantity') {
    return context.itemCount;
  }

  const qualifyingItemId = getOfferQualifyingItemId(offer);
  if (qualifyingItemId) {
    return (context.items || []).reduce((sum, item) => (
      item.menu_item.id === qualifyingItemId ? sum + item.quantity : sum
    ), 0);
  }

  const qualifyingCategoryId = getOfferQualifyingCategoryId(offer);
  if (qualifyingCategoryId) {
    return (context.items || []).reduce((sum, item) => (
      item.menu_item.category_id === qualifyingCategoryId ? sum + item.quantity : sum
    ), 0);
  }

  return (context.items || []).reduce((sum, item) => (
    sum + item.quantity
  ), 0);
}

function getOfferEligibleCycles(offer: Offer, context: OfferPricingContext) {
  if (getOfferTriggerType(offer) === 'item_quantity') {
    const minimumOrder = Math.max(0, normalizeNumber(offer.min_order));
    if (minimumOrder > 0 && context.subtotal < minimumOrder) {
      return 0;
    }
    const requiredQuantity = getRequiredItemQuantity(offer) || 1;
    return Math.floor(getOfferItemCount(offer, context) / requiredQuantity);
  }

  const minimumOrder = Math.max(0, normalizeNumber(offer.min_order));
  return context.subtotal >= minimumOrder ? 1 : 0;
}

export function getCartAddOnTotal(items: CartItem[]) {
  return items.reduce((sum, item) => (
    sum + item.customizations.reduce((customizationSum, customization) => customizationSum + customization.price, 0) * item.quantity
  ), 0);
}

export function getOfferBadgeLabel(offer: Offer) {
  const customBadge = normalizeOptionalText(offer.display_badge);
  if (customBadge) {
    return customBadge;
  }

  if (!isOfferCartEligible(offer)) {
    return 'PROMO';
  }

  return getOfferMode(offer) === 'coupon' ? getOfferCode(offer) || 'COUPON' : 'AUTO OFFER';
}

export function getOfferCtaText(offer: Offer) {
  return normalizeOptionalText(offer.cta_text) || 'Order Now';
}

export function getOfferRewardLabel(offer: Offer) {
  const customReward = normalizeOptionalText(offer.display_reward);
  if (customReward) {
    return customReward;
  }

  if (!isOfferCartEligible(offer)) {
    return null;
  }

  switch (getOfferDiscountType(offer)) {
    case 'percentage':
      return `${formatNumber(offer.discount_value)}% OFF`;
    case 'flat':
      return `₹${formatNumber(offer.discount_value)} OFF`;
    case 'free_addons':
      return 'FREE ADD-ONS';
    case 'free_item': {
      const rewardQuantity = getRewardItemQuantity(offer);
      if (getOfferTriggerType(offer) === 'item_quantity') {
        const requiredQuantity = getRequiredItemQuantity(offer) || 1;
        return `BUY ${requiredQuantity} GET ${rewardQuantity}`;
      }
      return rewardQuantity === 1 ? 'FREE ITEM' : `${rewardQuantity} FREE ITEMS`;
    }
    default:
      return offer.title;
  }
}

export function getOfferDisplayDescription(offer: Offer) {
  const customDescription = normalizeOptionalText(offer.description);
  if (customDescription) {
    return customDescription;
  }

  return isOfferCartEligible(offer) ? getOfferRuleSummary(offer) : null;
}

export function getOfferRuleSummary(offer: Offer) {
  const triggerType = getOfferTriggerType(offer);
  const rewardLabel = getOfferRewardLabel(offer) || offer.title;
  const minimumOrder = Math.max(0, normalizeNumber(offer.min_order));
  const minimumOrderSuffix = minimumOrder > 0 ? ` on orders above ₹${formatNumber(minimumOrder)}` : '';

  if (triggerType === 'item_quantity') {
    const requiredQuantity = getRequiredItemQuantity(offer) || 1;
    if (getOfferDiscountType(offer) === 'free_item') {
      const rewardQuantity = getRewardItemQuantity(offer);
      return `Buy ${requiredQuantity} item${requiredQuantity === 1 ? '' : 's'} and get ${rewardQuantity} free${minimumOrderSuffix}`;
    }
    return getOfferDiscountType(offer) === 'free_addons'
      ? `Buy ${requiredQuantity} items and unlock free add-ons${minimumOrderSuffix}`
      : `Buy ${requiredQuantity} items and unlock ${rewardLabel.toLowerCase()}${minimumOrderSuffix}`;
  }

  if (getOfferDiscountType(offer) === 'free_item') {
    const rewardQuantity = getRewardItemQuantity(offer);
    return `Get ${rewardQuantity} free item${rewardQuantity === 1 ? '' : 's'} on orders above ₹${formatNumber(minimumOrder)}`;
  }
  return getOfferDiscountType(offer) === 'free_addons'
    ? `Free add-ons on orders above ₹${formatNumber(minimumOrder)}`
    : `${rewardLabel} on orders above ₹${formatNumber(minimumOrder)}`;
}

export function getOfferEligibilityError(offer: Offer, context: OfferPricingContext) {
  if (getOfferTriggerType(offer) === 'item_quantity') {
    const requiredQuantity = getRequiredItemQuantity(offer) || 1;
    const qualifyingCount = getOfferItemCount(offer, context);
    if (qualifyingCount < requiredQuantity) {
      const remainingItems = requiredQuantity - qualifyingCount;
      const qualifyingItemId = getOfferQualifyingItemId(offer);
      const qualifyingCategoryId = getOfferQualifyingCategoryId(offer);
      const qualifyingItemName = qualifyingItemId
        ? context.menuItemsById?.[qualifyingItemId]?.name
        : null;
      const qualifyingCategoryName = qualifyingCategoryId
        ? context.categoryNamesById?.[qualifyingCategoryId]
        : null;
      return qualifyingItemName
        ? `Add ${remainingItems} more ${qualifyingItemName} to use this offer`
        : qualifyingCategoryName
          ? `Add ${remainingItems} more item${remainingItems === 1 ? '' : 's'} from ${qualifyingCategoryName} to use this offer`
        : `Add ${remainingItems} more item${remainingItems === 1 ? '' : 's'} to use this offer`;
    }

    const minimumOrder = Math.max(0, normalizeNumber(offer.min_order));
    if (minimumOrder > 0 && context.subtotal < minimumOrder) {
      return `Minimum order of ₹${formatNumber(minimumOrder)} required`;
    }

    return null;
  }

  const minimumOrder = Math.max(0, normalizeNumber(offer.min_order));
  if (context.subtotal < minimumOrder) {
    return `Minimum order of ₹${formatNumber(minimumOrder)} required`;
  }

  return null;
}

export function getOfferRewardItems(offer: Offer, context: OfferPricingContext): OfferRewardItem[] {
  if (getOfferDiscountType(offer) !== 'free_item' || getOfferEligibilityError(offer, context)) {
    return [];
  }

  const rewardItemId = getOfferRewardItemId(offer);
  if (!rewardItemId) {
    return [];
  }

  const rewardItem = context.menuItemsById?.[rewardItemId];
  if (!rewardItem) {
    return [];
  }

  const eligibleCycles = getOfferEligibleCycles(offer, context);
  if (eligibleCycles <= 0) {
    return [];
  }

  return [{
    menu_item_id: rewardItem.id,
    item_name: rewardItem.name,
    image_url: rewardItem.image_url,
    quantity: getRewardItemQuantity(offer) * eligibleCycles,
    unit_price: normalizeNumber(rewardItem.price),
    offer_id: offer.id,
    offer_title: offer.title,
  }];
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
    case 'free_item':
      discountAmount = 0;
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
      freeItems: getOfferRewardItems(offer, context),
      estimatedValue: 0,
    }))
    .map((result) => ({
      ...result,
      estimatedValue: result.discountAmount + result.freeItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    }))
    .filter((result) => result.discountAmount > 0 || result.freeItems.length > 0)
    .sort((left, right) => right.estimatedValue - left.estimatedValue || right.discountAmount - left.discountAmount);

  return applicableOffers[0] || null;
}
