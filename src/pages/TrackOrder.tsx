import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Phone, MessageCircle, ArrowLeft, Package, Bell, PartyPopper, Clock, Truck, ChefHat, Users, Sparkles, ArrowRight, Star, CheckCircle, Wallet, BadgeCheck, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCompletedOrderLabel, getPaymentMethodLabel, getPendingPaymentLabel, getReadyOrderLabel, getServiceModeLabel, isAwaitingOnlinePayment, isDineInOrder } from '../lib/orderLabels';
import { playOrderCompleteSound, playPickupReadyAlert } from '../lib/sounds';
import type { Order, OrderItem, MenuItem } from '../types';
import OrderTimeline from '../components/OrderTimeline';
import { useAuth } from '../contexts/AuthContext';

function PrepCountdown({ confirmedAt, estimatedMinutes }: { confirmedAt: string; estimatedMinutes: number }) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const readyAt = new Date(confirmedAt).getTime() + estimatedMinutes * 60_000;

    function tick() {
      const left = Math.max(0, Math.floor((readyAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [confirmedAt, estimatedMinutes]);

  if (remaining <= 0) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center backdrop-blur-sm">
        <Clock size={24} strokeWidth={2.2} className="mx-auto mb-2 text-amber-400" />
        <p className="text-[14px] font-semibold text-amber-400">Almost ready! Just a moment...</p>
      </div>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const totalSecs = estimatedMinutes * 60;
  const progress = Math.max(0, Math.min(100, ((totalSecs - remaining) / totalSecs) * 100));

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
      <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-wider text-brand-text-dim">
        Estimated ready in
      </p>
      <div className="mb-4 flex items-center justify-center gap-2">
        <div className="min-w-[64px] rounded-xl bg-brand-surface-light px-4 py-3 text-center">
          <span className="text-3xl font-black tabular-nums text-white">
            {String(mins).padStart(2, '0')}
          </span>
          <p className="mt-0.5 text-[12px] font-semibold uppercase text-brand-text-dim">min</p>
        </div>
        <span className="px-1 text-2xl font-black tabular-nums text-brand-text-dim">:</span>
        <div className="min-w-[64px] rounded-xl bg-brand-surface-light px-4 py-3 text-center">
          <span className="text-3xl font-black tabular-nums text-white">
            {String(secs).padStart(2, '0')}
          </span>
          <p className="mt-0.5 text-[12px] font-semibold uppercase text-brand-text-dim">sec</p>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-brand-surface-light">
        <div
          className="h-2 rounded-full bg-brand-gold transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-center text-[12px] font-semibold text-brand-text-dim">
        Your waffles are being freshly made
      </p>
    </div>
  );
}

export default function TrackOrderPage() {
  const { orderId: paramOrderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [searchId, setSearchId] = useState(paramOrderId || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [queueAhead, setQueueAhead] = useState(0);
  const [specials, setSpecials] = useState<MenuItem[]>([]);
  const prevStatusRef = useRef<string | null>(null);
  const pickupAlertPlayedRef = useRef(false);

  useEffect(() => {
    setSearchId(paramOrderId || '');
  }, [paramOrderId]);

  useEffect(() => {
    void loadSpecials();
  }, []);

  useEffect(() => {
    if (!order) return;

    async function loadQueuePosition(currentOrder: Order) {
      const { data } = await supabase
        .from('orders')
        .select('id, payment_provider, payment_status')
        .eq('status', 'pending')
        .lt('placed_at', currentOrder.placed_at);

      setQueueAhead((data || []).filter((queuedOrder) => !isAwaitingOnlinePayment(queuedOrder)).length);
    }

    if (order.order_type === 'pickup' && order.status === 'packed') {
      setShowReadyBanner(true);
      if (!pickupAlertPlayedRef.current) {
        pickupAlertPlayedRef.current = true;
        playPickupReadyAlert();
      }
    } else {
      setShowReadyBanner(false);
    }

    if (order.status === 'pending') {
      void loadQueuePosition(order);
    } else {
      setQueueAhead(0);
    }

    if (prevStatusRef.current && prevStatusRef.current !== order.status) {
      if (order.status === 'packed') {
        playOrderCompleteSound();
      }
    }
    prevStatusRef.current = order.status;

    const channel = supabase
      .channel(`track-${order.order_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `order_id=eq.${order.order_id}` }, (payload) => {
        const updated = payload.new as Order;
        setOrder(updated);
        if (updated.order_type === 'pickup' && updated.status === 'packed') {
          setShowReadyBanner(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order]);

  async function loadSpecials() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('rating', { ascending: false })
      .limit(6);
    if (data) setSpecials(data);
  }

  const fetchOrder = useCallback(async (id: string) => {
    if (!user) {
      setOrder(null);
      setOrderItems([]);
      setSearched(true);
      setLoading(false);
      return;
    }

    const normalizedId = id.trim().toUpperCase();

    setLoading(true);
    setSearched(true);
    setShowReadyBanner(false);
    setQueueAhead(0);
    setOrderItems([]);
    prevStatusRef.current = null;
    pickupAlertPlayedRef.current = false;

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('order_id', normalizedId)
      .maybeSingle();

    if (data) {
      setOrder(data);
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', data.id);
      setOrderItems(items || []);
    } else {
      setOrder(null);
      setOrderItems([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (paramOrderId) {
      void fetchOrder(paramOrderId);
    }
  }, [paramOrderId, fetchOrder]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchId.trim()) fetchOrder(searchId);
  }

  const isReadyForPickup = order?.order_type === 'pickup' && order?.status === 'packed';
  const isDelivered = order?.status === 'delivered';
  const isInQueue = order?.status === 'pending';
  const isPreparing = order?.status === 'preparing';
  const isActive = order && !['cancelled', 'expired', 'delivered'].includes(order.status) && !isReadyForPickup;
  const showCountdown = isActive && order.estimated_minutes && (order.accepted_at || order.confirmed_at) && ['confirmed', 'preparing'].includes(order.status);
  const serviceModeLabel = order ? getServiceModeLabel(order) : '';
  const readyOrderLabel = order ? getReadyOrderLabel(order) : '';
  const completedOrderLabel = order ? getCompletedOrderLabel(order) : '';
  const isDineIn = order ? isDineInOrder(order) : false;

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="section-padding py-10">
        <Link
          to="/"
          className="group mb-8 inline-flex items-center gap-2 text-[14px] font-semibold text-brand-text-dim transition-colors hover:text-brand-gold"
        >
          <ArrowLeft size={16} strokeWidth={2.2} className="transition-transform group-hover:-translate-x-0.5" />
          Back to Home
        </Link>

        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Track Your Order
        </h1>

        <form onSubmit={handleSearch} className="mb-10 flex max-w-lg gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              strokeWidth={2.2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-text-dim"
            />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value.toUpperCase())}
              placeholder="Enter Order ID (e.g. SW-1234)"
              className="input-field pl-10 uppercase"
            />
          </div>
          <button type="submit" className="btn-primary px-6">
            Track
          </button>
        </form>

        {!user && (
          <div className="max-w-lg py-12 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand-surface">
              <User size={32} className="text-brand-text-dim" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-white">Sign in to track your order</h3>
            <p className="text-[14px] font-medium text-brand-text-muted mb-6">
              Order tracking is available for the account that placed the order.
            </p>
            <Link to="/auth" state={{ from: paramOrderId ? `/track/${paramOrderId}` : '/track' }} className="btn-primary">
              Sign In
            </Link>
          </div>
        )}

        {user && loading && (
          <div className="max-w-lg animate-pulse space-y-4">
            <div className="h-8 w-36 rounded-lg bg-brand-surface-light" />
            <div className="h-44 rounded-2xl bg-brand-surface-light" />
          </div>
        )}

        {user && !loading && searched && !order && (
          <div className="max-w-lg py-20 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand-surface">
              <Package size={32} className="text-brand-text-dim" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-white">Order not found</h3>
            <p className="text-[14px] font-medium text-brand-text-muted">
              Please check the order ID and try again
            </p>
          </div>
        )}

        {order && (
          <div className="max-w-lg space-y-6 animate-fade-in">

            {showReadyBanner && isReadyForPickup && (
              <div className="relative overflow-hidden rounded-2xl bg-emerald-500 p-6 text-center text-white shadow-elevated animate-scale-in backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent)]" />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface-strong/80 backdrop-blur-sm">
                    <Bell size={32} className="animate-bounce" />
                  </div>
                  <h2 className="mb-2 text-2xl font-black">{readyOrderLabel}!</h2>
                  <p className="mb-4 text-[14px] text-emerald-100">
                    Show order {order.order_id} at the counter for your {serviceModeLabel.toLowerCase()} order
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand-surface-strong/80 px-4 py-2 text-[14px] font-semibold backdrop-blur-sm">
                    <PartyPopper size={16} />
                    Enjoy your waffles!
                  </div>
                </div>
              </div>
            )}

            {isInQueue && (
              <div className="relative overflow-hidden rounded-2xl bg-orange-500 p-6 text-center text-white shadow-elevated animate-scale-in backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent)]" />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface-strong/80 backdrop-blur-sm">
                    <Users size={32} />
                  </div>
                  <h2 className="mb-2 text-2xl font-black">Your Order is in Queue</h2>
                  <p className="text-[14px] text-orange-100 mb-3">
                    Please wait while our chef accepts your order
                  </p>
                  {queueAhead > 0 && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-surface-strong/80 px-4 py-2 text-[14px] font-semibold backdrop-blur-sm">
                      <Clock size={14} />
                      {queueAhead} order{queueAhead !== 1 ? 's' : ''} ahead of you
                    </div>
                  )}
                  {queueAhead === 0 && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-surface-strong/80 px-4 py-2 text-[14px] font-semibold backdrop-blur-sm">
                      <Clock size={14} />
                      You're next in line!
                    </div>
                  )}
                </div>
              </div>
            )}

            {isPreparing && (
              <div className="relative overflow-hidden rounded-2xl bg-amber-500 p-6 text-center text-white shadow-elevated animate-scale-in backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent)]" />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface-strong/80 backdrop-blur-sm">
                    <ChefHat size={32} className="animate-pulse" />
                  </div>
                  <h2 className="mb-2 text-2xl font-black">Your Order is Being Prepared</h2>
                  <p className="text-[14px] text-amber-100">
                    {order.estimated_minutes
                      ? `Please wait, your food will be ready in about ${order.estimated_minutes} minutes`
                      : 'Your food is being freshly prepared'}
                  </p>
                </div>
              </div>
            )}

            {order.order_type === 'delivery' && order.status === 'out_for_delivery' && (
              <div className="relative overflow-hidden rounded-2xl bg-sky-500 p-6 text-center text-white shadow-elevated animate-scale-in backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent)]" />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface-strong/80 backdrop-blur-sm">
                    <Truck size={32} />
                  </div>
                  <h2 className="mb-2 text-2xl font-black">Out for Delivery!</h2>
                  <p className="text-[14px] text-sky-100">
                    Our delivery partner is on the way with your waffles
                  </p>
                </div>
              </div>
            )}

            {isDelivered && (
              <div className="relative overflow-hidden rounded-2xl p-6 text-center shadow-elevated">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 to-brand-gold/[0.02] border border-brand-gold/20 rounded-2xl" />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold/15 border border-brand-gold/20">
                    <CheckCircle size={32} className="text-brand-gold" />
                  </div>
                  <h2 className="mb-2 text-2xl font-black text-white">
                    {order.order_type === 'pickup' ? 'Enjoy Your Food!' : 'Order Delivered!'}
                  </h2>
                  <p className="text-[14px] text-brand-text-muted mb-3">
                    {order.order_type === 'pickup'
                      ? 'Thank you for dining with us. We hope you love every bite!'
                      : 'Your waffles have arrived. Enjoy every bite!'}
                  </p>
                  <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-2 text-brand-gold text-[13px] font-bold">
                    <Star size={14} fill="currentColor" />
                    We'd love to see you again soon!
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 transition-shadow duration-300">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-brand-text-dim">Order</p>
                  <p className="text-2xl font-black tabular-nums text-white">
                    {order.order_id}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${
                      order.status === 'delivered'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : order.status === 'cancelled' || order.status === 'expired'
                          ? 'bg-red-500/10 text-red-400'
                          : isReadyForPickup
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-brand-gold/10 text-brand-gold'
                    }`}
                  >
                    {isReadyForPickup
                      ? readyOrderLabel
                      : order.status === 'delivered'
                        ? completedOrderLabel
                        : order.status.replace('_', ' ')}
                  </span>
                  <p className="mt-1 text-[12px] font-semibold text-brand-text-dim">{serviceModeLabel}</p>
                </div>
              </div>

              <OrderTimeline currentStatus={order.status} orderType={order.order_type} pickupOption={order.pickup_option} />
            </div>

            {showCountdown && (
              <PrepCountdown
                confirmedAt={(order.accepted_at || order.confirmed_at)!}
                estimatedMinutes={order.estimated_minutes!}
              />
            )}

            {isActive && !showCountdown && !isInQueue && !isPreparing && (
              <div className="rounded-2xl bg-brand-gold/10 p-6 backdrop-blur-sm">
                <p className="text-[14px] leading-relaxed text-brand-text-muted">
                  {order.order_type === 'delivery'
                    ? 'Your order is being prepared. Estimated delivery time: ~30 minutes'
                    : isDineIn
                      ? 'We are preparing your dine-in order. We will notify you when it is ready to serve.'
                      : 'We are preparing your takeaway order. You will be notified when it is ready for pickup.'}
                </p>
              </div>
            )}

            {orderItems.length > 0 && (
              <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 transition-shadow duration-300">
                <h3 className="mb-4 text-[14px] font-bold uppercase tracking-wider text-white">
                  Order Details
                </h3>
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-[14px]">
                      <span className="text-brand-text-muted">
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="font-semibold tabular-nums text-white">
                        {'\u20B9'}{(item.unit_price * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-brand-border pt-3">
                    <span className="font-bold text-white">Total</span>
                    <span className="text-lg font-bold tabular-nums text-brand-gold">
                      {'\u20B9'}{order.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[13px] text-brand-text-dim">Service</span>
                    <span className="text-[13px] font-bold text-white">
                      {serviceModeLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[13px] text-brand-text-dim">Payment</span>
                    <span className={`inline-flex items-center gap-1.5 text-[13px] font-bold ${
                      order.payment_status === 'paid' ? 'text-emerald-400' : 'text-brand-text-muted'
                    }`}>
                      {order.payment_status === 'paid'
                        ? <><BadgeCheck size={14} /> {getPaymentMethodLabel(order)}</>
                        : <><Wallet size={14} /> {getPendingPaymentLabel(order)}</>
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(isDelivered || isReadyForPickup) && specials.length > 0 && (
              <TrackPageSpecials items={specials} />
            )}

            <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 transition-shadow duration-300">
              <h3 className="mb-4 text-[14px] font-bold uppercase tracking-wider text-white">
                Need Help?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="tel:+919876543210"
                  className="flex items-center justify-center gap-2 rounded-xl border border-brand-border py-3 text-[14px] font-semibold text-brand-text-muted transition-all duration-200 hover:border-brand-gold hover:text-brand-gold"
                >
                  <Phone size={16} strokeWidth={2.2} />
                  Call Us
                </a>
                <a
                  href={`https://wa.me/919876543210?text=Hi, I need help with order ${order.order_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-emerald-600"
                >
                  <MessageCircle size={16} strokeWidth={2.2} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackPageSpecials({ items }: { items: MenuItem[] }) {
  return (
    <div className="rounded-2xl border border-brand-gold/15 bg-gradient-to-b from-brand-gold/[0.04] to-transparent p-5 text-left animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-brand-gold/10 rounded-lg flex items-center justify-center">
          <Sparkles size={16} className="text-brand-gold" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-white">Today's Top Picks</h3>
          <p className="text-[12px] text-brand-text-dim font-medium">Craving more? Try these favorites</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {items.slice(0, 3).map((item) => (
          <Link
            key={item.id}
            to="/menu"
            className="group rounded-xl overflow-hidden border border-brand-border bg-brand-surface hover:border-brand-gold/30 transition-all"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="p-2">
              <p className="text-[11px] font-bold text-white truncate leading-tight">{item.name}</p>
              <p className="text-[12px] font-extrabold text-brand-gold mt-0.5">{'\u20B9'}{item.price}</p>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 3 && (
        <div className="space-y-2 mb-4">
          {items.slice(3, 6).map((item) => (
            <Link
              key={item.id}
              to="/menu"
              className="flex items-center gap-3 rounded-xl bg-brand-surface border border-brand-border p-2.5 hover:border-brand-gold/20 transition-all group"
            >
              <img
                src={item.image_url}
                alt={item.name}
                className="w-11 h-11 rounded-lg object-cover shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate">{item.name}</p>
                <p className="text-[12px] font-semibold text-brand-text-dim">{'\u20B9'}{item.price}</p>
              </div>
              <ArrowRight size={14} className="text-brand-text-dim group-hover:text-brand-gold shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/menu"
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[13px] font-bold hover:bg-brand-gold/15 transition-all"
      >
        View Full Menu
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
