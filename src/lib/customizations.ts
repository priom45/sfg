import { supabase } from './supabase';
import {
  getFallbackCustomizationTargets,
  getFallbackGroupIdsForItem,
} from './customizationFallbackTargets';
import { menuItemSupportsCustomizations } from './menuItems';
import type {
  CustomizationGroup,
  CustomizationGroupTarget,
  CustomizationOption,
  MenuItem,
} from '../types';

export interface CustomizationGroupWithOptions extends CustomizationGroup {
  options: CustomizationOption[];
}

export interface CustomizationAvailability {
  categoryIds: Set<string>;
  itemIds: Set<string>;
}

interface ResolvedCustomizationTargetSet {
  categoryIds: Set<string>;
  itemIds: Set<string>;
}

const CATEGORY_TARGET_PREFIX = '__target_category__:';
const ITEM_TARGET_PREFIX = '__target_item__:';
const PREVIEW_METADATA_PREFIX = '__preview_metadata__:';

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeCustomizationOptionKey(value: string) {
  const aliases: Record<string, string> = {
    vanila: 'vanilla',
    choco: 'chocolate',
  };

  const tokens = normalizeLabel(value)
    .replace(/[()/_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => aliases[token] || token);

  return [...new Set(tokens)].sort().join(' ');
}

function parseTargetMarker(name: string) {
  if (name.startsWith(CATEGORY_TARGET_PREFIX)) {
    return {
      category_id: name.slice(CATEGORY_TARGET_PREFIX.length),
      menu_item_id: null,
    };
  }

  if (name.startsWith(ITEM_TARGET_PREFIX)) {
    return {
      category_id: null,
      menu_item_id: name.slice(ITEM_TARGET_PREFIX.length),
    };
  }

  return null;
}

interface PreviewMetadataMarker {
  option_name: string;
  preview_image_url: string;
  category_id: string | null;
  menu_item_id: string | null;
}

function encodePreviewMetadata(metadata: PreviewMetadataMarker) {
  return `${PREVIEW_METADATA_PREFIX}${encodeURIComponent(JSON.stringify(metadata))}`;
}

export function parsePreviewMetadataMarker(name: string): PreviewMetadataMarker | null {
  if (!name.startsWith(PREVIEW_METADATA_PREFIX)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeURIComponent(name.slice(PREVIEW_METADATA_PREFIX.length)));
    if (
      typeof payload?.option_name !== 'string'
      || typeof payload?.preview_image_url !== 'string'
    ) {
      return null;
    }

    return {
      option_name: payload.option_name,
      preview_image_url: payload.preview_image_url,
      category_id: typeof payload.category_id === 'string' ? payload.category_id : null,
      menu_item_id: typeof payload.menu_item_id === 'string' ? payload.menu_item_id : null,
    };
  } catch {
    return null;
  }
}

export function isTargetMarkerOption(option: Pick<CustomizationOption, 'name'>) {
  return Boolean(parseTargetMarker(option.name));
}

export function isPreviewMetadataOption(option: Pick<CustomizationOption, 'name'>) {
  return Boolean(parsePreviewMetadataMarker(option.name));
}

export function isHiddenCustomizationOption(option: Pick<CustomizationOption, 'name'>) {
  return isTargetMarkerOption(option) || isPreviewMetadataOption(option);
}

export function getEffectiveCustomizationTargets(
  options: Pick<CustomizationOption, 'group_id' | 'name'>[],
): CustomizationGroupTarget[] {
  const explicitTargets: CustomizationGroupTarget[] = [];
  const explicitGroupIds = new Set<string>();

  options.forEach((option, index) => {
    const target = parseTargetMarker(option.name);
    if (!target) return;

    explicitGroupIds.add(option.group_id);
    explicitTargets.push({
      id: `option-target-${option.group_id}-${index}`,
      group_id: option.group_id,
      category_id: target.category_id,
      menu_item_id: target.menu_item_id,
    });
  });

  const fallbackTargets = getFallbackCustomizationTargets()
    .filter((target) => !explicitGroupIds.has(target.group_id));

  return [...fallbackTargets, ...explicitTargets];
}

function buildResolvedCustomizationTargetMap(targets: CustomizationGroupTarget[]) {
  const groupedTargets = new Map<string, ResolvedCustomizationTargetSet>();

  targets.forEach((target) => {
    if (!groupedTargets.has(target.group_id)) {
      groupedTargets.set(target.group_id, {
        categoryIds: new Set<string>(),
        itemIds: new Set<string>(),
      });
    }

    const entry = groupedTargets.get(target.group_id)!;
    if (target.category_id) entry.categoryIds.add(target.category_id);
    if (target.menu_item_id) entry.itemIds.add(target.menu_item_id);
  });

  return groupedTargets;
}

function groupAppliesToItem(
  targets: ResolvedCustomizationTargetSet | undefined,
  item: Pick<MenuItem, 'id' | 'category_id'>,
) {
  if (!targets) return false;
  if (targets.itemIds.size > 0) {
    return targets.itemIds.has(item.id);
  }

  return targets.categoryIds.has(item.category_id);
}

