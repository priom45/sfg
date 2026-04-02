import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { customerSupabase } from './supabase';
import type { SelectedCustomization } from '../types';

export interface RazorpayCartItemInput {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: SelectedCustomization[];
}

interface CreateRazorpayOrderPayload {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  pickupOption: 'dine_in' | 'takeaway';
  subtotal: number;
  discount: number;
  total: number;
  items: RazorpayCartItemInput[];
}

interface CreateRazorpayOrderResponse {
  success: boolean;
  keyId: string;
  razorpayOrderId: string;
  appOrderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  error?: string;
}

interface CreateExistingRazorpayOrderResponse {
  success: boolean;
  keyId: string;
  razorpayOrderId: string;
  appOrderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  error?: string;
}

interface VerifyRazorpayPaymentPayload {
  appOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface VerifyRazorpayPaymentResponse {
  success: boolean;
  appOrderId?: string;
  paymentState?: 'paid' | 'pending' | 'failed';
  orderStatus?: string;
  paymentMethod?: 'upi' | 'card';
  receiptEmailSent?: boolean;
  manualReview?: boolean;
  error?: string;
}

interface CancelRazorpayPaymentResponse {
  success: boolean;
  appOrderId?: string;
  paymentState?: 'paid' | 'pending' | 'failed';
  orderStatus?: string;
  paymentMethod?: 'upi' | 'card';
  receiptEmailSent?: boolean;
  manualReview?: boolean;
  error?: string;
}

interface ReconcileRazorpayPaymentResponse {
  success: boolean;
  appOrderId?: string;
  paymentState?: 'paid' | 'pending' | 'failed';
  orderStatus?: string;
  paymentMethod?: 'upi' | 'card';
  receiptEmailSent?: boolean;
  manualReview?: boolean;
  error?: string;
}

let razorpayScriptPromise: Promise<void> | null = null;

const MISSING_RAZORPAY_FUNCTIONS_MESSAGE =
  'Online payment is not enabled on this Supabase project yet. Deploy the Razorpay Edge Functions first.';
export const RAZORPAY_BRAND_IMAGE =
  typeof window === 'undefined'
    ? '/razorpay-logo-badge.svg'
    : new URL('/razorpay-logo-badge.svg', window.location.origin).toString();

async function refreshCustomerSession(errorMessage = 'Please sign in again to continue.') {
  const { data: refreshedData, error: refreshError } = await customerSupabase.auth.refreshSession();
  if (refreshError || !refreshedData.session) {
    throw new Error(errorMessage);
  }

  return refreshedData.session;
}

async function ensureFreshToken(options?: { forceRefresh?: boolean; errorMessage?: string }) {
  const forceRefresh = options?.forceRefresh ?? false;
  const errorMessage = options?.errorMessage ?? 'Please sign in again to continue.';

  if (forceRefresh) {
    return refreshCustomerSession(errorMessage);
  }

  const { data: sessionData } = await customerSupabase.auth.getSession();
  if (!sessionData.session) {
    return refreshCustomerSession(errorMessage);
  } else {
    const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
    if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
      return refreshCustomerSession(errorMessage);
    }
  }

  return sessionData.session;
}

async function toRazorpayFunctionError(error: unknown, fallbackMessage: string) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;

    if (response instanceof Response) {
      if (response.status === 401) {
        return new Error('Authentication failed. Please try again or sign in again.');
      }

      if (response.status === 404) {
        return new Error(MISSING_RAZORPAY_FUNCTIONS_MESSAGE);
      }

      try {
        const payload = await response.clone().json() as { error?: string; message?: string };
        if (typeof payload.error === 'string' && payload.error.trim()) {
          return new Error(payload.error);
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return new Error(payload.message);
        }
      } catch {
        try {
          const text = await response.clone().text();
          if (text.trim()) {
            return new Error(text.trim());
          }
        } catch {
          // fall through
        }
      }
    }

    return new Error(fallbackMessage);
  }

  if (error instanceof FunctionsFetchError) {
    return new Error('Could not reach the online payment service. Please check your network and try again.');
  }

  if (error instanceof FunctionsRelayError) {
    return new Error('Supabase could not route the online payment request. Please try again.');
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}

