import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type Session,
} from '@supabase/supabase-js';
import { staffSupabase } from './supabase';
import { sendOrderReceipt } from './orderReceipt';
import type { CounterPaymentMethod } from '../types';

interface MarkOrderPaidResponse {
  success: boolean;
  appOrderId?: string;
  receiptEmailSent?: boolean;
  error?: string;
}

interface MarkOrderPaidOptions {
  counterPaymentMethod?: CounterPaymentMethod;
  cashReceivedAmount?: number;
  onlineReceivedAmount?: number;
}

interface MarkedOrderPaid {
  success: true;
  appOrderId: string;
  receiptEmailSent?: boolean;
}

type DirectPaymentOrder = {
  id: string;
  order_id: string;
  total: number | string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_method: string | null;
  counter_payment_method?: CounterPaymentMethod | null;
  cash_received_amount?: number | string | null;
  online_received_amount?: number | string | null;
  paid_amount?: number | string | null;
  supportsCounterPaymentCapture: boolean;
};

type PaymentUpdatePayload = {
  payment_status: 'paid';
  payment_verified_at: string;
  paid_amount?: number;
  payment_method?: 'cod' | 'upi';
  payment_provider?: null;
  counter_payment_method?: CounterPaymentMethod;
  cash_received_amount?: number | null;
  online_received_amount?: number | null;
};

const BASE_PAYMENT_ORDER_SELECT = 'id, order_id, total, payment_status, payment_provider, payment_method';
const COUNTER_PAYMENT_ORDER_SELECT = `${BASE_PAYMENT_ORDER_SELECT}, counter_payment_method, cash_received_amount, online_received_amount, paid_amount`;
const COUNTER_PAYMENT_CAPTURE_COLUMNS = [
  'counter_payment_method',
  'cash_received_amount',
  'online_received_amount',
  'paid_amount',
];

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getCounterPaymentMethod(value: CounterPaymentMethod | undefined, fallbackMethod: string | null) {
  if (value === 'cash' || value === 'online' || value === 'split') {
    return value;
  }

  return fallbackMethod === 'upi' ? 'online' : 'cash';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(message);
  }

  return String(error);
}

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  return undefined;
}

function isCounterPaymentCaptureSchemaError(error: unknown) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /column .* does not exist/i.test(message) ||
    /could not find .* column/i.test(message)
  ) && COUNTER_PAYMENT_CAPTURE_COLUMNS.some((column) => message.includes(column));
}

function withCounterPaymentDefaults(
  order: Omit<DirectPaymentOrder, 'supportsCounterPaymentCapture'>,
  supportsCounterPaymentCapture: boolean,
): DirectPaymentOrder {
  return {
    ...order,
    counter_payment_method: order.counter_payment_method ?? null,
    cash_received_amount: order.cash_received_amount ?? null,
    online_received_amount: order.online_received_amount ?? null,
    paid_amount: order.paid_amount ?? null,
    supportsCounterPaymentCapture,
  };
}

function getBasePaymentUpdate(paymentUpdate: PaymentUpdatePayload): PaymentUpdatePayload {
  const basePaymentUpdate = { ...paymentUpdate };
  delete basePaymentUpdate.counter_payment_method;
  delete basePaymentUpdate.cash_received_amount;
  delete basePaymentUpdate.online_received_amount;
  delete basePaymentUpdate.paid_amount;

  return basePaymentUpdate;
}

