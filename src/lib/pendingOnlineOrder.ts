const PENDING_ONLINE_ORDER_STORAGE_KEY = 'supreme-waffle-pending-online-order';
const PENDING_ONLINE_ORDER_TTL_MS = 30 * 60 * 1000;

interface PendingOnlineOrderState {
  orderId: string;
  createdAt: number;
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function storePendingOnlineOrder(orderId: string) {
  if (!canUseSessionStorage() || !orderId.trim()) return;

  const payload: PendingOnlineOrderState = {
    orderId: orderId.trim(),
    createdAt: Date.now(),
  };

  window.sessionStorage.setItem(PENDING_ONLINE_ORDER_STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingOnlineOrder() {
  if (!canUseSessionStorage()) return null;

  const rawValue = window.sessionStorage.getItem(PENDING_ONLINE_ORDER_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<PendingOnlineOrderState>;
    if (typeof parsed.orderId !== 'string' || !parsed.orderId.trim() || typeof parsed.createdAt !== 'number') {
      window.sessionStorage.removeItem(PENDING_ONLINE_ORDER_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.createdAt > PENDING_ONLINE_ORDER_TTL_MS) {
      window.sessionStorage.removeItem(PENDING_ONLINE_ORDER_STORAGE_KEY);
      return null;
    }

    return parsed.orderId.trim();
  } catch {
    window.sessionStorage.removeItem(PENDING_ONLINE_ORDER_STORAGE_KEY);
    return null;
  }
}

export function clearPendingOnlineOrder(orderId?: string) {
  if (!canUseSessionStorage()) return;

  if (!orderId) {
    window.sessionStorage.removeItem(PENDING_ONLINE_ORDER_STORAGE_KEY);
    return;
  }

  const storedOrderId = readPendingOnlineOrder();
  if (storedOrderId === orderId.trim()) {
    window.sessionStorage.removeItem(PENDING_ONLINE_ORDER_STORAGE_KEY);
  }
}
