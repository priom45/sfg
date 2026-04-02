import { supabase } from './supabase';
import type { Category, MenuItem } from '../types';

const BUSINESS_TIMEZONE = 'Asia/Kolkata';
const POPULARITY_LOOKBACK_DAYS = 14;
const ORDER_ITEM_CHUNK_SIZE = 250;

export type MenuTimeSlotKey = 'afternoon' | 'evening' | 'all_day';

type OrderPopularityRow = {
  id: string;
  placed_at: string;
  status: string;
  payment_status: string;
};

type OrderItemPopularityRow = {
  order_id: string;
  menu_item_id: string;
  quantity: number;
};

export interface MenuPopularityContext {
  slotKey: MenuTimeSlotKey;
  title: string;
  subtitle: string;
  itemScores: Record<string, number>;
  fallbackItemScores: Record<string, number>;
  categoryScores: Record<string, number>;
  fallbackCategoryScores: Record<string, number>;
  rankedItems: MenuItem[];
  rankedCategories: Category[];
  hasLiveData: boolean;
}

const businessHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIMEZONE,
  hour: '2-digit',
  hour12: false,
});

function toRecord(map: Map<string, number>) {
  return Object.fromEntries(map.entries());
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchesToken(value: string, token: string) {
  return normalizeText(value).includes(normalizeText(token));
}

function getSlotKeyFromHour(hour: number): MenuTimeSlotKey {
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'all_day';
}

function getBusinessHour(dateValue: string | Date) {
  const formatted = businessHourFormatter.format(typeof dateValue === 'string' ? new Date(dateValue) : dateValue);
  return Number(formatted);
}

function getCurrentSlotKey(now = new Date()) {
  return getSlotKeyFromHour(getBusinessHour(now));
}

function getSlotTitle(slotKey: MenuTimeSlotKey) {
  void slotKey;
  return 'Best Sellers';
}

function getSlotSubtitle(slotKey: MenuTimeSlotKey, hasLiveData: boolean) {
  if (slotKey === 'afternoon') {
    return hasLiveData
      ? 'Sorted from recent afternoon orders so cold drinks and dessert picks rise first.'
      : 'We will push afternoon favorites here as more orders come in.';
  }

  if (slotKey === 'evening') {
    return hasLiveData
      ? 'Sorted from recent evening orders so snacks, chats, chicken, and waffles rise first.'
      : 'We will push evening cravings here as more orders come in.';
  }

  return hasLiveData
    ? 'Sorted from recent orders so the most-picked items rise to the top.'
    : 'We will surface your most-ordered items here once enough history builds.';
}

function getFallbackTokenGroups(slotKey: MenuTimeSlotKey) {
  if (slotKey === 'afternoon') {
    return [
      ['thick shake', 'thickshake'],
      ['milkshake', 'milk shake'],
      ['ice cream', 'scoop'],
      ['dessert'],
      ['waffle'],
    ];
  }

  if (slotKey === 'evening') {
    return [
      ['chaat', 'chat'],
      ['chicken snack', 'chicken'],
      ['fries'],
      ['momo'],
      ['waffle'],
    ];
  }

  return [
    ['waffle'],
    ['thick shake', 'thickshake'],
    ['milkshake', 'milk shake'],
    ['dessert'],
    ['fries'],
  ];
}

function getManualCategoryPriority(categories: Category[], slotKey: MenuTimeSlotKey) {
  const priorities: Record<string, number> = {};
  const usedIds = new Set<string>();
  const tokenGroups = getFallbackTokenGroups(slotKey);

  tokenGroups.forEach((tokens, index) => {
    const match = categories.find((category) => (
      !usedIds.has(category.id)
      && tokens.some((token) => matchesToken(`${category.name} ${category.slug}`, token))
    ));

    if (!match) return;

    priorities[match.id] = tokenGroups.length - index;
    usedIds.add(match.id);
  });

  return priorities;
}

function compareItems(
  left: MenuItem,
  right: MenuItem,
  itemScores: Record<string, number>,
  fallbackItemScores: Record<string, number>,
  categoryScores: Record<string, number>,
  manualCategoryPriority: Record<string, number>,
) {
  const itemScoreDelta = (itemScores[right.id] || 0) - (itemScores[left.id] || 0);
  if (itemScoreDelta !== 0) return itemScoreDelta;

  const fallbackScoreDelta = (fallbackItemScores[right.id] || 0) - (fallbackItemScores[left.id] || 0);
  if (fallbackScoreDelta !== 0) return fallbackScoreDelta;

  const categoryScoreDelta = (categoryScores[right.category_id] || 0) - (categoryScores[left.category_id] || 0);
  if (categoryScoreDelta !== 0) return categoryScoreDelta;

  const manualCategoryDelta = (manualCategoryPriority[right.category_id] || 0) - (manualCategoryPriority[left.category_id] || 0);
  if (manualCategoryDelta !== 0) return manualCategoryDelta;

  const ratingDelta = right.rating - left.rating;
  if (ratingDelta !== 0) return ratingDelta;

  return left.display_order - right.display_order;
}

async function fetchOrderItems(orderIds: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < orderIds.length; index += ORDER_ITEM_CHUNK_SIZE) {
    chunks.push(orderIds.slice(index, index + ORDER_ITEM_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) => supabase
      .from('order_items')
      .select('order_id, menu_item_id, quantity')
      .in('order_id', chunk)),
  );

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    throw firstError;
  }

  return results.flatMap((result) => (result.data || []) as OrderItemPopularityRow[]);
}

