const CHECKOUT_SUCCESS_STORAGE_KEY = 'supreme-waffle-last-success-order';
const CHECKOUT_SUCCESS_TTL_MS = 15 * 60 * 1000;

interface CheckoutSuccessState {
  orderId: string;
  createdAt: number;
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function storeCheckoutSuccessOrder(orderId: string) {
  if (!canUseSessionStorage() || !orderId.trim()) return;

  const payload: CheckoutSuccessState = {
    orderId: orderId.trim(),
    createdAt: Date.now(),
  };

  window.sessionStorage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, JSON.stringify(payload));
}

export function readCheckoutSuccessOrder() {
  if (!canUseSessionStorage()) return null;

  const rawValue = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<CheckoutSuccessState>;
    if (typeof parsed.orderId !== 'string' || !parsed.orderId.trim() || typeof parsed.createdAt !== 'number') {
      window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.createdAt > CHECKOUT_SUCCESS_TTL_MS) {
      window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
      return null;
    }

    return parsed.orderId.trim();
  } catch {
    window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
    return null;
  }
}

export function clearCheckoutSuccessOrder(orderId?: string) {
  if (!canUseSessionStorage()) return;

  if (!orderId) {
    window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
    return;
  }

  const storedOrderId = readCheckoutSuccessOrder();
  if (storedOrderId === orderId.trim()) {
    window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY);
  }
}
