import type { MenuItem } from '../types';

const FALLBACK_CUSTOMIZATION_CATEGORY_IDS = new Set([
  'c0000000-0001-0000-0000-000000000001',
  'c0000000-0001-0000-0000-000000000002',
  'c0000000-0001-0000-0000-000000000004',
  'c0000000-0001-0000-0000-000000000005',
  'c0000000-0001-0000-0000-000000000006',
]);

export function menuItemSupportsCustomizations(item: Pick<MenuItem, 'category_id' | 'has_customizations'>) {
  if (typeof item.has_customizations === 'boolean') {
    return item.has_customizations;
  }

  return FALLBACK_CUSTOMIZATION_CATEGORY_IDS.has(item.category_id);
}
