import { Check, Clock, ChefHat, Package, Truck, MapPin, XCircle, Timer, Bell } from 'lucide-react';
import type { OrderStatus, OrderType, PickupOption } from '../types';
import { isAwaitingCounterPayment, isAwaitingOnlinePayment } from '../lib/orderLabels';

interface StepDef {
  status: OrderStatus;
  label: string;
  pickupLabel?: string;
  icon: typeof Check;
}

const deliverySteps: StepDef[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: Check },
  { status: 'preparing', label: 'Preparing', icon: ChefHat },
  { status: 'packed', label: 'Packed', pickupLabel: 'Ready for Pickup', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: MapPin },
];

const pickupSteps: StepDef[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Confirmed', icon: Check },
  { status: 'preparing', label: 'Preparing', icon: ChefHat },
  { status: 'packed', label: 'Ready for Pickup', icon: Bell },
  { status: 'delivered', label: 'Picked Up', icon: MapPin },
];

const statusIndex: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 2, packed: 3, out_for_delivery: 4, delivered: 5,
};

const pickupStatusIndex: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 2, packed: 3, delivered: 4,
};

interface Props {
  currentStatus: OrderStatus;
  orderType?: OrderType;
  pickupOption?: PickupOption;
  paymentMethod?: 'upi' | 'card' | 'cod';
  paymentProvider?: 'razorpay' | null;
  paymentStatus?: string | null;
  total?: number | null;
}

export default function OrderTimeline({
  currentStatus,
  orderType = 'delivery',
  pickupOption = 'takeaway',
  paymentMethod,
  paymentProvider = null,
  paymentStatus = null,
  total = 0,
}: Props) {
  if (currentStatus === 'cancelled') {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-16 h-16 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
          <XCircle size={28} strokeWidth={2.2} className="text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white">Order Cancelled</h3>
        <p className="text-brand-text-dim text-[14px] mt-1">This order has been cancelled</p>
      </div>
    );
  }

  if (currentStatus === 'expired') {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-16 h-16 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
          <Timer size={28} strokeWidth={2.2} className="text-orange-400" />
        </div>
        <h3 className="text-lg font-bold text-white">Order Expired</h3>
        <p className="text-brand-text-dim text-[14px] mt-1">This order was not confirmed in time</p>
      </div>
    );
  }

  const isPickup = orderType === 'pickup';
  const isDineIn = isPickup && pickupOption === 'dine_in';
  const awaitingCounterPayment = isAwaitingCounterPayment({
    order_type: orderType,
    pickup_option: pickupOption,
    payment_method: paymentMethod,
    payment_provider: paymentProvider,
    payment_status: paymentStatus,
    total,
  });
  const awaitingOnlinePayment = isAwaitingOnlinePayment({
    payment_method: paymentMethod,
    payment_provider: paymentProvider,
    payment_status: paymentStatus,
    total,
  });
  const pickupStepsForMode: StepDef[] = isDineIn
    ? [
        { status: 'pending', label: awaitingCounterPayment ? 'Payment Pending' : awaitingOnlinePayment ? 'Payment Processing' : 'Order Placed', icon: Clock },
        { status: 'confirmed', label: 'Confirmed', icon: Check },
        { status: 'preparing', label: 'Preparing', icon: ChefHat },
        { status: 'packed', label: 'Ready to Serve', icon: Bell },
        { status: 'delivered', label: 'Served', icon: MapPin },
      ]
    : pickupSteps.map((step) => (
        step.status === 'pending' && awaitingCounterPayment
          ? { ...step, label: 'Payment Pending' }
          : step.status === 'pending' && awaitingOnlinePayment
            ? { ...step, label: 'Payment Processing' }
          : step
      ));
  const deliveryStepsForMode = deliverySteps.map((step) => (
    step.status === 'pending' && awaitingOnlinePayment
      ? { ...step, label: 'Payment Processing' }
      : step
  ));
  const steps = isPickup ? pickupStepsForMode : deliveryStepsForMode;
  const idxMap = isPickup ? pickupStatusIndex : statusIndex;
  const currentIdx = idxMap[currentStatus] ?? 0;

  return (
    <div className="py-4">
      <div className="relative">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const Icon = step.icon;
          const isReadyPickup = isPickup && step.status === 'packed' && isCurrent;

          return (
            <div key={step.status} className="flex items-start gap-4 relative">
              {idx < steps.length - 1 && (
                <div
                  className={`absolute left-5 top-10 w-0.5 h-8 transition-colors duration-300 ${
                    isCompleted ? 'bg-brand-gold' : 'bg-brand-surface-strong/70'
                  }`}
                />
              )}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-brand-gold text-brand-bg'
                    : isCurrent
                    ? isReadyPickup
                      ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                      : 'bg-brand-gold text-brand-bg ring-4 ring-brand-gold/20'
                    : 'bg-brand-surface-light text-brand-text-dim'
                }`}
              >
                {isCompleted ? <Check size={18} strokeWidth={2.2} /> : <Icon size={18} strokeWidth={2.2} />}
              </div>
              <div className={`pb-8 ${idx === steps.length - 1 ? 'pb-0' : ''}`}>
                <p
                  className={`font-semibold text-[14px] ${
                    isCompleted || isCurrent ? 'text-white' : 'text-brand-text-dim'
                  }`}
                >
                  {isPickup && step.pickupLabel ? step.pickupLabel : step.label}
                </p>
                {isCurrent && isReadyPickup && (
                  <p className="text-[12px] text-emerald-400 font-bold mt-0.5">Your order is ready!</p>
                )}
                {isCurrent && !isReadyPickup && awaitingCounterPayment && step.status === 'pending' && (
                  <p className="text-[12px] text-amber-400 font-semibold mt-0.5">Pay at the counter to continue</p>
                )}
                {isCurrent && !isReadyPickup && awaitingOnlinePayment && step.status === 'pending' && (
                  <p className="text-[12px] text-sky-400 font-semibold mt-0.5">Confirming your online payment</p>
                )}
                {isCurrent && !isReadyPickup && (
                  <p className="text-[12px] text-brand-gold font-semibold mt-0.5 animate-pulse-soft">
                    {awaitingCounterPayment && step.status === 'pending'
                      ? 'Awaiting Payment Confirmation'
                      : awaitingOnlinePayment && step.status === 'pending'
                        ? 'Payment Verification In Progress'
                        : 'In Progress'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
