let cachedOptionPreviewImageColumnSupport: boolean | null = null;

export function getCachedOptionPreviewImageColumnSupport() {
  return cachedOptionPreviewImageColumnSupport;
}

export function markOptionPreviewImageColumnAvailable() {
  cachedOptionPreviewImageColumnSupport = true;
}

export function markOptionPreviewImageColumnMissing() {
  cachedOptionPreviewImageColumnSupport = false;
}
