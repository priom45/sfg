import type { OrderType, PickupOption, PaymentMethod, PaymentProvider } from '../types';

type PaymentStateContext = {
  payment_method?: PaymentMethod;
  payment_provider?: PaymentProvider;
  payment_status?: string | null;
  total?: number | null;
};

type OrderModeContext = PaymentStateContext & {
  order_type: OrderType;
  pickup_option?: PickupOption | null;
};

export function getPickupOption(order: OrderModeContext): PickupOption {
  return order.pickup_option === 'dine_in' ? 'dine_in' : 'takeaway';
}

export function isDineInOrder(order: OrderModeContext) {
  return order.order_type === 'pickup' && getPickupOption(order) === 'dine_in';
}

export function getServiceModeLabel(order: OrderModeContext) {
  if (order.order_type === 'delivery') return 'Delivery';
  return isDineInOrder(order) ? 'Dine In' : 'Takeaway';
}

export function getReadyOrderLabel(order: OrderModeContext) {
  if (order.order_type === 'delivery') return 'Ready';
  return isDineInOrder(order) ? 'Ready to Serve' : 'Ready for Pickup';
}

export function getCompletedOrderLabel(order: OrderModeContext) {
  if (order.order_type === 'delivery') return 'Delivered';
  return isDineInOrder(order) ? 'Served' : 'Picked Up';
}

export function getPendingPaymentLabel(order: OrderModeContext) {
  if ((order.total ?? 0) <= 0) return 'No Payment Required';
  if (order.payment_provider === 'razorpay') return 'Online Payment';
  return order.order_type === 'delivery' ? 'Cash on Delivery' : 'Pay at Counter';
}

export function isAwaitingOnlinePayment(order: PaymentStateContext) {
  return order.payment_provider === 'razorpay' && order.payment_status === 'pending';
}

export function getPaymentMethodLabel(order: OrderModeContext) {
  if ((order.total ?? 0) <= 0 && order.payment_status === 'paid') {
    return 'No Payment Required';
  }

  if (order.payment_provider === 'razorpay') {
    return order.payment_method === 'upi' ? 'Online UPI' : 'Online Payment';
  }

  if (order.payment_method === 'upi') {
    return order.order_type === 'pickup' ? 'UPI at Counter' : 'UPI';
  }

  if (order.payment_method === 'card') {
    return 'Card';
  }

  return getPendingPaymentLabel(order);
}
