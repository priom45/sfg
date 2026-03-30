import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import {
  buildCustomizationPreviewOptionRows,
  buildCustomizationTargetOptionRows,
  getEffectiveCustomizationTargets,
  getGroupTargetsForEditor,
  isHiddenCustomizationOption,
  normalizeCustomizationOptionKey,
  parsePreviewMetadataMarker,
} from '../../lib/customizations';
import type {
  Category,
  CustomizationGroup,
  CustomizationOption,
  MenuItem,
} from '../../types';

interface GroupEditorOption {
  name: string;
  price: string;
  preview_image_url: string;
  category_previews: Array<{
    category_id: string;
    preview_image_url: string;
  }>;
  item_previews: Array<{
    menu_item_id: string;
    preview_image_url: string;
  }>;
  is_available: boolean;
}

interface GroupEditorState {
  id?: string;
  name: string;
  selection_type: 'single' | 'multi';
  is_required: boolean;
  category_ids: string[];
  menu_item_ids: string[];
  options: GroupEditorOption[];
  source_option_count: number;
}

const emptyOption = (): GroupEditorOption => ({
  name: '',
  price: '0',
  preview_image_url: '',
  category_previews: [],
  item_previews: [],
  is_available: true,
});

const emptyEditor = (): GroupEditorState => ({
  name: '',
  selection_type: 'multi',
  is_required: false,
  category_ids: [],
  menu_item_ids: [],
  options: [emptyOption()],
  source_option_count: 0,
});

function normalizeItemName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function buildCategoryPreviewRows(
  groupId: string,
  optionName: string,
  options: CustomizationOption[],
) {
  return options
    .filter((option) => option.group_id === groupId)
    .map((option) => parsePreviewMetadataMarker(option.name))
    .filter((metadata): metadata is NonNullable<typeof metadata> => (
      Boolean(
        metadata
        && normalizeCustomizationOptionKey(metadata.option_name) === normalizeCustomizationOptionKey(optionName)
        && metadata.category_id,
      )
    ))
    .map((metadata) => ({
      category_id: metadata.category_id || '',
      preview_image_url: metadata.preview_image_url || '',
    }));
}

function buildItemPreviewRows(
  groupId: string,
  optionName: string,
  options: CustomizationOption[],
) {
  return options
    .filter((option) => option.group_id === groupId)
    .map((option) => parsePreviewMetadataMarker(option.name))
    .filter((metadata): metadata is NonNullable<typeof metadata> => (
      Boolean(
        metadata
        && normalizeCustomizationOptionKey(metadata.option_name) === normalizeCustomizationOptionKey(optionName)
        && metadata.menu_item_id,
      )
    ))
    .map((metadata) => ({
      menu_item_id: metadata.menu_item_id || '',
      preview_image_url: metadata.preview_image_url || '',
    }));
}

function getDefaultPreviewImageUrl(
  groupId: string,
  optionName: string,
  options: CustomizationOption[],
) {
  const previewRow = options
    .filter((option) => option.group_id === groupId)
    .map((option) => parsePreviewMetadataMarker(option.name))
    .find((metadata) => (
      metadata
      && normalizeCustomizationOptionKey(metadata.option_name) === normalizeCustomizationOptionKey(optionName)
      && !metadata.category_id
      && !metadata.menu_item_id
    ));

  return previewRow?.preview_image_url || '';
}

function getNextPreviewCategoryId(
  categoryIds: string[],
  rows: Array<{ category_id: string; preview_image_url: string }>,
) {
  return categoryIds.find((categoryId) => !rows.some((row) => row.category_id === categoryId)) || categoryIds[0] || '';
}

function getNextPreviewItemId(
  menuItemIds: string[],
  rows: Array<{ menu_item_id: string; preview_image_url: string }>,
) {
  return menuItemIds.find((menuItemId) => !rows.some((row) => row.menu_item_id === menuItemId)) || menuItemIds[0] || '';
}

