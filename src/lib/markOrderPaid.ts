import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

interface MarkOrderPaidResponse {
  success: boolean;
  appOrderId?: string;
  receiptEmailSent?: boolean;
  error?: string;
}

interface MarkedOrderPaid {
  success: true;
  appOrderId: string;
  receiptEmailSent?: boolean;
}

async function ensureFreshPaidStatusSession() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Please sign in again to update this payment.');
    }
    return refreshedData.session;
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Please sign in again to update this payment.');
    }
    return refreshedData.session;
  }

  return sessionData.session;
}

async function toMarkPaidFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;

    if (response instanceof Response) {
      if (response.status === 401) {
        return new Error('Payment update request was rejected because the session is no longer valid.');
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

    return new Error('Payment update service returned an unexpected response.');
  }

  if (error instanceof FunctionsFetchError) {
    return new Error('Could not reach the payment update service. Please check your connection.');
  }

  if (error instanceof FunctionsRelayError) {
    return new Error('Supabase could not route the payment update request.');
  }

  return error instanceof Error ? error : new Error('Failed to update payment');
}

export async function markOrderPaid(orderId: string) {
  let session = await ensureFreshPaidStatusSession();

  const { data, error } = await supabase.functions.invoke<MarkOrderPaidResponse>(
    'mark-order-paid',
    {
      body: { orderId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshPaidStatusSession();
    const retry = await supabase.functions.invoke<MarkOrderPaidResponse>(
      'mark-order-paid',
      {
        body: { orderId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
    if (retry.error) {
      throw await toMarkPaidFunctionError(retry.error);
    }
    if (!retry.data?.success || !retry.data.appOrderId) {
      throw new Error(retry.data?.error || 'Failed to update payment');
    }
    return {
      success: true,
      appOrderId: retry.data.appOrderId,
      receiptEmailSent: retry.data.receiptEmailSent,
    } satisfies MarkedOrderPaid;
  }

  if (error) {
    throw await toMarkPaidFunctionError(error);
  }

  if (!data?.success || !data.appOrderId) {
    throw new Error(data?.error || 'Failed to update payment');
  }

  return {
    success: true,
    appOrderId: data.appOrderId,
    receiptEmailSent: data.receiptEmailSent,
  } satisfies MarkedOrderPaid;
}