export function buildCustomizationTargetOptionRows(
  groupId: string,
  categoryIds: string[],
  menuItemIds: string[],
  displayOrderStart: number,
) {
  let displayOrder = displayOrderStart;

  return [
    ...categoryIds.map((categoryId) => ({
      group_id: groupId,
      name: `${CATEGORY_TARGET_PREFIX}${categoryId}`,
      price: 0,
      is_available: true,
      display_order: displayOrder++,
    })),
    ...menuItemIds.map((menuItemId) => ({
      group_id: groupId,
      name: `${ITEM_TARGET_PREFIX}${menuItemId}`,
      price: 0,
      is_available: true,
      display_order: displayOrder++,
    })),
  ];
}

export function buildCustomizationPreviewOptionRows(
  groupId: string,
  options: Array<{
    name: string;
    preview_image_url?: string;
    category_previews?: Array<{ category_id: string; preview_image_url: string }>;
    item_previews?: Array<{ menu_item_id: string; preview_image_url: string }>;
  }>,
  displayOrderStart: number,
) {
  let displayOrder = displayOrderStart;

  return options.flatMap((option) => {
    const rows: Array<{
      group_id: string;
      name: string;
      price: number;
      is_available: boolean;
      display_order: number;
    }> = [];

    const defaultPreviewImageUrl = option.preview_image_url?.trim();
    if (defaultPreviewImageUrl) {
      rows.push({
        group_id: groupId,
        name: encodePreviewMetadata({
          option_name: option.name,
          preview_image_url: defaultPreviewImageUrl,
          category_id: null,
          menu_item_id: null,
        }),
        price: 0,
        is_available: true,
        display_order: displayOrder++,
      });
    }

    (option.category_previews || []).forEach((row) => {
      if (!row.category_id || !row.preview_image_url?.trim()) return;

      rows.push({
        group_id: groupId,
        name: encodePreviewMetadata({
          option_name: option.name,
          preview_image_url: row.preview_image_url.trim(),
          category_id: row.category_id,
          menu_item_id: null,
        }),
        price: 0,
        is_available: true,
        display_order: displayOrder++,
      });
    });

    (option.item_previews || []).forEach((row) => {
      if (!row.menu_item_id || !row.preview_image_url?.trim()) return;

      rows.push({
        group_id: groupId,
        name: encodePreviewMetadata({
          option_name: option.name,
          preview_image_url: row.preview_image_url.trim(),
          category_id: null,
          menu_item_id: row.menu_item_id,
        }),
        price: 0,
        is_available: true,
        display_order: displayOrder++,
      });
    });

    return rows;
  });
}

function buildPreviewOverrideLookups(
  options: Pick<CustomizationOption, 'group_id' | 'name' | 'preview_image_url'>[],
) {
  const categoryLookup = new Map<string, string>();
  const itemLookup = new Map<string, string>();
  const defaultLookup = new Map<string, string>();

  options.forEach((option) => {
    const metadata = parsePreviewMetadataMarker(option.name);
    if (!metadata) return;

    const previewImageUrl = metadata.preview_image_url.trim();
    if (!previewImageUrl) return;

    const key = `${option.group_id}::${normalizeCustomizationOptionKey(metadata.option_name)}`;
    if (metadata.menu_item_id) {
      itemLookup.set(`${key}::item::${metadata.menu_item_id}`, previewImageUrl);
      return;
    }

    if (metadata.category_id) {
      categoryLookup.set(`${key}::category::${metadata.category_id}`, previewImageUrl);
      return;
    }

    defaultLookup.set(key, previewImageUrl);
  });

  return { categoryLookup, itemLookup, defaultLookup };
}

function applyPreviewOverridesToOptions(
  options: CustomizationOption[],
  item: Pick<MenuItem, 'id' | 'category_id'>,
  resolvedTargets: Map<string, ResolvedCustomizationTargetSet>,
  previewOverrideLookups: {
    categoryLookup: Map<string, string>;
    itemLookup: Map<string, string>;
    defaultLookup: Map<string, string>;
  },
) {
  return options.map((option) => {
    const groupTargets = resolvedTargets.get(option.group_id);
    const isSingleItemScopedGroup = Boolean(
      groupTargets
      && groupTargets.itemIds.size === 1
      && groupTargets.itemIds.has(item.id),
    );
    const optionKey = `${option.group_id}::${normalizeCustomizationOptionKey(option.name)}`;
    const itemPreview = previewOverrideLookups.itemLookup.get(`${optionKey}::item::${item.id}`);
    if (itemPreview) {
      return {
        ...option,
        preview_image_url: itemPreview,
        preview_image_source: 'item' as const,
      };
    }

    const categoryPreview = previewOverrideLookups.categoryLookup.get(`${optionKey}::category::${item.category_id}`);
    if (categoryPreview) {
      return {
        ...option,
        preview_image_url: categoryPreview,
        preview_image_source: isSingleItemScopedGroup ? 'item' as const : 'category' as const,
      };
    }

    const defaultPreview = previewOverrideLookups.defaultLookup.get(optionKey);
    if (defaultPreview) {
      return {
        ...option,
        preview_image_url: defaultPreview,
        preview_image_source: isSingleItemScopedGroup ? 'item' as const : 'default' as const,
      };
    }

    return {
      ...option,
      preview_image_source: option.preview_image_url ? 'default' as const : null,
    };
  });
}

