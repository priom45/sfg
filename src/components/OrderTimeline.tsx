import { Check, Clock, ChefHat, Package, Truck, MapPin, XCircle, Timer, Bell } from 'lucide-react';
import type { OrderStatus, OrderType, PickupOption } from '../types';

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
}

export default function OrderTimeline({ currentStatus, orderType = 'delivery', pickupOption = 'takeaway' }: Props) {
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
  const pickupStepsForMode: StepDef[] = isDineIn
    ? [
        { status: 'pending', label: 'Order Placed', icon: Clock },
        { status: 'confirmed', label: 'Confirmed', icon: Check },
        { status: 'preparing', label: 'Preparing', icon: ChefHat },
        { status: 'packed', label: 'Ready to Serve', icon: Bell },
        { status: 'delivered', label: 'Served', icon: MapPin },
      ]
    : pickupSteps;
  const steps = isPickup ? pickupStepsForMode : deliverySteps;
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
                {isCurrent && !isReadyPickup && (
                  <p className="text-[12px] text-brand-gold font-semibold mt-0.5 animate-pulse-soft">In Progress</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
