import { customerSupabase } from './supabase';
import type { PaymentMethod, PickupOption, SelectedCustomization } from '../types';

interface CounterOrderItemInput {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: SelectedCustomization[];
}

interface CreateCounterOrderPayload {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  pickupOption: PickupOption;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  items: CounterOrderItemInput[];
}

interface CreateCounterOrderResponse {
  success: boolean;
  appOrderId?: string;
  receiptEmailSent?: boolean;
  error?: string;
}

interface CreatedCounterOrder {
  success: true;
  appOrderId: string;
  receiptEmailSent?: boolean;
}

class CounterOrderHttpError extends Error {
  status: number;
  payload?: { error?: string; message?: string } | null;

  constructor(status: number, message: string, payload?: { error?: string; message?: string } | null) {
    super(message);
    this.name = 'CounterOrderHttpError';
    this.status = status;
    this.payload = payload;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function refreshCounterOrderSession(errorMessage = 'Please sign in again to place your order.') {
  const { data: refreshedData, error: refreshError } = await customerSupabase.auth.refreshSession();
  if (refreshError || !refreshedData.session) {
    throw new Error(errorMessage);
  }

  return refreshedData.session;
}

async function ensureFreshCounterOrderSession(options?: { forceRefresh?: boolean; errorMessage?: string }) {
  const forceRefresh = options?.forceRefresh ?? false;
  const errorMessage = options?.errorMessage ?? 'Please sign in again to place your order.';

  if (forceRefresh) {
    return refreshCounterOrderSession(errorMessage);
  }

  const { data: sessionData } = await customerSupabase.auth.getSession();

  if (!sessionData.session) {
    return refreshCounterOrderSession(errorMessage);
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    return refreshCounterOrderSession(errorMessage);
  }

  return sessionData.session;
}

async function toCounterOrderFunctionError(error: unknown) {
  if (error instanceof CounterOrderHttpError) {
    if (error.status === 401) {
      return new Error('Authentication failed. Please sign in again to place your order.');
    }

    if (typeof error.payload?.error === 'string' && error.payload.error.trim()) {
      return new Error(error.payload.error);
    }

    if (typeof error.payload?.message === 'string' && error.payload.message.trim()) {
      return new Error(error.payload.message);
    }

    return new Error(error.message || 'Counter order service returned an unexpected response.');
  }

  if (error instanceof TypeError) {
    return new Error('Could not reach the order service. Please check your network and try again.');
  }

  return error instanceof Error ? error : new Error('Failed to place order');
}

async function invokeCounterOrderFunction(payload: CreateCounterOrderPayload, accessToken: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/create-counter-order`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data: CreateCounterOrderResponse | null = null;
  let payloadError: { error?: string; message?: string } | null = null;

  try {
    data = await response.clone().json() as CreateCounterOrderResponse;
    payloadError = data;
  } catch {
    payloadError = null;
  }

  if (!response.ok) {
    throw new CounterOrderHttpError(
      response.status,
      response.statusText || 'Counter order request failed',
      payloadError,
    );
  }

  return data;
}

export async function createCounterOrder(payload: CreateCounterOrderPayload) {
  let session = await ensureFreshCounterOrderSession();

  let data: CreateCounterOrderResponse | null = null;

  try {
    data = await invokeCounterOrderFunction(payload, session.access_token);
  } catch (error) {
    if (error instanceof CounterOrderHttpError && error.status === 401) {
      session = await ensureFreshCounterOrderSession({ forceRefresh: true });
      try {
        data = await invokeCounterOrderFunction(payload, session.access_token);
      } catch (retryError) {
        throw await toCounterOrderFunctionError(retryError);
      }
    } else {
      throw await toCounterOrderFunctionError(error);
    }
  }

  if (!data?.success || !data.appOrderId) {
    throw new Error(data?.error || 'Failed to place order');
  }

  return {
    success: true,
    appOrderId: data.appOrderId,
    receiptEmailSent: data.receiptEmailSent,
  } satisfies CreatedCounterOrder;
}
