import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type Session,
} from '@supabase/supabase-js';
import { staffSupabase } from './supabase';
import { sendOrderReadyEmail } from './orderReadyEmail';

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

async function ensureFreshReadyStatusSession(forceRefresh = false) {
  const { data: sessionData } = await staffSupabase.auth.getSession();

  if (forceRefresh || !sessionData.session) {
    const { data: refreshedData, error: refreshError } = await staffSupabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Please sign in again to update this order.');
    }
    return refreshedData.session;
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshedData, error: refreshError } = await staffSupabase.auth.refreshSession();
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

async function invokeMarkReadyFunction(session: Session, orderId: string) {
  return staffSupabase.functions.invoke<MarkOrderReadyResponse>(
    'mark-order-ready',
    {
      body: { orderId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );
}

async function markOrderReadyDirectly(orderId: string): Promise<MarkedOrderReady> {
  const { data: order, error: orderError } = await staffSupabase
    .from('orders')
    .select('id, order_id, order_type, status')
    .eq('order_id', orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Order not found');
  }

  if (['cancelled', 'expired', 'delivered'].includes(order.status)) {
    throw new Error('Order cannot be marked ready from its current status');
  }

  if (order.status !== 'packed') {
    const { error: updateError } = await staffSupabase
      .from('orders')
      .update({
        status: 'packed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      throw new Error(updateError.message || 'Failed to update order');
    }
  }

  let readyEmailSent = true;
  if (order.order_type === 'pickup') {
    try {
      await sendOrderReadyEmail(order.order_id);
    } catch (emailError) {
      console.error('Failed to send ready email after direct order update', emailError);
      readyEmailSent = false;
    }
  }

  return {
    success: true,
    appOrderId: order.order_id,
    readyEmailSent,
  };
}

function toMarkedOrderReady(data: MarkOrderReadyResponse | null): MarkedOrderReady {
  if (!data?.success || !data.appOrderId) {
    throw new Error(data?.error || 'Failed to update order');
  }

  return {
    success: true,
    appOrderId: data.appOrderId,
    readyEmailSent: data.readyEmailSent,
  };
}

export async function markOrderReady(orderId: string) {
  let session = await ensureFreshReadyStatusSession();

  const { data, error } = await invokeMarkReadyFunction(session, orderId);

  if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 401) {
    session = await ensureFreshReadyStatusSession(true);
    const retry = await invokeMarkReadyFunction(session, orderId);
    if (retry.error) {
      if (retry.error instanceof FunctionsHttpError && retry.error.context instanceof Response && retry.error.context.status === 401) {
        return markOrderReadyDirectly(orderId);
      }

      const retryError = await toMarkReadyFunctionError(retry.error);
      throw retryError;
    }

    return toMarkedOrderReady(retry.data);
  }

  if (error) {
    throw await toMarkReadyFunctionError(error);
  }

  return toMarkedOrderReady(data);
}