async function loadCustomizationGroupsByIds(
  groupIds: string[],
  item?: Pick<MenuItem, 'id' | 'category_id'>,
) {
  if (!groupIds.length) return [];

  const [groupsResponse, optionsResponse] = await Promise.all([
    supabase
      .from('customization_groups')
      .select('*')
      .in('id', groupIds)
      .order('display_order'),
    supabase
      .from('customization_options')
      .select('*')
      .in('group_id', groupIds)
      .order('display_order'),
  ]);

  if (groupsResponse.error) throw groupsResponse.error;
  if (optionsResponse.error) throw optionsResponse.error;

  const resolvedTargets = buildResolvedCustomizationTargetMap(
    getEffectiveCustomizationTargets((optionsResponse.data || []) as Pick<CustomizationOption, 'group_id' | 'name'>[]),
  );
  const previewOverrideLookups = buildPreviewOverrideLookups(
    (optionsResponse.data || []) as Pick<CustomizationOption, 'group_id' | 'name' | 'preview_image_url'>[],
  );
  const visibleOptions = applyPreviewOverridesToOptions(
    (optionsResponse.data || []).filter((option) => option.is_available && !isHiddenCustomizationOption(option)),
    item || { id: '', category_id: '' },
    resolvedTargets,
    previewOverrideLookups,
  );

  return (groupsResponse.data || []).map((group) => ({
    ...group,
    options: visibleOptions.filter((option) => option.group_id === group.id),
  }));
}

export async function fetchCustomizationAvailability(): Promise<CustomizationAvailability | null> {
  const { data, error } = await supabase
    .from('customization_options')
    .select('group_id, name');

  if (error) throw error;

  const targets = getEffectiveCustomizationTargets((data || []) as Pick<CustomizationOption, 'group_id' | 'name'>[]);
  const categoryIds = new Set<string>();
  const itemIds = new Set<string>();
  const resolvedTargets = buildResolvedCustomizationTargetMap(targets);

  resolvedTargets.forEach((target) => {
    if (target.itemIds.size > 0) {
      target.itemIds.forEach((itemId) => itemIds.add(itemId));
      return;
    }

    target.categoryIds.forEach((categoryId) => categoryIds.add(categoryId));
  });

  return { categoryIds, itemIds };
}

export function itemHasAssignedCustomizations(
  item: Pick<MenuItem, 'id' | 'category_id' | 'has_customizations'>,
  availability: CustomizationAvailability | null,
) {
  if (!availability) {
    return menuItemSupportsCustomizations(item);
  }

  return availability.itemIds.has(item.id) || availability.categoryIds.has(item.category_id);
}

export async function fetchCustomizationGroupsForItem(item: MenuItem): Promise<CustomizationGroupWithOptions[]> {
  const { data: optionsData, error: optionsError } = await supabase
    .from('customization_options')
    .select('*')
    .order('display_order');

  if (optionsError) throw optionsError;

  const effectiveTargets = getEffectiveCustomizationTargets((optionsData || []) as Pick<CustomizationOption, 'group_id' | 'name'>[]);
  const resolvedTargets = buildResolvedCustomizationTargetMap(effectiveTargets);
  const groupIds = [...resolvedTargets.entries()]
    .filter(([, targets]) => groupAppliesToItem(targets, item))
    .map(([groupId]) => groupId);

  if (!groupIds.length) {
    return loadCustomizationGroupsByIds(getFallbackGroupIdsForItem(item), item);
  }
  const { data: groupsData, error: groupsError } = await supabase
    .from('customization_groups')
    .select('*')
    .in('id', groupIds)
    .order('display_order');

  if (groupsError) throw groupsError;

  const previewOverrideLookups = buildPreviewOverrideLookups(
    (optionsData || []) as Pick<CustomizationOption, 'group_id' | 'name' | 'preview_image_url'>[],
  );
  const visibleOptions = applyPreviewOverridesToOptions(
    (optionsData || []).filter((option) => option.is_available && !isHiddenCustomizationOption(option)),
    item,
    resolvedTargets,
    previewOverrideLookups,
  );

  return (groupsData || []).map((group) => ({
    ...group,
    options: visibleOptions.filter((option) => option.group_id === group.id),
  }));
}

export function getGroupTargetsForEditor(
  groupId: string,
  targets: CustomizationGroupTarget[],
) {
  const categoryIds: string[] = [];
  const menuItemIds: string[] = [];

  targets
    .filter((target) => target.group_id === groupId)
    .forEach((target) => {
      if (target.category_id) categoryIds.push(target.category_id);
      if (target.menu_item_id) menuItemIds.push(target.menu_item_id);
    });

  return { categoryIds, menuItemIds };
}
