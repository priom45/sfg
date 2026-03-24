import { useState, useEffect, useCallback } from 'react';
import { Check, X, ChevronRight, Truck, Store, Filter, Clock, Download, Wallet } from 'lucide-react';
import { markOrderPaid } from '../../lib/markOrderPaid';
import { markOrderReady } from '../../lib/markOrderReady';
import { downloadOrderReceiptPdf } from '../../lib/orderReceiptPdf';
import { supabase } from '../../lib/supabase';
import { getCompletedOrderLabel, getPendingPaymentLabel, getReadyOrderLabel, getServiceModeLabel, isAwaitingCounterPayment, isAwaitingOnlinePayment, isDineInOrder } from '../../lib/orderLabels';
import { useToast } from '../../components/Toast';
import type { Order, OrderStatus } from '../../types';

const pickupFlow: OrderStatus[] = ['confirmed', 'preparing', 'packed', 'delivered'];
const deliveryFlow: OrderStatus[] = ['confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered'];
type ReceiptItemRow = {
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: unknown;
};

const PREP_TIME_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60];

function getNextStatus(order: Order): OrderStatus | null {
  const flow = order.order_type === 'pickup' ? pickupFlow : deliveryFlow;
  const currentIdx = flow.indexOf(order.status as OrderStatus);
  if (currentIdx === -1 || currentIdx >= flow.length - 1) return null;
  return flow[currentIdx + 1];
}

function statusLabel(order: Order): string {
  if (isAwaitingCounterPayment(order)) {
    return 'Awaiting Payment';
  }
  if (order.order_type === 'pickup') {
    if (order.status === 'packed') return getReadyOrderLabel(order);
    if (order.status === 'delivered') return getCompletedOrderLabel(order);
    if (order.status === 'out_for_delivery') return 'Ready';
  }
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    packed: 'Packed',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return labels[order.status] || order.status;
}

function nextActionLabel(nextStatus: OrderStatus, order: Order): string {
  if (order.order_type === 'pickup') {
    if (nextStatus === 'packed') return isDineInOrder(order) ? 'Mark Ready to Serve' : 'Mark Ready';
    if (nextStatus === 'delivered') return isDineInOrder(order) ? 'Mark Served' : 'Mark Picked Up';
  }
  const labels: Record<string, string> = {
    confirmed: 'Confirm',
    preparing: 'Start Preparing',
    packed: 'Mark Packed',
    out_for_delivery: 'Send for Delivery',
    delivered: 'Mark Delivered',
  };
  return labels[nextStatus] || nextStatus;
}

function statusColor(order: Order): string {
  if (isAwaitingCounterPayment(order)) return 'bg-amber-500/10 text-amber-400';
  const { status, order_type: orderType } = order;
  if (orderType === 'pickup' && status === 'packed') return 'bg-green-500/10 text-green-400';
  if (status === 'delivered') return 'bg-green-500/10 text-green-400';
  if (status === 'cancelled' || status === 'expired') return 'bg-red-500/10 text-red-400';
  if (status === 'pending') return 'bg-orange-500/10 text-orange-400';
  if (status === 'preparing') return 'bg-yellow-500/10 text-yellow-400';
  return 'bg-blue-500/10 text-blue-400';
}