export default function CustomizationAssignmentsManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [groups, setGroups] = useState<CustomizationGroup[]>([]);
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<GroupEditorState | null>(null);
  const { showToast } = useToast();

  const effectiveTargets = useMemo(() => getEffectiveCustomizationTargets(options), [options]);
  const itemsByCategory = useMemo(() => (
    categories.map((category) => ({
      category,
      items: items.filter((item) => item.category_id === category.id),
    })).filter((group) => group.items.length > 0)
  ), [categories, items]);

  const categoryById = useMemo(() => (
    Object.fromEntries(categories.map((category) => [category.id, category]))
  ), [categories]);
  const previewableItems = useMemo(() => {
    if (!editingGroup) return [];

    const seen = new Set<string>();
    return items.filter((item) => {
      const isCoveredByGroup = editingGroup.category_ids.includes(item.category_id) || editingGroup.menu_item_ids.includes(item.id);
      if (!isCoveredByGroup || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [editingGroup, items]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [categoriesRes, itemsRes, groupsRes, optionsRes] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('menu_items').select('*').order('display_order'),
      supabase.from('customization_groups').select('*').order('display_order'),
      supabase.from('customization_options').select('*').order('display_order'),
    ]);

    const firstError = [
      categoriesRes.error,
      itemsRes.error,
      groupsRes.error,
      optionsRes.error,
    ].find(Boolean);

    if (firstError) {
      showToast(firstError.message || 'Failed to load add-on settings', 'error');
    }

    setCategories(categoriesRes.data || []);
    setItems(itemsRes.data || []);
    setGroups(groupsRes.data || []);
    setOptions(optionsRes.data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function editGroup(group: CustomizationGroup) {
    const groupOptions = options
      .filter((option) => option.group_id === group.id && !isHiddenCustomizationOption(option))
      .sort((a, b) => a.display_order - b.display_order)
      .map((option) => ({
        name: option.name,
        price: String(option.price),
        preview_image_url: getDefaultPreviewImageUrl(group.id, option.name, options) || option.preview_image_url || '',
        category_previews: buildCategoryPreviewRows(group.id, option.name, options),
        item_previews: buildItemPreviewRows(group.id, option.name, options),
        is_available: option.is_available,
      }));
    const groupTargets = getGroupTargetsForEditor(group.id, effectiveTargets);

    setEditingGroup({
      id: group.id,
      name: group.name,
      selection_type: group.selection_type,
      is_required: group.is_required,
      category_ids: groupTargets.categoryIds,
      menu_item_ids: groupTargets.menuItemIds,
      options: groupOptions.length ? groupOptions : [emptyOption()],
      source_option_count: groupOptions.length,
    });
  }

  async function saveGroup() {
    if (!editingGroup) return;

    const name = editingGroup.name.trim();
    if (!name) {
      showToast('Add-on group name is required', 'error');
      return;
    }

    if (editingGroup.category_ids.length === 0 && editingGroup.menu_item_ids.length === 0) {
      showToast('Assign the add-on group to at least one category or item', 'error');
      return;
    }

    const effectivePreviewItemIds = new Set(
      items
        .filter((item) => (
          editingGroup.category_ids.includes(item.category_id)
          || editingGroup.menu_item_ids.includes(item.id)
        ))
        .map((item) => item.id),
    );

    const cleanedOptions = editingGroup.options
      .map((option, index) => ({
        name: option.name.trim(),
        price: parseFloat(option.price) || 0,
        preview_image_url: option.preview_image_url.trim(),
        category_previews: option.category_previews
          .map((row) => ({
            category_id: row.category_id,
            preview_image_url: row.preview_image_url.trim(),
          }))
          .filter((row) => (
            row.category_id
            && row.preview_image_url
            && editingGroup.category_ids.includes(row.category_id)
          )),
        item_previews: option.item_previews
          .map((row) => ({
            menu_item_id: row.menu_item_id,
            preview_image_url: row.preview_image_url.trim(),
          }))
          .filter((row) => row.menu_item_id && row.preview_image_url && effectivePreviewItemIds.has(row.menu_item_id)),
        is_available: option.is_available,
        display_order: index,
      }))
      .filter((option) => option.name);

    if (cleanedOptions.length === 0) {
      showToast('Add at least one option to the add-on group', 'error');
      return;
    }

    const groupPayload = {
      name,
      selection_type: editingGroup.selection_type,
      is_required: editingGroup.is_required,
      display_order: editingGroup.id
        ? undefined
        : groups.reduce((maxOrder, group) => Math.max(maxOrder, group.display_order), -1) + 1,
    };

    let groupId = editingGroup.id;

    if (editingGroup.id) {
      const { error } = await supabase
        .from('customization_groups')
        .update(groupPayload)
        .eq('id', editingGroup.id);

      if (error) {
        showToast(error.message || 'Failed to update add-on group', 'error');
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('customization_groups')
        .insert(groupPayload)
        .select('id')
        .single();

      if (error || !data) {
        showToast(error?.message || 'Failed to create add-on group', 'error');
        return;
      }

      groupId = data.id;
    }

    if (!groupId) {
      showToast('Failed to resolve add-on group id', 'error');
      return;
    }

    const previousOptions = editingGroup.id
      ? options.filter((option) => option.group_id === groupId)
      : [];
    const restorePreviousOptions = async () => {
      if (previousOptions.length === 0) return;

      await supabase
        .from('customization_options')
        .insert(previousOptions.map((option) => ({
          id: option.id,
          group_id: option.group_id,
          name: option.name,
          price: option.price,
          is_available: option.is_available,
          display_order: option.display_order,
          created_at: option.created_at,
          ...(option.preview_image_url !== undefined ? { preview_image_url: option.preview_image_url || '' } : {}),
        })));
    };

    const targetRows = buildCustomizationTargetOptionRows(
      groupId,
      editingGroup.category_ids,
      editingGroup.menu_item_ids,
      cleanedOptions.length,
    );
    const previewRows = buildCustomizationPreviewOptionRows(
      groupId,
      cleanedOptions,
      cleanedOptions.length + targetRows.length,
    );
    const nextOptionRows = [
      ...cleanedOptions.map((option) => ({
        group_id: groupId!,
        name: option.name,
        price: option.price,
        is_available: option.is_available,
        display_order: option.display_order,
      })),
      ...targetRows,
      ...previewRows,
    ];

    const { error: deleteOptionsError } = await supabase
      .from('customization_options')
      .delete()
      .eq('group_id', groupId);

    if (deleteOptionsError) {
      showToast(deleteOptionsError.message || 'Failed to replace add-on options', 'error');
      return;
    }

    const { error: insertOptionsError } = await supabase
      .from('customization_options')
      .insert(nextOptionRows);

    if (insertOptionsError) {
      await restorePreviousOptions();
      showToast(insertOptionsError.message || 'Failed to save add-on options', 'error');
      return;
    }

    showToast(
      `${editingGroup.id ? 'Add-on group updated' : 'Add-on group created'} (${cleanedOptions.length} options, ${previewRows.length} preview rows)`,
    );
    setEditingGroup(null);
    await loadData();
  }

  async function deleteGroup(groupId: string) {
    if (!window.confirm('Delete this add-on group and all of its options?')) return;

    const { error: deleteOptionsError } = await supabase
      .from('customization_options')
      .delete()
      .eq('group_id', groupId);

    if (deleteOptionsError) {
      showToast(deleteOptionsError.message || 'Failed to remove add-on options', 'error');
      return;
    }

    const { error } = await supabase
      .from('customization_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      showToast(error.message || 'Failed to delete add-on group', 'error');
      return;
    }

    showToast('Add-on group deleted');
    if (editingGroup?.id === groupId) setEditingGroup(null);
    await loadData();
  }

  function toggleSelection(list: string[], value: string, checked: boolean) {
    return checked
      ? [...list, value]
      : list.filter((entry) => entry !== value);
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Add-On Management</h2>
          <p className="text-sm text-brand-text-muted">If you pick specific items, the group applies only to those items. Category assignment is used only when no specific items are selected.</p>
        </div>
        <button
          onClick={() => setEditingGroup(emptyEditor())}
          className="flex items-center gap-1 text-sm text-brand-gold font-semibold"
        >
          <Plus size={16} />
          Add Add-On Group
        </button>
      </div>

      {editingGroup && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-4 mb-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">{editingGroup.id ? 'Edit Add-On Group' : 'Create Add-On Group'}</h3>
            <button
              onClick={() => setEditingGroup(null)}
              className="p-2 rounded-lg text-brand-text-dim hover:text-white hover:bg-brand-surface-light/70 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              placeholder="Group name"
              value={editingGroup.name}
              onChange={(event) => setEditingGroup({ ...editingGroup, name: event.target.value })}
              className="input-field"
            />
            <select
              value={editingGroup.selection_type}
              onChange={(event) => setEditingGroup({ ...editingGroup, selection_type: event.target.value as 'single' | 'multi' })}
              className="input-field"
            >
              <option value="single">Choose one</option>
              <option value="multi">Choose multiple</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-brand-text-muted px-3 py-3 rounded-xl border border-brand-border">
              <input
                type="checkbox"
                checked={editingGroup.is_required}
                onChange={(event) => setEditingGroup({ ...editingGroup, is_required: event.target.checked })}
                className="rounded"
              />
              Required
            </label>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-brand-border p-4">
              <h4 className="font-semibold text-white mb-3">Assign to Categories</h4>
              <p className="mb-3 text-xs text-brand-text-muted">
                Use this for whole-category add-ons. If specific items are checked on the right, those items override the category-wide assignment.
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 text-sm text-brand-text-muted">
                    <input
                      type="checkbox"
                      checked={editingGroup.category_ids.includes(category.id)}
                      onChange={(event) => setEditingGroup({
                        ...editingGroup,
                        category_ids: toggleSelection(editingGroup.category_ids, category.id, event.target.checked),
                      })}
                      className="rounded"
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-brand-border p-4">
              <h4 className="font-semibold text-white mb-3">Assign to Specific Items</h4>
              <p className="mb-3 text-xs text-brand-text-muted">
                If any items are checked here, this add-on group will apply only to those selected items.
              </p>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {itemsByCategory.map((group) => (
                  <div key={group.category.id}>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-gold mb-2">{group.category.name}</p>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm text-brand-text-muted">
                          <input
                            type="checkbox"
                            checked={editingGroup.menu_item_ids.includes(item.id)}
                            onChange={(event) => setEditingGroup({
                              ...editingGroup,
                              menu_item_ids: toggleSelection(editingGroup.menu_item_ids, item.id, event.target.checked),
                            })}
                            className="rounded"
                          />
                          {normalizeItemName(item.name)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-brand-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">Options</h4>
              <button
                onClick={() => setEditingGroup({
                  ...editingGroup,
                  options: [...editingGroup.options, emptyOption()],
                })}
                className="text-sm text-brand-gold font-semibold"
              >
                Add Option
              </button>
            </div>
            <p className="mb-3 text-xs text-brand-text-muted">
              Optional preview image: when customers pick this option, the product preview updates to this image. Later groups override earlier groups.
            </p>
            {editingGroup.id && editingGroup.source_option_count === 0 && (
              <p className="mb-3 text-xs text-brand-gold">
                No saved options were found for this group. Add them again and save to restore the group.
              </p>
            )}

            <div className="space-y-3">
              {editingGroup.options.map((option, index) => (
                <div key={index} className="space-y-3 rounded-xl border border-brand-border/50 p-3">
                  <div className="grid grid-cols-1 gap-3 items-center lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_120px_auto]">
                    <input
                      placeholder="Option name"
                      value={option.name}
                      onChange={(event) => {
                        const nextOptions = [...editingGroup.options];
                        nextOptions[index] = { ...option, name: event.target.value };
                        setEditingGroup({ ...editingGroup, options: nextOptions });
                      }}
                      className="input-field"
                    />
                    <input
                      placeholder="Price"
                      type="number"
                      value={option.price}
                      onChange={(event) => {
                        const nextOptions = [...editingGroup.options];
                        nextOptions[index] = { ...option, price: event.target.value };
                        setEditingGroup({ ...editingGroup, options: nextOptions });
                      }}
                      className="input-field"
                    />
                    <input
                      placeholder="Default preview image URL"
                      value={option.preview_image_url}
                      onChange={(event) => {
                        const nextOptions = [...editingGroup.options];
                        nextOptions[index] = { ...option, preview_image_url: event.target.value };
                        setEditingGroup({ ...editingGroup, options: nextOptions });
                      }}
                      className="input-field"
                    />
                    <label className="flex items-center gap-2 text-sm text-brand-text-muted">
                      <input
                        type="checkbox"
                        checked={option.is_available}
                        onChange={(event) => {
                          const nextOptions = [...editingGroup.options];
                          nextOptions[index] = { ...option, is_available: event.target.checked };
                          setEditingGroup({ ...editingGroup, options: nextOptions });
                        }}
                        className="rounded"
                      />
                      Available
                    </label>
                    <button
                      onClick={() => setEditingGroup({
                        ...editingGroup,
                        options: editingGroup.options.length === 1
                          ? [emptyOption()]
                          : editingGroup.options.filter((_, optionIndex) => optionIndex !== index),
                      })}
                      className="p-2 rounded-lg text-brand-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors justify-self-end"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {editingGroup.category_ids.length > 0 && (
                    <div className="rounded-xl border border-brand-border/40 bg-brand-surface-light/30 p-3">
                      <p className="mb-2 text-xs text-brand-text-muted">
                        Add category-specific preview images only where needed. These override the default preview for the selected category.
                      </p>
                      <div className="space-y-3">
                        {option.category_previews
                          .filter((row) => editingGroup.category_ids.includes(row.category_id))
                          .map((row, rowIndex) => (
                            <div key={`${row.category_id}-${rowIndex}`} className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_auto] gap-3 items-center">
                              <select
                                value={row.category_id}
                                onChange={(event) => {
                                  const nextOptions = [...editingGroup.options];
                                  const nextRows = [...option.category_previews];
                                  nextRows[rowIndex] = {
                                    ...row,
                                    category_id: event.target.value,
                                  };
                                  nextOptions[index] = {
                                    ...option,
                                    category_previews: nextRows,
                                  };
                                  setEditingGroup({ ...editingGroup, options: nextOptions });
                                }}
                                className="input-field"
                              >
                                {editingGroup.category_ids.map((categoryId) => (
                                  <option key={categoryId} value={categoryId}>
                                    {categoryById[categoryId]?.name || 'Category'}
                                  </option>
                                ))}
                              </select>
                              <input
                                placeholder="Preview image URL for this category"
                                value={row.preview_image_url}
                                onChange={(event) => {
                                  const nextOptions = [...editingGroup.options];
                                  const nextRows = [...option.category_previews];
                                  nextRows[rowIndex] = {
                                    ...row,
                                    preview_image_url: event.target.value,
                                  };
                                  nextOptions[index] = {
                                    ...option,
                                    category_previews: nextRows,
                                  };
                                  setEditingGroup({ ...editingGroup, options: nextOptions });
                                }}
                                className="input-field"
                              />
                              <button
                                onClick={() => {
                                  const nextOptions = [...editingGroup.options];
                                  nextOptions[index] = {
                                    ...option,
                                    category_previews: option.category_previews.filter((_, currentIndex) => currentIndex !== rowIndex),
                                  };
                                  setEditingGroup({ ...editingGroup, options: nextOptions });
                                }}
                                className="p-2 rounded-lg text-brand-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors justify-self-end"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}

                        <button
                          onClick={() => {
                            const nextCategoryId = getNextPreviewCategoryId(editingGroup.category_ids, option.category_previews);
                            if (!nextCategoryId) return;
                            const nextOptions = [...editingGroup.options];
                            nextOptions[index] = {
                              ...option,
                              category_previews: [
                                ...option.category_previews,
                                {
                                  category_id: nextCategoryId,
                                  preview_image_url: '',
                                },
                              ],
                            };
                            setEditingGroup({ ...editingGroup, options: nextOptions });
                          }}
                          className="text-sm text-brand-gold font-semibold"
                        >
                          Add Category Preview
                        </button>
                      </div>
                    </div>
                  )}

                  {previewableItems.length > 0 && (
                    <div className="rounded-xl border border-brand-border/40 bg-brand-surface-light/30 p-3">
                      <p className="mb-2 text-xs text-brand-text-muted">
                        Item-specific preview images override both the default preview and category preview. Use this for cone waffle items with different scoop flavors.
                      </p>
                      <div className="space-y-3">
                        {option.item_previews
                          .filter((row) => previewableItems.some((item) => item.id === row.menu_item_id))
                          .map((row, rowIndex) => (
                            <div key={`${row.menu_item_id}-${rowIndex}`} className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_auto] gap-3 items-center">
                              <select
                                value={row.menu_item_id}
                                onChange={(event) => {
                                  const nextOptions = [...editingGroup.options];
                                  const nextRows = [...option.item_previews];
                                  nextRows[rowIndex] = {
                                    ...row,
                                    menu_item_id: event.target.value,
                                  };
                                  nextOptions[index] = {
                                    ...option,
                                    item_previews: nextRows,
                                  };
                                  setEditingGroup({ ...editingGroup, options: nextOptions });
                                }}
                                className="input-field"
                              >
                                {previewableItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {normalizeItemName(item.name)}
                                  </option>
                                ))}
                              </select>
                              <input
                                placeholder="Preview image URL for this item"
                                value={row.preview_image_url}
                                onChange={(event) => {
                                  const nextOptions = [...editingGroup.options];
                                  const nextRows = [...option.item_previews];
                                  nextRows[rowIndex] = {
                                    ...row,
                                    preview_image_url: event.target.value,
                                  };
                                  nextOptions[index] = {
                                    ...option,
                                    item_previews: nextRows,
                                  };
                                  setEditingGroup({ ...editingGroup, options: nextOptions });
                                }}
                                className="input-field"
                              />
                              <button
                                onClick={() => {
                                  const nextOptions = [...editingGroup.options];
                                  nextOptions[index] = {
                                    ...option,
                                    item_previews: option.item_previews.filter((_, currentIndex) => currentIndex !== rowIndex),
                                  };
                                  setEditingGroup({ ...editingGroup, options: nextOptions });
                                }}
                                className="p-2 rounded-lg text-brand-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors justify-self-end"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}

                        <button
                          onClick={() => {
                            const nextItemId = getNextPreviewItemId(
                              previewableItems.map((item) => item.id),
                              option.item_previews,
                            );
                            if (!nextItemId) return;
                            const nextOptions = [...editingGroup.options];
                            nextOptions[index] = {
                              ...option,
                              item_previews: [
                                ...option.item_previews,
                                {
                                  menu_item_id: nextItemId,
                                  preview_image_url: '',
                                },
                              ],
                            };
                            setEditingGroup({ ...editingGroup, options: nextOptions });
                          }}
                          className="text-sm text-brand-gold font-semibold"
                        >
                          Add Item Preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void saveGroup()}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
            >
              <Save size={14} />
              {editingGroup.id ? 'Update Group' : 'Create Group'}
            </button>
            <button
              onClick={() => setEditingGroup(null)}
              className="btn-outline text-sm px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-8 text-center text-brand-text-muted">
          Loading add-on groups...
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-8 text-center text-brand-text-muted">
          No add-on groups created yet
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupOptions = options.filter((option) => option.group_id === group.id && !isHiddenCustomizationOption(option));
            const groupTargets = getGroupTargetsForEditor(group.id, effectiveTargets);
            const categoryNames = categories
              .filter((category) => groupTargets.categoryIds.includes(category.id))
              .map((category) => category.name);
            const itemNames = items
              .filter((item) => groupTargets.menuItemIds.includes(item.id))
              .map((item) => normalizeItemName(item.name));

            return (
              <div key={group.id} className="bg-brand-surface rounded-xl border border-brand-border p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{group.name}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold">
                        {group.selection_type === 'single' ? 'Choose one' : 'Choose multiple'}
                      </span>
                      {group.is_required && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-brand-text-muted">
                      {categoryNames.length > 0 && <p>Categories: {categoryNames.join(', ')}</p>}
                      {itemNames.length > 0 && <p>Items: {itemNames.join(', ')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => editGroup(group)}
                      className="p-2 rounded-lg text-brand-text-dim hover:text-white hover:bg-brand-surface-light/70 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => void deleteGroup(group.id)}
                      className="p-2 rounded-lg text-brand-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {groupOptions.map((option) => (
                    <span
                      key={`${group.id}-${option.name}-${option.display_order}`}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-surface-light px-3 py-1 text-xs text-brand-text-muted border border-brand-border"
                    >
                      <span>{option.name}</span>
                      {option.price > 0 && <span className="text-brand-gold">+₹{option.price}</span>}
                      {option.preview_image_url && <span className="text-brand-gold/80">preview</span>}
                      {!option.is_available && <span className="text-red-400">(hidden)</span>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
