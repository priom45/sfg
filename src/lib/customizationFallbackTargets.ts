import type { CustomizationGroupTarget, MenuItem } from '../types';

const FALLBACK_CATEGORY_GROUP_MAP: Record<string, string[]> = {
  'c0000000-0001-0000-0000-000000000001': [
    'd0000000-0001-0000-0000-000000000001',
    'd0000000-0001-0000-0000-000000000002',
    'd0000000-0001-0000-0000-000000000003',
  ],
  'c0000000-0001-0000-0000-000000000002': [
    'd0000000-0001-0000-0000-000000000001',
    'd0000000-0001-0000-0000-000000000002',
    'd0000000-0001-0000-0000-000000000003',
  ],
  'c0000000-0001-0000-0000-000000000004': [
    'd0000000-0001-0000-0000-000000000001',
    'd0000000-0001-0000-0000-000000000002',
    'd0000000-0001-0000-0000-000000000003',
  ],
  'c0000000-0001-0000-0000-000000000005': [
    'd0000000-0001-0000-0000-000000000001',
    'd0000000-0001-0000-0000-000000000002',
    'd0000000-0001-0000-0000-000000000003',
  ],
  'c0000000-0001-0000-0000-000000000006': [
    'd0000000-0001-0000-0000-000000000001',
    'd0000000-0001-0000-0000-000000000002',
    'd0000000-0001-0000-0000-000000000003',
  ],
};

export function getFallbackCustomizationTargets(): CustomizationGroupTarget[] {
  return Object.entries(FALLBACK_CATEGORY_GROUP_MAP).flatMap(([categoryId, groupIds]) =>
    groupIds.map((groupId) => ({
      id: `fallback-${groupId}-${categoryId}`,
      group_id: groupId,
      category_id: categoryId,
      menu_item_id: null,
    })),
  );
}

export function getFallbackGroupIdsForItem(item: Pick<MenuItem, 'category_id'>) {
  return FALLBACK_CATEGORY_GROUP_MAP[item.category_id] || [];
}

export function getFallbackCustomizationAvailability() {
  return {
    categoryIds: new Set(Object.keys(FALLBACK_CATEGORY_GROUP_MAP)),
    itemIds: new Set<string>(),
  };
}
