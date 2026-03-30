let cachedCategoryPreviewOverrideTableSupport: boolean | null = null;

export function getCachedCategoryPreviewOverrideTableSupport() {
  return cachedCategoryPreviewOverrideTableSupport;
}

export function markCategoryPreviewOverrideTableAvailable() {
  cachedCategoryPreviewOverrideTableSupport = true;
}

export function markCategoryPreviewOverrideTableMissing() {
  cachedCategoryPreviewOverrideTableSupport = false;
}
