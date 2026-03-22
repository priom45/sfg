import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from './supabase';

interface SendOrderReadyEmailResponse {
  success: boolean;
  recipient?: string;
  error?: string;
}

async function ensureFreshReadyEmailSession() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Could not send the order-ready email because the session expired. Please sign in again.');
    }
    return refreshedData.session;
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Could not refresh the session before sending the order-ready email.');
    }
    return refreshedData.session;
  }

  return sessionData.session;
}

async function toReadyEmailFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;

    if (response instanceof Response) {
      if (response.status === 401) {
        return new Error('Order-ready email request was rejected because the session is no longer valid.');
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
          // Ignore body parsing failures and fall back below.
        }
      }
    }

    return new Error('Order-ready email service returned an unexpected response.');
  }

  if (error instanceof FunctionsFetchError) {
    return new Error('Could not reach the order-ready email service. Please check your connection.');
  }

  if (error instanceof FunctionsRelayError) {
    return new Error('Supabase could not route the order-ready email request.');
  }

  return error instanceof Error ? error : new Error('Failed to send ready email');
}

async function invokeReadyEmailFunction(orderId: string, accessToken: string) {
  return supabase.functions.invoke<SendOrderReadyEmailResponse>(
    'send-order-ready-email',
    {
      body: { orderId },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export async function sendOrderReadyEmail(orderId: string) {
  let session = await ensureFreshReadyEmailSession();

  let { data, error } = await invokeReadyEmailFunction(orderId, session.access_token);

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshReadyEmailSession();
    ({ data, error } = await invokeReadyEmailFunction(orderId, session.access_token));
  }

  if (error) {
    throw await toReadyEmailFunctionError(error);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to send ready email');
  }

  return data;
}