function addScore(scoreMap: Map<string, number>, id: string, quantity: number) {
  scoreMap.set(id, (scoreMap.get(id) || 0) + quantity);
}

function createEmptyPopularityContext(
  items: MenuItem[],
  categories: Category[],
  slotKey: MenuTimeSlotKey,
): MenuPopularityContext {
  const manualCategoryPriority = getManualCategoryPriority(categories, slotKey);
  const rankedCategories = [...categories].sort((left, right) => {
    const manualDelta = (manualCategoryPriority[right.id] || 0) - (manualCategoryPriority[left.id] || 0);
    if (manualDelta !== 0) return manualDelta;
    return left.display_order - right.display_order;
  });
  const rankedItems = [...items].sort((left, right) => compareItems(
    left,
    right,
    {},
    {},
    {},
    manualCategoryPriority,
  ));

  return {
    slotKey,
    title: getSlotTitle(slotKey),
    subtitle: getSlotSubtitle(slotKey, false),
    itemScores: {},
    fallbackItemScores: {},
    categoryScores: {},
    fallbackCategoryScores: {},
    rankedItems,
    rankedCategories,
    hasLiveData: false,
  };
}

export async function fetchMenuPopularity(
  items: MenuItem[],
  categories: Category[],
  now = new Date(),
): Promise<MenuPopularityContext> {
  const slotKey = getCurrentSlotKey(now);

  if (items.length === 0 || categories.length === 0) {
    return createEmptyPopularityContext(items, categories, slotKey);
  }

  try {
    const since = new Date(now.getTime() - POPULARITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, placed_at, status, payment_status')
      .gte('placed_at', since)
      .order('placed_at', { ascending: false });

    if (ordersError) {
      throw ordersError;
    }

    const validOrders = ((orders || []) as OrderPopularityRow[]).filter((order) => (
      !['cancelled', 'expired'].includes(order.status)
      && order.payment_status !== 'failed'
    ));

    if (validOrders.length === 0) {
      return createEmptyPopularityContext(items, categories, slotKey);
    }

    const itemRows = await fetchOrderItems(validOrders.map((order) => order.id));
    const orderSlotById = new Map(validOrders.map((order) => [order.id, getSlotKeyFromHour(getBusinessHour(order.placed_at))]));
    const slotItemScores = new Map<string, number>();
    const allDayItemScores = new Map<string, number>();

    itemRows.forEach((row) => {
      const quantity = Number(row.quantity || 0);
      if (!row.menu_item_id || quantity <= 0) return;

      addScore(allDayItemScores, row.menu_item_id, quantity);

      if (orderSlotById.get(row.order_id) === slotKey) {
        addScore(slotItemScores, row.menu_item_id, quantity);
      }
    });

    const itemScores = toRecord(slotItemScores);
    const fallbackItemScores = toRecord(allDayItemScores);
    const categoryScores = items.reduce<Record<string, number>>((acc, item) => {
      const score = itemScores[item.id] || 0;
      if (score > 0) {
        acc[item.category_id] = (acc[item.category_id] || 0) + score;
      }
      return acc;
    }, {});
    const fallbackCategoryScores = items.reduce<Record<string, number>>((acc, item) => {
      const score = fallbackItemScores[item.id] || 0;
      if (score > 0) {
        acc[item.category_id] = (acc[item.category_id] || 0) + score;
      }
      return acc;
    }, {});
    const manualCategoryPriority = getManualCategoryPriority(categories, slotKey);
    const rankedItems = [...items].sort((left, right) => compareItems(
      left,
      right,
      itemScores,
      fallbackItemScores,
      categoryScores,
      manualCategoryPriority,
    ));
    const rankedCategories = [...categories].sort((left, right) => {
      const categoryScoreDelta = (categoryScores[right.id] || 0) - (categoryScores[left.id] || 0);
      if (categoryScoreDelta !== 0) return categoryScoreDelta;

      const fallbackCategoryDelta = (fallbackCategoryScores[right.id] || 0) - (fallbackCategoryScores[left.id] || 0);
      if (fallbackCategoryDelta !== 0) return fallbackCategoryDelta;

      const manualDelta = (manualCategoryPriority[right.id] || 0) - (manualCategoryPriority[left.id] || 0);
      if (manualDelta !== 0) return manualDelta;

      return left.display_order - right.display_order;
    });
    const hasLiveData = Object.keys(fallbackItemScores).length > 0;

    return {
      slotKey,
      title: getSlotTitle(slotKey),
      subtitle: getSlotSubtitle(slotKey, hasLiveData),
      itemScores,
      fallbackItemScores,
      categoryScores,
      fallbackCategoryScores,
      rankedItems,
      rankedCategories,
      hasLiveData,
    };
  } catch (error) {
    console.error('Failed to load menu popularity', error);
    return createEmptyPopularityContext(items, categories, slotKey);
  }
}
