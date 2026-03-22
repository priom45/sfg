import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

interface MarkOrderReadyResponse {
  success: boolean;
  appOrderId?: string;
  readyEmailSent?: boolean;
  error?: string;
}

interface MarkedOrderReady {
  success: true;
  appOrderId: string;
  readyEmailSent?: boolean;
}

async function ensureFreshReadyStatusSession() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Please sign in again to update this order.');
    }
    return refreshedData.session;
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Please sign in again to update this order.');
    }
    return refreshedData.session;
  }

  return sessionData.session;
}

async function toMarkReadyFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;

    if (response instanceof Response) {
      if (response.status === 401) {
        return new Error('Order update request was rejected because the session is no longer valid.');
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
          // Ignore parsing failures and use the fallback below.
        }
      }
    }

    return new Error('Order update service returned an unexpected response.');
  }

  if (error instanceof FunctionsFetchError) {
    return new Error('Could not reach the order update service. Please check your connection.');
  }

  if (error instanceof FunctionsRelayError) {
    return new Error('Supabase could not route the order update request.');
  }

  return error instanceof Error ? error : new Error('Failed to update order');
}

export async function markOrderReady(orderId: string) {
  let session = await ensureFreshReadyStatusSession();

  const { data, error } = await supabase.functions.invoke<MarkOrderReadyResponse>(
    'mark-order-ready',
    {
      body: { orderId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshReadyStatusSession();
    const retry = await supabase.functions.invoke<MarkOrderReadyResponse>(
      'mark-order-ready',
      {
        body: { orderId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    if (retry.error) {
      throw await toMarkReadyFunctionError(retry.error);
    }
    if (!retry.data?.success || !retry.data.appOrderId) {
      throw new Error(retry.data?.error || 'Failed to update order');
    }
    return {
      success: true,
      appOrderId: retry.data.appOrderId,
      readyEmailSent: retry.data.readyEmailSent,
    } satisfies MarkedOrderReady;
  }

  if (error) {
    throw await toMarkReadyFunctionError(error);
  }

  if (!data?.success || !data.appOrderId) {
    throw new Error(data?.error || 'Failed to update order');
  }

  return {
    success: true,
    appOrderId: data.appOrderId,
    readyEmailSent: data.readyEmailSent,
  } satisfies MarkedOrderReady;
}