function ConfirmPanel({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: (minutes: number) => void;
}) {
  const [selectedMinutes, setSelectedMinutes] = useState(15);

  return (
    <div className="mt-3 pt-3 border-t border-brand-border space-y-3">
      <div>
        <p className="text-xs font-semibold text-brand-text-dim mb-2 flex items-center gap-1">
          <Clock size={12} />
          Estimated prep time
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PREP_TIME_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMinutes(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedMinutes === m
                  ? 'bg-brand-gold text-brand-bg border-brand-gold'
                  : 'bg-brand-surface-light text-brand-text-muted border-brand-gold/20 hover:border-brand-gold/40'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-xs font-medium text-brand-text-muted hover:border-red-500/30 hover:text-red-400 transition-colors"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          onClick={() => onConfirm(selectedMinutes)}
          className="flex items-center gap-1 px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
        >
          <Check size={14} />
          Confirm ({selectedMinutes} min)
        </button>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('placed_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Failed to load orders', error);
      showToast(error.message || 'Failed to load orders', 'error');
    }
    setOrders(data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    void loadOrders();
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  async function confirmWithTime(orderId: string, minutes: number) {
    const { error } = await supabase.from('orders').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      estimated_minutes: minutes,
    }).eq('id', orderId);

    if (error) {
      console.error('Failed to confirm order', error);
      showToast(error.message || 'Failed to confirm order', 'error');
      return;
    }

    setConfirmingId(null);
    showToast('Order confirmed');
    await loadOrders();
  }

  async function updateStatus(order: Order, status: OrderStatus) {
    if (status === 'packed') {
      try {
        const result = await markOrderReady(order.order_id);
        showToast('Order updated');
        await loadOrders();

        if (order.order_type === 'pickup' && result.readyEmailSent === false) {
          showToast('Order updated, but ready email failed', 'error');
        }
      } catch (error) {
        console.error('Failed to update order status', error);
        showToast('Failed to update order', 'error');
      }
      return;
    }

    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);

    if (error) {
      console.error('Failed to update order status', error);
      showToast('Failed to update order', 'error');
      return;
    }

    showToast('Order updated');
    await loadOrders();
  }

  async function cancelOrder(orderId: string) {
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (error) {
      console.error('Failed to cancel order', error);
      showToast(error.message || 'Failed to cancel order', 'error');
      return;
    }
    setConfirmingId(null);
    showToast('Order cancelled');
    await loadOrders();
  }

  async function markPaymentCollected(order: Order) {
    if (payingOrderId === order.id) return;
    setPayingOrderId(order.id);

    try {
      const result = await markOrderPaid(order.order_id);
      showToast('Payment marked as paid');
      if (result.receiptEmailSent === false) {
        showToast('Payment updated, but receipt email failed', 'error');
      }
      await loadOrders();
    } catch (error) {
      console.error('Failed to mark payment as paid', error);
      showToast('Failed to mark payment as paid', 'error');
    } finally {
      setPayingOrderId(null);
    }
  }

  async function downloadReceipt(order: Order) {
    setDownloadingId(order.id);

    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('item_name, quantity, unit_price, customizations')
        .eq('order_id', order.id);

      if (error) {
        console.error('Failed to load receipt items', error);
        showToast(error.message || 'Failed to load receipt items', 'error');
        return;
      }

      await downloadOrderReceiptPdf(order, (data || []) as ReceiptItemRow[]);
      showToast('Receipt downloaded');
    } catch (error) {
      console.error('Failed to download receipt PDF', error);
      showToast('Failed to download receipt PDF', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  function getExpiryRemaining(expiresAt: string) {
    const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    if (remaining <= 0) return 'Expired';
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const visibleOrders = orders.filter((o) => !isAwaitingOnlinePayment(o));
  const activeStatuses = ['pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery'];

  const filteredOrders = visibleOrders.filter((o) => {
    const typeMatch = typeFilter === 'all' || o.order_type === typeFilter;
    const statusMatch =
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? activeStatuses.includes(o.status) :
      o.status === statusFilter;
    return typeMatch && statusMatch;
  });

  const pickupCount = visibleOrders.filter((o) => o.order_type === 'pickup' && activeStatuses.includes(o.status)).length;
  const deliveryCount = visibleOrders.filter((o) => o.order_type === 'delivery' && activeStatuses.includes(o.status)).length;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-brand-surface rounded w-32" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-brand-surface rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-white">Orders</h1>
        <button onClick={loadOrders} className="text-sm text-brand-gold font-semibold hover:underline">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          { value: 'all', label: 'All Orders', icon: Filter },
          { value: 'pickup', label: `Pickup (${pickupCount})`, icon: Store },
          { value: 'delivery', label: `Delivery (${deliveryCount})`, icon: Truck },
        ] as const).map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              typeFilter === t.value
                ? 'bg-brand-gold text-brand-bg shadow-sm'
                : 'bg-brand-surface text-brand-text-muted border border-brand-border hover:bg-brand-surface-light'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['active', 'all', 'pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'expired'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              statusFilter === s ? 'bg-brand-gold text-brand-bg' : 'bg-brand-surface text-brand-text-muted border border-brand-border hover:bg-brand-surface-light'
            }`}
          >
            {s === 'active' ? 'Active' : s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-10 text-center text-brand-text-muted">
          No orders found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const nextStatus = getNextStatus(order);
            const isTerminal = ['cancelled', 'expired', 'delivered'].includes(order.status);
            const isPickupReady = order.order_type === 'pickup' && order.status === 'packed';
            const isConfirming = confirmingId === order.id;
            const isCounterPaymentPending = isAwaitingCounterPayment(order);

            return (
              <div
                key={order.id}
                className={`bg-brand-surface rounded-xl border p-4 transition-all ${
                  isPickupReady ? 'border-green-500/30 ring-1 ring-green-500/20' : 'border-brand-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-lg text-white">{order.order_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(order)}`}>
                        {statusLabel(order)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.order_type === 'pickup'
                          ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}>
                        {order.order_type === 'pickup' ? <Store size={11} /> : <Truck size={11} />}
                        {getServiceModeLabel(order)}
                      </span>
                    </div>
                    <p className="text-sm text-brand-text-muted mt-0.5">
                      {order.customer_name} &bull; {order.customer_phone}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-white">₹{order.total}</p>
                    <p className="text-xs text-brand-text-dim mb-2">{getTimeAgo(order.placed_at)}</p>
                    <button
                      onClick={() => downloadReceipt(order)}
                      disabled={downloadingId === order.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={13} />
                      {downloadingId === order.id ? 'Preparing PDF...' : 'Download PDF'}
                    </button>
                  </div>
                </div>

                {order.order_type === 'delivery' && order.address && (
                  <p className="text-xs text-brand-text-dim mb-3 truncate">
                    Delivery: {order.address}, {order.pincode}
                  </p>
                )}

                {order.estimated_minutes && ['confirmed', 'preparing'].includes(order.status) && (
                  <div className="flex items-center gap-1.5 mb-3 text-xs text-brand-text-muted">
                    <Clock size={12} />
                    <span>Est. {order.estimated_minutes} min prep time</span>
                  </div>
                )}

                {isPickupReady && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={14} className="text-white" />
                    </div>
                    <span className="text-sm text-green-400 font-semibold">
                      {isDineInOrder(order) ? 'Ready to serve for dine-in' : 'Ready for customer pickup'}
                    </span>
                  </div>
                )}

                {isCounterPaymentPending && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet size={15} className="text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-amber-400 font-semibold">{getPendingPaymentLabel(order)}</p>
                        <p className="text-xs text-brand-text-dim">
                          Collect payment at the counter before confirming this order
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => markPaymentCollected(order)}
                      disabled={payingOrderId === order.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={14} />
                      {payingOrderId === order.id ? 'Marking...' : 'Mark Paid'}
                    </button>
                  </div>
                )}

                {order.status === 'pending' && !isCounterPaymentPending && !isConfirming && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-brand-border">
                    <span className="text-xs text-orange-400 font-medium">
                      Expires: {getExpiryRemaining(order.expires_at)}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-xs font-medium text-brand-text-muted hover:border-red-500/30 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                    <button
                      onClick={() => setConfirmingId(order.id)}
                      className="flex items-center gap-1 px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <Check size={14} />
                      Confirm
                    </button>
                  </div>
                )}

                {order.status === 'pending' && isCounterPaymentPending && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-brand-border">
                    <span className="text-xs text-orange-400 font-medium">
                      Expires: {getExpiryRemaining(order.expires_at)}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-xs font-medium text-brand-text-muted hover:border-red-500/30 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                )}

                {order.status === 'pending' && !isCounterPaymentPending && isConfirming && (
                  <ConfirmPanel
                    onCancel={() => setConfirmingId(null)}
                    onConfirm={(minutes) => confirmWithTime(order.id, minutes)}
                  />
                )}

                {!isTerminal && order.status !== 'pending' && nextStatus && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-brand-border">
                    <div className="flex-1" />
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-xs font-medium text-brand-text-muted hover:border-red-500/30 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                    <button
                      onClick={() => updateStatus(order, nextStatus)}
                      className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isPickupReady
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-brand-gold text-brand-bg hover:bg-brand-gold-soft'
                      }`}
                    >
                      <ChevronRight size={14} />
                      {nextActionLabel(nextStatus, order)}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