export function loadRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayScriptPromise = null;
      script.remove();
      reject(new Error('Failed to load Razorpay checkout'));
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export async function createRazorpayOrder(payload: CreateRazorpayOrderPayload) {
  let session = await ensureFreshToken();
  const { data, error } = await customerSupabase.functions.invoke<CreateRazorpayOrderResponse>(
    'create-razorpay-order',
    {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshToken({ forceRefresh: true });
    const retry = await customerSupabase.functions.invoke<CreateRazorpayOrderResponse>(
      'create-razorpay-order',
      {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    if (retry.error) {
      throw await toRazorpayFunctionError(retry.error, 'Failed to create Razorpay order');
    }
    if (!retry.data?.success) {
      throw new Error(retry.data?.error || 'Failed to create Razorpay order');
    }
    return retry.data;
  }

  if (error) {
    throw await toRazorpayFunctionError(error, 'Failed to create Razorpay order');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to create Razorpay order');
  }

  return data;
}

export async function createExistingRazorpayOrder(appOrderId: string) {
  let session = await ensureFreshToken();
  const invoke = () => customerSupabase.functions.invoke<CreateExistingRazorpayOrderResponse>(
    'create-existing-razorpay-order',
    {
      body: { appOrderId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  const { data, error } = await invoke();

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshToken({ forceRefresh: true });
    const retry = await invoke();
    if (retry.error) {
      throw await toRazorpayFunctionError(retry.error, 'Failed to start online payment');
    }
    if (!retry.data?.success) {
      throw new Error(retry.data?.error || 'Failed to start online payment');
    }
    return retry.data;
  }

  if (error) {
    throw await toRazorpayFunctionError(error, 'Failed to start online payment');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to start online payment');
  }

  return data;
}

export async function verifyRazorpayPayment(payload: VerifyRazorpayPaymentPayload) {
  let session = await ensureFreshToken();
  const { data, error } = await customerSupabase.functions.invoke<VerifyRazorpayPaymentResponse>(
    'verify-razorpay-payment',
    {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshToken({ forceRefresh: true });
    const retry = await customerSupabase.functions.invoke<VerifyRazorpayPaymentResponse>(
      'verify-razorpay-payment',
      {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    if (retry.error) {
      throw await toRazorpayFunctionError(retry.error, 'Failed to verify Razorpay payment');
    }
    if (!retry.data?.success) {
      throw new Error(retry.data?.error || 'Failed to verify Razorpay payment');
    }
    return retry.data;
  }

  if (error) {
    throw await toRazorpayFunctionError(error, 'Failed to verify Razorpay payment');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to verify Razorpay payment');
  }

  return data;
}

export async function cancelRazorpayPayment(appOrderId: string) {
  let session = await ensureFreshToken();
  const { data, error } = await customerSupabase.functions.invoke<CancelRazorpayPaymentResponse>(
    'cancel-razorpay-payment',
    {
      body: { appOrderId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshToken({ forceRefresh: true });
    const retry = await customerSupabase.functions.invoke<CancelRazorpayPaymentResponse>(
      'cancel-razorpay-payment',
      {
        body: { appOrderId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    if (retry.error) {
      throw await toRazorpayFunctionError(retry.error, 'Failed to cancel Razorpay payment');
    }
    if (!retry.data?.success) {
      throw new Error(retry.data?.error || 'Failed to cancel Razorpay payment');
    }
    return retry.data;
  }

  if (error) {
    throw await toRazorpayFunctionError(error, 'Failed to cancel Razorpay payment');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to cancel Razorpay payment');
  }

  return data;
}

export async function reconcileRazorpayPayment(appOrderId: string) {
  let session = await ensureFreshToken();
  const { data, error } = await customerSupabase.functions.invoke<ReconcileRazorpayPaymentResponse>(
    'reconcile-razorpay-payment',
    {
      body: { appOrderId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshToken({ forceRefresh: true });
    const retry = await customerSupabase.functions.invoke<ReconcileRazorpayPaymentResponse>(
      'reconcile-razorpay-payment',
      {
        body: { appOrderId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    if (retry.error) {
      throw await toRazorpayFunctionError(retry.error, 'Failed to reconcile Razorpay payment');
    }
    if (!retry.data?.success) {
      throw new Error(retry.data?.error || 'Failed to reconcile Razorpay payment');
    }
    return retry.data;
  }

  if (error) {
    throw await toRazorpayFunctionError(error, 'Failed to reconcile Razorpay payment');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to reconcile Razorpay payment');
  }

  return data;
}
