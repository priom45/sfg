export const FALLBACK_IMAGE_SRC = '/image.png';

export function normalizeImageUrl(value: string | null | undefined, fallback = FALLBACK_IMAGE_SRC) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  if (/^http:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice('http://'.length)}`;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return trimmed;
}

export function setImageFallback(event: { currentTarget: HTMLImageElement }, fallback = FALLBACK_IMAGE_SRC) {
  if (!event.currentTarget.src.endsWith(fallback)) {
    event.currentTarget.src = fallback;
  }
}