async function ensureFreshPaidStatusSession(forceRefresh = false) {
  const { data: sessionData } = await staffSupabase.auth.getSession();

  if (forceRefresh || !sessionData.session) {
    const { data: refreshedData, error: refreshError } = await staffSupabase.auth.refreshSession();
    if (refreshError || !refreshedData.session) {
      throw new Error('Please sign in again to update this payment.');
    }
    return refreshedData.session;
  }

  const expiresAtMs = sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : 0;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const { data: refreshedData, error: refreshError } = await staffSupabase.auth.refreshSession();
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

      if (response.status === 401) {
        return new Error('Payment update request was rejected. Please sign out and sign in again.');
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

function isUnauthorizedFunctionError(error: unknown) {
  return error instanceof FunctionsHttpError &&
    error.context instanceof Response &&
    error.context.status === 401;
}

async function fetchDirectPaymentOrder(orderId: string) {
  const { data: order, error: orderError } = await staffSupabase
    .from('orders')
    .select(COUNTER_PAYMENT_ORDER_SELECT)
    .eq('order_id', orderId)
    .maybeSingle<Omit<DirectPaymentOrder, 'supportsCounterPaymentCapture'>>();

  if (!orderError && order) {
    return withCounterPaymentDefaults(order, true);
  }

  if (orderError && isCounterPaymentCaptureSchemaError(orderError)) {
    const { data: baseOrder, error: baseOrderError } = await staffSupabase
      .from('orders')
      .select(BASE_PAYMENT_ORDER_SELECT)
      .eq('order_id', orderId)
      .maybeSingle<Omit<DirectPaymentOrder, 'supportsCounterPaymentCapture'>>();

    if (baseOrderError || !baseOrder) {
      throw new Error(baseOrderError?.message || 'Order not found');
    }

    return withCounterPaymentDefaults(baseOrder, false);
  }

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Order not found');
  }

  return withCounterPaymentDefaults(order, true);
}

async function invokeMarkPaidFunction(
  session: Session,
  orderId: string,
  options: MarkOrderPaidOptions,
) {
  return staffSupabase.functions.invoke<MarkOrderPaidResponse>(
    'mark-order-paid',
    {
      body: {
        orderId,
        counterPaymentMethod: options.counterPaymentMethod,
        cashReceivedAmount: options.cashReceivedAmount,
        onlineReceivedAmount: options.onlineReceivedAmount,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );
}

function getPaymentUpdate(order: DirectPaymentOrder, options: MarkOrderPaidOptions): PaymentUpdatePayload {
  const orderTotal = roundCurrency(Number(order.total ?? 0));
  const existingPaidAmount = order.payment_status === 'paid'
    ? orderTotal
    : roundCurrency(Number(order.paid_amount ?? 0));
  const amountDue = Math.max(0, roundCurrency(orderTotal - existingPaidAmount));
  const selectedCounterPaymentMethod = getCounterPaymentMethod(
    options.counterPaymentMethod,
    order.payment_method,
  );
  const rawCashAmount = Number(
    options.cashReceivedAmount ?? (selectedCounterPaymentMethod === 'cash' ? amountDue : 0),
  );
  const rawOnlineAmount = Number(
    options.onlineReceivedAmount ?? (selectedCounterPaymentMethod === 'online' ? amountDue : 0),
  );
  const cashAmount = roundCurrency(rawCashAmount);
  const onlineAmount = roundCurrency(rawOnlineAmount);

  if (
    order.payment_provider !== 'razorpay' &&
    selectedCounterPaymentMethod === 'cash' &&
    amountDue > 0 &&
    (!Number.isFinite(cashAmount) || cashAmount < amountDue)
  ) {
    throw new Error(`Cash received must be at least ₹${amountDue.toFixed(2)}`);
  }

  if (
    order.payment_provider !== 'razorpay' &&
    selectedCounterPaymentMethod === 'split' &&
    amountDue > 0
  ) {
    if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
      throw new Error('Enter the cash amount for this split payment');
    }

    if (!Number.isFinite(onlineAmount) || onlineAmount <= 0) {
      throw new Error('Enter the UPI amount for this split payment');
    }

    if (roundCurrency(cashAmount + onlineAmount) < amountDue) {
      throw new Error(`Cash + UPI must cover ₹${amountDue.toFixed(2)}`);
    }
  }

  if (
    order.payment_provider !== 'razorpay' &&
    selectedCounterPaymentMethod === 'online' &&
    amountDue > 0 &&
    (!Number.isFinite(onlineAmount) || onlineAmount < amountDue)
  ) {
    throw new Error(`UPI received must be at least ₹${amountDue.toFixed(2)}`);
  }

  const paymentUpdate: PaymentUpdatePayload = {
    payment_status: 'paid',
    payment_verified_at: new Date().toISOString(),
  };

  if (order.supportsCounterPaymentCapture) {
    paymentUpdate.paid_amount = orderTotal;
  }

  if (order.payment_provider !== 'razorpay') {
    const existingCashAmount = roundCurrency(Number(order.cash_received_amount ?? 0));
    const existingOnlineAmount = roundCurrency(Number(order.online_received_amount ?? 0));
    const cashDelta = selectedCounterPaymentMethod === 'cash' || selectedCounterPaymentMethod === 'split'
      ? cashAmount
      : 0;
    const onlineDelta = selectedCounterPaymentMethod === 'online'
      ? onlineAmount
      : selectedCounterPaymentMethod === 'split'
        ? onlineAmount
        : 0;
    const nextCashAmount = roundCurrency(existingCashAmount + cashDelta);
    const nextOnlineAmount = roundCurrency(existingOnlineAmount + onlineDelta);
    const resolvedCounterPaymentMethod = nextCashAmount > 0 && nextOnlineAmount > 0
      ? 'split'
      : nextOnlineAmount > 0
        ? 'online'
        : 'cash';

    paymentUpdate.payment_method = resolvedCounterPaymentMethod === 'cash' ? 'cod' : 'upi';
    paymentUpdate.payment_provider = null;
    if (order.supportsCounterPaymentCapture) {
      paymentUpdate.counter_payment_method = resolvedCounterPaymentMethod;
      paymentUpdate.cash_received_amount = nextCashAmount > 0 ? nextCashAmount : null;
      paymentUpdate.online_received_amount = nextOnlineAmount > 0 ? nextOnlineAmount : null;
    }
  }

  return paymentUpdate;
}

async function applyPaymentUpdate(order: DirectPaymentOrder, paymentUpdate: PaymentUpdatePayload) {
  const updatePayload = order.supportsCounterPaymentCapture
    ? paymentUpdate
    : getBasePaymentUpdate(paymentUpdate);
  const { error: updateError } = await staffSupabase
    .from('orders')
    .update(updatePayload)
    .eq('id', order.id);

  if (
    updateError &&
    order.supportsCounterPaymentCapture &&
    isCounterPaymentCaptureSchemaError(updateError)
  ) {
    const { error: fallbackUpdateError } = await staffSupabase
      .from('orders')
      .update(getBasePaymentUpdate(paymentUpdate))
      .eq('id', order.id);

    if (!fallbackUpdateError) {
      order.supportsCounterPaymentCapture = false;
      return;
    }
  }

  if (updateError) {
    throw new Error(updateError.message || 'Failed to update payment');
  }
}

async function markOrderPaidDirectly(
  orderId: string,
  options: MarkOrderPaidOptions,
): Promise<MarkedOrderPaid> {
  const order = await fetchDirectPaymentOrder(orderId);
  await applyPaymentUpdate(order, getPaymentUpdate(order, options));

  let receiptEmailSent = false;
  try {
    await sendOrderReceipt(order.order_id);
    receiptEmailSent = true;
  } catch (error) {
    console.error('Failed to send receipt email after direct payment update', error);
  }

  return {
    success: true,
    appOrderId: order.order_id,
    receiptEmailSent,
  };
}

function toMarkedOrderPaid(data: MarkOrderPaidResponse | null): MarkedOrderPaid {
  if (!data?.success || !data.appOrderId) {
    throw new Error(data?.error || 'Failed to update payment');
  }

  return {
    success: true,
    appOrderId: data.appOrderId,
    receiptEmailSent: data.receiptEmailSent,
  };
}

export async function markOrderPaid(orderId: string, options: MarkOrderPaidOptions = {}) {
  let session = await ensureFreshPaidStatusSession();

  const { data, error } = await invokeMarkPaidFunction(session, orderId, options);

  if (isUnauthorizedFunctionError(error)) {
    try {
      session = await ensureFreshPaidStatusSession(true);
      const retry = await invokeMarkPaidFunction(session, orderId, options);

      if (retry.error) {
        if (isUnauthorizedFunctionError(retry.error)) {
          return markOrderPaidDirectly(orderId, options);
        }

        const retryError = await toMarkPaidFunctionError(retry.error);

        if (isCounterPaymentCaptureSchemaError(retryError)) {
          return markOrderPaidDirectly(orderId, options);
        }

        throw retryError;
      }

      return toMarkedOrderPaid(retry.data);
    } catch (refreshOrRetryError) {
      if (refreshOrRetryError instanceof Error && refreshOrRetryError.message.includes('sign in again')) {
        throw refreshOrRetryError;
      }

      return markOrderPaidDirectly(orderId, options);
    }
  }

  if (error) {
    const functionError = await toMarkPaidFunctionError(error);

    if (isCounterPaymentCaptureSchemaError(functionError)) {
      return markOrderPaidDirectly(orderId, options);
    }

    throw functionError;
  }

  return toMarkedOrderPaid(data);
}
