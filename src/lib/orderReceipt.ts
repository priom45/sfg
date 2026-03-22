import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

interface SendOrderReceiptResponse {
  success: boolean;
  recipient?: string;
  error?: string;
}

async function ensureFreshReceiptSession() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Could not send receipt email because your session expired. Please sign in again.');
    }
    return refreshedData.session;
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Could not refresh your session before sending the receipt email.');
    }
    return refreshedData.session;
  }

  return sessionData.session;
}

async function toReceiptFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;

    if (response instanceof Response) {
      if (response.status === 401) {
        return new Error('Receipt email request was rejected because the session is no longer valid.');
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
        } catch {}
      }
    }

    return new Error('Receipt email service returned an unexpected response.');
  }

  if (error instanceof FunctionsFetchError) {
    return new Error('Could not reach the receipt email service. Please check your connection.');
  }

  if (error instanceof FunctionsRelayError) {
    return new Error('Supabase could not route the receipt email request.');
  }

  return error instanceof Error ? error : new Error('Failed to send order receipt');
}

async function invokeReceiptFunction(orderId: string, accessToken: string) {
  return supabase.functions.invoke<SendOrderReceiptResponse>('send-order-receipt', {
    body: { orderId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function sendOrderReceipt(orderId: string) {
  let session = await ensureFreshReceiptSession();

  let { data, error } = await invokeReceiptFunction(orderId, session.access_token);

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshReceiptSession();
    ({ data, error } = await invokeReceiptFunction(orderId, session.access_token));
  }

  if (error) {
    throw await toReceiptFunctionError(error);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to send order receipt');
  }

  return data;
}