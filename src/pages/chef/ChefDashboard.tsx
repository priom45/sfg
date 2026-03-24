import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChefHat, LogOut, Clock, Check, Flame, Package, Users, Timer,
  Store, Truck, Volume2, VolumeX, Bell, Zap, Wallet, BadgeCheck, Copy,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCompletedOrderLabel, getPendingPaymentLabel, getReadyOrderLabel, getServiceModeLabel, isAwaitingCounterPayment, isAwaitingOnlinePayment } from '../../lib/orderLabels';
import { markOrderPaid } from '../../lib/markOrderPaid';
import { markOrderReady } from '../../lib/markOrderReady';
import { playNewOrderAlert, playAcceptSound, playOrderCompleteSound } from '../../lib/sounds';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import type { Order } from '../../types';

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: { group_name: string; option_name: string; price: number }[] | null;
}

type Tab = 'payments' | 'queue' | 'preparing' | 'done';

export default function ChefDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('queue');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [handoffOrderId, setHandoffOrderId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { signOut } = useAuth();
  const prevPendingCountRef = useRef(0);
  const initialLoadRef = useRef(true);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['pending', 'confirmed', 'preparing', 'packed', 'delivered'])
      .order('placed_at', { ascending: true });

    if (data && data.length > 0) {
      const pendingCount = data.filter((o) => o.status === 'pending' && !isAwaitingOnlinePayment(o) && !isAwaitingCounterPayment(o)).length;

      if (!initialLoadRef.current && soundEnabled && pendingCount > prevPendingCountRef.current) {
        playNewOrderAlert();
        setNewOrderFlash(true);
        setTab('queue');
        setTimeout(() => setNewOrderFlash(false), 2000);
      }

      prevPendingCountRef.current = pendingCount;
      initialLoadRef.current = false;
      setOrders(data);

      const ids = data.map((o) => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', ids);

      if (items) {
        const map: Record<string, OrderItemRow[]> = {};
        items.forEach((item) => {
          if (!map[item.order_id]) map[item.order_id] = [];
          map[item.order_id].push(item as OrderItemRow);
        });
        setOrderItemsMap(map);
      }
    } else {
      initialLoadRef.current = false;
      prevPendingCountRef.current = 0;
      setOrders(data || []);
    }
    setLoading(false);
  }, [soundEnabled]);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('chef-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  async function acceptOrder(order: Order) {
    const items = orderItemsMap[order.id] || [];
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedMinutes = Math.max(5, Math.ceil(totalItems * 2.5));

    await supabase.from('orders').update({
      status: 'preparing',
      confirmed_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      estimated_minutes: estimatedMinutes,
      queue_position: null,
    }).eq('id', order.id);

    if (soundEnabled) playAcceptSound();
  }

  async function completeOrder(order: Order) {
    try {
      const result = await markOrderReady(order.order_id);
      const completedAt = new Date().toISOString();

      setOrders((prev) => prev.map((currentOrder) => (
        currentOrder.id === order.id
          ? { ...currentOrder, status: 'packed', completed_at: completedAt }
          : currentOrder
      )));
      showToast(getReadyOrderLabel(order) === 'Ready to Serve' ? 'Order marked ready to serve' : 'Order marked ready for pickup');

      if (soundEnabled) playOrderCompleteSound();

      if (order.order_type === 'pickup' && result.readyEmailSent === false) {
        showToast('Order updated, but ready email failed', 'error');
      }
    } catch (error) {
      console.error('Failed to mark order complete', error);
      showToast('Failed to mark order complete', 'error');
      return;
    }
  }

  async function markPickedUp(orderId: string) {
    if (handoffOrderId === orderId) return;
    setHandoffOrderId(orderId);

    const { error } = await supabase.from('orders').update({
      status: 'delivered',
    }).eq('id', orderId);

    if (error) {
      console.error('Failed to mark order as picked up', error);
      showToast('Failed to update pickup status', 'error');
      setHandoffOrderId(null);
      return;
    }

    setOrders((prev) => prev.map((order) => (
      order.id === orderId
        ? { ...order, status: 'delivered' }
        : order
    )));
    showToast('Pickup marked successfully');
    setHandoffOrderId(null);
  }

  async function markPaymentCollected(order: Order) {
    if (payingOrderId === order.id) return;
    setPayingOrderId(order.id);

    try {
      const result = await markOrderPaid(order.order_id);

      setOrders((prev) => prev.map((currentOrder) => (
        currentOrder.id === order.id
          ? { ...currentOrder, payment_status: 'paid' }
          : currentOrder
      )));
      showToast('Payment marked as paid');

      if (result.receiptEmailSent === false) {
        showToast('Payment updated, but receipt email failed', 'error');
      }
    } catch (error) {
      console.error('Failed to mark payment as paid', error);
      showToast('Failed to mark payment as paid', 'error');
    }
    setPayingOrderId(null);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/chef/login');
  }

  function copyOrderId(orderId: string) {
    navigator.clipboard.writeText(orderId);
    showToast('Order ID copied');
  }

  const paymentOrders = orders.filter((o) => o.status === 'pending' && isAwaitingCounterPayment(o));
  const queueOrders = orders.filter((o) => o.status === 'pending' && !isAwaitingOnlinePayment(o) && !isAwaitingCounterPayment(o));
  const preparingOrders = orders.filter((o) => o.status === 'preparing' || o.status === 'confirmed');
  const doneOrders = orders.filter((o) => o.status === 'packed' || o.status === 'delivered');
  const todayDone = doneOrders
    .filter((o) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(o.placed_at) >= today;
    })
    .sort((a, b) => getDoneOrderTime(b) - getDoneOrderTime(a));

  const tabs: { key: Tab; label: string; count: number; icon: typeof Clock }[] = [
    { key: 'payments', label: 'Payments', count: paymentOrders.length, icon: Wallet },
    { key: 'queue', label: 'Queue', count: queueOrders.length, icon: Users },
    { key: 'preparing', label: 'Preparing', count: preparingOrders.length, icon: Flame },
    { key: 'done', label: 'Done', count: todayDone.length, icon: Check },
  ];

  const displayOrders = tab === 'payments'
    ? paymentOrders
    : tab === 'queue'
      ? queueOrders
      : tab === 'preparing'
        ? preparingOrders
        : todayDone;

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-brand-text-dim text-sm font-medium">Loading kitchen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className={`sticky top-0 z-50 border-b border-brand-border px-4 py-3 transition-colors duration-300 ${
        newOrderFlash ? 'bg-orange-500/20' : 'bg-brand-surface'
      }`}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              newOrderFlash
                ? 'bg-orange-500 animate-bounce-subtle'
                : 'bg-orange-500/10 border border-orange-500/20'
            }`}>
              <ChefHat size={20} className={newOrderFlash ? 'text-white' : 'text-orange-400'} />
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-white leading-tight">Kitchen</h1>
              <p className="text-[11px] text-brand-text-dim font-medium">The Supreme Waffle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'text-orange-400 bg-orange-500/10' : 'text-brand-text-dim hover:bg-brand-surface-light/60'
              }`}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 text-brand-text-dim hover:text-orange-400 transition-colors rounded-lg hover:bg-brand-surface-light/60"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="sticky top-[57px] z-40 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border">
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
            <StatCard label="Pay" value={paymentOrders.length} color="rose" />
            <StatCard label="Queue" value={queueOrders.length} color="orange" />
            <StatCard label="Making" value={preparingOrders.length} color="amber" />
            <StatCard label="Ready" value={doneOrders.filter(o => o.status === 'packed').length} color="emerald" />
            <StatCard label="Done" value={todayDone.filter(o => o.status === 'delivered').length} color="blue" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                  tab === t.key
                    ? t.key === 'payments'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                      : t.key === 'queue'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : t.key === 'preparing'
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                      : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-brand-surface text-brand-text-dim border border-brand-border'
                }`}
              >
                <t.icon size={15} />
                {t.label}
                {t.count > 0 && (
                  <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[11px] font-black px-1.5 ${
                    tab === t.key ? 'bg-brand-surface-strong/80' : 'bg-brand-surface-light'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-20 space-y-3">
        {displayOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center mb-4">
              {tab === 'payments' ? <Wallet size={28} className="text-brand-text-dim" /> :
               tab === 'queue' ? <Users size={28} className="text-brand-text-dim" /> :
               tab === 'preparing' ? <Flame size={28} className="text-brand-text-dim" /> :
               <Check size={28} className="text-brand-text-dim" />}
            </div>
            <p className="text-brand-text-muted font-semibold">
              {tab === 'payments' ? 'No counter payments waiting' :
               tab === 'queue' ? 'No orders in queue' :
               tab === 'preparing' ? 'No orders being prepared' :
               'No completed orders today'}
            </p>
            {tab === 'payments' && (
              <p className="text-brand-text-dim text-[12px] mt-1">
                Counter cash and UPI orders will appear here until marked paid
              </p>
            )}
            {tab === 'queue' && (
              <p className="text-brand-text-dim text-[12px] mt-1">
                New orders will appear here with a sound alert
              </p>
            )}
          </div>
        )}

        {displayOrders.map((order, idx) => {
          const items = orderItemsMap[order.id] || [];
          const isPaymentPending = isAwaitingCounterPayment(order);
          const isQueue = order.status === 'pending' && !isPaymentPending;
          const isPreparing = order.status === 'preparing' || order.status === 'confirmed';
          const isReady = order.status === 'packed';
          const isPaymentTab = tab === 'payments';
          const totalQty = items.reduce((s, i) => s + i.quantity, 0);

          return (
            <div
              key={order.id}
              className={`rounded-2xl border p-4 transition-all animate-fade-in ${
                isPaymentPending
                  ? 'bg-brand-surface border-rose-500/30 shadow-lg shadow-rose-500/5'
                  : isQueue
                  ? 'bg-brand-surface border-orange-500/30 shadow-lg shadow-orange-500/5'
                  : isPreparing
                  ? 'bg-brand-surface border-amber-500/20'
                  : isReady
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-brand-surface border-brand-border opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isQueue && (
                      <span className="w-7 h-7 bg-orange-500 text-white rounded-lg flex items-center justify-center text-[12px] font-black">
                        #{idx + 1}
                      </span>
                    )}
                    {isPaymentPending && (
                      <span className="w-7 h-7 bg-rose-500 text-white rounded-lg flex items-center justify-center">
                        <Wallet size={14} />
                      </span>
                    )}
                    {isPreparing && (
                      <span className="w-7 h-7 bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center">
                        <Flame size={14} />
                      </span>
                    )}
                    <span className="font-black text-xl text-white">{order.order_id}</span>
                    <button
                      onClick={() => copyOrderId(order.order_id)}
                      className="p-1.5 rounded-lg text-brand-text-dim hover:text-brand-gold hover:bg-brand-surface-light/60 transition-colors"
                      aria-label={`Copy order ID ${order.order_id}`}
                    >
                      <Copy size={14} />
                    </button>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      isPaymentPending ? 'bg-rose-500/10 text-rose-400' :
                      isQueue ? 'bg-orange-500/10 text-orange-400' :
                      isPreparing ? 'bg-amber-500/10 text-amber-400' :
                      isReady ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-brand-text-dim/10 text-brand-text-dim'
                    }`}>
                      {isPaymentPending ? 'Payment Pending' : isQueue ? 'In Queue' : isPreparing ? 'Preparing' : isReady ? getReadyOrderLabel(order) : getCompletedOrderLabel(order)}
                    </span>
                  </div>
                  <p className="text-[13px] text-brand-text-dim mt-1">
                    {order.customer_name} -- {getTimeAgo(order.placed_at)}
                  </p>
                </div>
                <span className="font-bold text-brand-gold text-lg tabular-nums">{'\u20B9'}{order.total}</span>
              </div>

              <div className="flex items-center gap-2 mb-3 text-[12px] flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${
                  order.order_type === 'pickup'
                    ? 'bg-brand-gold/10 text-brand-gold'
                    : 'bg-sky-500/10 text-sky-400'
                }`}>
                  {order.order_type === 'pickup' ? <Store size={12} /> : <Truck size={12} />}
                  {getServiceModeLabel(order)}
                </span>
                <span className="text-brand-text-dim">{totalQty} item{totalQty !== 1 ? 's' : ''}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold ${
                  order.payment_status === 'paid'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isPaymentPending
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-red-500/10 text-red-400'
                }`}>
                  {order.payment_status === 'paid' ? <BadgeCheck size={12} /> : <Wallet size={12} />}
                  {order.payment_status === 'paid'
                    ? 'Paid'
                    : order.payment_method === 'upi' ? 'UPI Pending' : 'Cash Pending'}
                </span>
              </div>

              {isPaymentPending && (
                <div className="rounded-xl border-2 border-rose-500/20 bg-rose-500/5 p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-rose-400" />
                      <div>
                        <p className="text-[13px] font-bold text-rose-400">
                          {getPendingPaymentLabel(order)}
                        </p>
                        <p className="text-[11px] text-brand-text-dim">
                          {order.payment_method === 'upi' ? 'Check the customer UPI payment and then mark paid' : 'Collect cash at the counter and then mark paid'} -- {order.order_id} -- {'\u20B9'}{order.total}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => markPaymentCollected(order)}
                      disabled={payingOrderId === order.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-colors active:scale-95 flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={12} />
                      {payingOrderId === order.id ? 'Marking...' : 'Mark Paid'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-brand-text-dim">
                    After payment is marked, this order moves into the chef queue.
                  </p>
                </div>
              )}

              {order.payment_status !== 'paid' && !isPaymentPending && (isQueue || isPreparing || isReady) && (
                <div className="rounded-xl border-2 border-red-500/20 bg-red-500/5 p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-red-400" />
                      <div>
                        <p className="text-[13px] font-bold text-red-400">
                          {order.payment_method === 'upi' ? 'UPI Payment Pending' : 'Cash Pending'}
                        </p>
                        <p className="text-[11px] text-brand-text-dim">
                          {order.payment_method === 'upi' ? 'Verify UPI received' : 'Collect cash'} -- {'\u20B9'}{order.total}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => markPaymentCollected(order)}
                      disabled={payingOrderId === order.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-colors active:scale-95 flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={12} />
                      {payingOrderId === order.id ? 'Marking...' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              )}

              {items.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-brand-surface-light/60 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-brand-gold/20 rounded-md flex items-center justify-center text-[11px] font-black text-brand-gold tabular-nums shrink-0">
                            {item.quantity}x
                          </span>
                          <span className="text-white font-semibold">{item.item_name}</span>
                        </div>
                        <span className="text-brand-text-dim text-[12px] tabular-nums">{'\u20B9'}{Number(item.unit_price) * item.quantity}</span>
                      </div>
                      {item.customizations && item.customizations.length > 0 && (
                        <div className="mt-1.5 ml-8 space-y-0.5">
                          {item.customizations.map((c, i) => (
                            <p key={i} className="text-[11px] text-brand-text-dim">
                              {c.group_name}: <span className="text-brand-text-muted">{c.option_name}</span>
                              {c.price > 0 && <span className="text-brand-gold ml-1">(+{'\u20B9'}{c.price})</span>}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-brand-surface-light/60 rounded-lg px-3 py-3 mb-3 text-center">
                  <p className="text-[12px] text-brand-text-dim">Loading items...</p>
                </div>
              )}

              {isPreparing && order.accepted_at && order.estimated_minutes && (
                <PrepTimer acceptedAt={order.accepted_at} estimatedMinutes={order.estimated_minutes} />
              )}

              {isQueue && (
                <button
                  onClick={() => acceptOrder(order)}
                  className="w-full mt-2 py-3.5 rounded-xl font-bold text-[14px] bg-orange-500 text-white hover:bg-orange-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <Zap size={18} />
                  Accept & Start Preparing
                </button>
              )}

              {isPaymentTab && isPaymentPending && (
                <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-center">
                  <p className="text-[12px] font-semibold text-rose-300">
                    Waiting for counter payment confirmation for order <span className="font-black text-white">{order.order_id}</span>
                  </p>
                </div>
              )}

              {isPreparing && (
                <button
                  onClick={() => completeOrder(order)}
                  className="w-full mt-2 py-3.5 rounded-xl font-bold text-[14px] bg-emerald-500 text-white hover:bg-emerald-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Package size={18} />
                  Mark Complete
                </button>
              )}

              {isReady && (
                <button
                  onClick={() => markPickedUp(order.id)}
                  disabled={handoffOrderId === order.id}
                  className="w-full mt-2 py-3.5 rounded-xl font-bold text-[14px] bg-brand-gold text-brand-bg hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {handoffOrderId === order.id
                    ? 'Updating...'
                    : getCompletedOrderLabel(order) === 'Served' ? 'Mark Served' : 'Customer Picked Up'}
                </button>
              )}
            </div>
          );
        })}
      </main>

      {paymentOrders.length > 0 && tab !== 'payments' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <button
            onClick={() => setTab('payments')}
            className="flex items-center gap-2 bg-rose-500 text-white px-5 py-3 rounded-full font-bold text-[14px] shadow-elevated shadow-rose-500/30 hover:bg-rose-600 transition-all active:scale-95"
          >
            <Wallet size={16} />
            {paymentOrders.length} payment{paymentOrders.length !== 1 ? 's' : ''} waiting
          </button>
        </div>
      )}

      {queueOrders.length > 0 && tab !== 'queue' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <button
            onClick={() => setTab('queue')}
            className="flex items-center gap-2 bg-orange-500 text-white px-5 py-3 rounded-full font-bold text-[14px] shadow-elevated shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
          >
            <Bell size={16} className="animate-bounce" />
            {queueOrders.length} order{queueOrders.length !== 1 ? 's' : ''} waiting
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${colorMap[color]}`}>
      <p className="text-lg font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function getDoneOrderTime(order: Order) {
  return new Date(order.completed_at || order.placed_at).getTime();
}

function PrepTimer({ acceptedAt, estimatedMinutes }: { acceptedAt: string; estimatedMinutes: number }) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const readyAt = new Date(acceptedAt).getTime() + estimatedMinutes * 60_000;

    function tick() {
      const left = Math.max(0, Math.floor((readyAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [acceptedAt, estimatedMinutes]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const totalSecs = estimatedMinutes * 60;
  const elapsed = totalSecs - remaining;
  const progress = Math.min(100, (elapsed / totalSecs) * 100);

  return (
    <div className={`rounded-xl p-3 mb-2 border ${
      remaining <= 0
        ? 'bg-red-500/5 border-red-500/20'
        : 'bg-amber-500/5 border-amber-500/10'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${
          remaining <= 0 ? 'text-red-400' : 'text-amber-400'
        }`}>
          <Timer size={13} />
          {remaining > 0 ? 'Time remaining' : 'Time is up!'}
        </div>
        <span className={`text-[14px] font-black tabular-nums ${
          remaining <= 0 ? 'text-red-400' : 'text-amber-400'
        }`}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div className="h-1.5 bg-brand-surface-light rounded-full overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${
            remaining <= 0 ? 'bg-red-500' : 'bg-amber-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
