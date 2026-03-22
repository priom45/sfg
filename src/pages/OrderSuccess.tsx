import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Copy, RotateCcw, Store, Truck, ChefHat, Users, Bell, Sparkles, ArrowRight, Star, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clearCheckoutSuccessOrder } from '../lib/checkoutSuccess';
import { supabase } from '../lib/supabase';
import { getPaymentMethodLabel, getReadyOrderLabel, getServiceModeLabel } from '../lib/orderLabels';
import type { Order, MenuItem } from '../types';
import { useToast } from '../components/Toast';
import { playOrderSound, playOrderCompleteSound, playPickupReadyAlert } from '../lib/sounds';
import { useAuth } from '../contexts/AuthContext';
import { staggerContainer, staggerChild } from '../lib/animations';

export default function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [specials, setSpecials] = useState<MenuItem[]>([]);
  const { showToast } = useToast();
  const prevStatusRef = useRef<string | null>(null);
  const pickupAlertPlayedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (orderId) {
      clearCheckoutSuccessOrder(orderId);
    }
  }, [orderId]);

  useEffect(() => {
    playOrderSound();

    let isMounted = true;

    async function loadSpecials() {
      const { data } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('rating', { ascending: false })
        .limit(6);

      if (isMounted && data) {
        setSpecials(data);
      }
    }

    void loadSpecials();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!orderId || !user) {
      setOrder(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const currentUser = user;

    prevStatusRef.current = null;
    pickupAlertPlayedRef.current = false;
    setLoading(true);

    async function loadOrder() {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('order_id', orderId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      setOrder(data ?? null);
      setLoading(false);
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, user]);

  useEffect(() => {
    if (!order) return;

    const currentOrder = order;

    if (prevStatusRef.current && prevStatusRef.current !== currentOrder.status) {
      if (currentOrder.status === 'preparing') {
        showToast('Chef accepted your order!');
      } else if (currentOrder.status === 'packed') {
        playOrderCompleteSound();
        showToast('Your order is ready!');
      } else if (currentOrder.status === 'delivered' && currentOrder.order_type === 'pickup') {
        if (!pickupAlertPlayedRef.current) {
          pickupAlertPlayedRef.current = true;
          playPickupReadyAlert();
        }
      }
    }

    if (currentOrder.status === 'packed' && currentOrder.order_type === 'pickup' && !pickupAlertPlayedRef.current) {
      pickupAlertPlayedRef.current = true;
      playPickupReadyAlert();
    }

    prevStatusRef.current = currentOrder.status;

    const channel = supabase
      .channel(`order-${currentOrder.order_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `order_id=eq.${currentOrder.order_id}` }, (payload) => {
        setOrder(payload.new as Order);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order, showToast]);

  function copyOrderId() {
    if (order) {
      navigator.clipboard.writeText(order.order_id);
      showToast('Order ID copied!');
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-brand-bg">
        <div className="animate-pulse text-center">
          <div className="w-20 h-20 bg-brand-surface-light rounded-full mx-auto mb-6" />
          <div className="h-6 bg-brand-surface-light rounded-2xl w-44 mx-auto mb-3" />
          <div className="h-4 bg-brand-surface-light rounded-2xl w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center section-padding text-center bg-brand-bg">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Order Not Found</h2>
        <p className="text-brand-text-muted text-[14px] mb-6">We couldn't find an order with that ID</p>
        <Link to="/menu" className="btn-primary">Browse Menu</Link>
      </div>
    );
  }

  const isExpired = order.status === 'expired';
  const isPending = order.status === 'pending';
  const isPickup = order.order_type === 'pickup';
  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'packed';
  const isDelivered = order.status === 'delivered';
  const isConfirmed = order.status !== 'pending' && order.status !== 'expired' && order.status !== 'cancelled';
  const showSpecials = isDelivered || isReady;
  const serviceModeLabel = getServiceModeLabel(order);
  const readyOrderLabel = getReadyOrderLabel(order);

  return (
    <div className="min-h-[60vh] flex items-center justify-center section-padding py-12 bg-brand-bg">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full text-center"
      >

        <AnimatePresence mode="wait">
        {isReady && (
          <motion.div key="ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <PickupReadyBanner order={order} />
          </motion.div>
        )}

        {isPreparing && (
          <motion.div key="preparing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <ChefHat size={40} className="text-amber-400 animate-pulse" />
            </motion.div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">Your Order is Being Prepared!</h1>
            <p className="text-brand-text-muted mb-8">
              Our chef is making your order fresh. {order.estimated_minutes ? `Please wait about ${order.estimated_minutes} minutes.` : ''}
            </p>
          </motion.div>
        )}

        {isPending && (
          <motion.div key="pending" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Users size={40} className="text-orange-400" />
            </motion.div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">Order Placed!</h1>
            <p className="text-brand-text-muted mb-8">Your order is in queue. Waiting for chef to accept.</p>
          </motion.div>
        )}

        {isDelivered && (
          <motion.div key="delivered" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <EnjoyFoodCelebration isPickup={isPickup} />
          </motion.div>
        )}

        {isConfirmed && !isPreparing && !isReady && !isDelivered && (
          <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle size={40} className="text-emerald-400" />
            </motion.div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">Order Confirmed!</h1>
            <p className="text-brand-text-muted mb-8">
              {isPickup
                ? 'Your waffles are being prepared. We will notify you when ready.'
                : 'Your waffles are being prepared and will be delivered soon.'}
            </p>
          </motion.div>
        )}

        {isExpired && (
          <motion.div key="expired" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Clock size={40} className="text-orange-400" />
            </motion.div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">Order Expired</h1>
            <p className="text-brand-text-muted mb-8">The restaurant could not confirm in time</p>
          </motion.div>
        )}
        </AnimatePresence>

        <div className="rounded-2xl border p-6 mb-6 animate-scale-in bg-brand-surface border-brand-border">
          {isPickup && !isExpired && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Store size={16} className="text-brand-gold" />
              <span className="text-[14px] font-bold text-brand-gold uppercase tracking-wider">{serviceModeLabel} Order</span>
            </div>
          )}

          {!isPickup && !isExpired && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Truck size={16} className="text-sky-400" />
              <span className="text-[14px] font-bold text-sky-400 uppercase tracking-wider">Delivery Order</span>
            </div>
          )}

          <p className="text-[12px] font-semibold text-brand-text-dim uppercase tracking-wider mb-2">
            {isPickup ? 'Show this at the counter' : 'Order ID'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className={`font-black tracking-wider tabular-nums ${
              isPickup ? 'text-4xl text-brand-gold' : 'text-3xl text-white'
            }`}>
              {order.order_id}
            </span>
            <button onClick={copyOrderId} className="p-2 hover:bg-brand-surface-light/70 rounded-xl transition-colors text-brand-text-dim hover:text-brand-text-muted">
              <Copy size={18} strokeWidth={2.2} />
            </button>
          </div>

          {isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 bg-orange-500/10 rounded-2xl px-4 py-3 border border-orange-500/20">
              <Users size={16} className="text-orange-400" />
              <span className="text-[14px] font-bold text-orange-400">Your order is placed successfully.</span>
            </div>
          )}

          {isPreparing && order.estimated_minutes && (
            <div className="mt-4 flex items-center justify-center gap-2 bg-amber-500/10 rounded-2xl px-4 py-3 border border-amber-500/20">
              <ChefHat size={16} className="text-amber-400" />
              <span className="text-[14px] font-bold tabular-nums text-amber-400">
                Preparing - ~{order.estimated_minutes} min
              </span>
            </div>
          )}

          {isReady && (
            <div className="mt-4 bg-emerald-500/10 rounded-2xl px-4 py-3 border border-emerald-500/20 animate-pulse">
              <p className="text-[14px] text-emerald-400 font-bold flex items-center justify-center gap-2">
                <Bell size={16} />
                Your order is complete! {readyOrderLabel}
              </p>
            </div>
          )}

          {isPending && (
            <div className="mt-4 bg-orange-500/5 rounded-2xl px-4 py-3">
              <p className="text-[14px] text-brand-text-muted font-semibold">
                Please wait in queue. Your order will be prepared soon. Thanks for your patience.
              </p>
            </div>
          )}

          {isPreparing && (
            <div className="mt-4 bg-amber-500/5 rounded-2xl px-4 py-3">
              <p className="text-[14px] text-brand-text-muted font-semibold">
                Sit back and relax! Your food is being freshly prepared.
              </p>
            </div>
          )}

          {!isPickup && isConfirmed && !isPreparing && !isReady && !isDelivered && (
            <div className="mt-4 bg-sky-500/10 rounded-2xl px-4 py-3 border border-sky-500/20">
              <p className="text-[14px] text-sky-400 font-semibold">
                {order.status === 'out_for_delivery'
                  ? 'Our delivery partner is on the way with your waffles!'
                  : 'Your order is being prepared and will be delivered soon.'}
              </p>
            </div>
          )}

          {order.payment_method === 'cod' && order.payment_status !== 'paid' && !isDelivered && !isExpired && (
            <PaymentInstructionCard order={order} isPickup={isPickup} />
          )}

          <div className="mt-6 pt-4 border-t border-brand-border text-[14px] text-brand-text-muted">
            <div className="flex justify-between mb-1">
              <span>Total</span>
              <span className="font-bold text-brand-gold tabular-nums">{'\u20B9'}{order.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Service</span>
              <span className="capitalize text-white">{serviceModeLabel}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Payment</span>
              <span className="capitalize text-white">
                {getPaymentMethodLabel(order)}
              </span>
            </div>
          </div>

          {order.customer_email && (
            <div className="mt-4 rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-text-dim">
                Order Emails
              </p>
              <p className="mt-1 text-[12px] text-brand-text-dim">
                Payment receipt and order updates will be sent here
              </p>
              <p className="mt-1 break-all text-[14px] font-semibold text-white">
                {order.customer_email}
              </p>
            </div>
          )}
        </div>

        {showSpecials && specials.length > 0 && (
          <SpecialsSuggestions items={specials} onViewMenu={() => navigate('/menu')} />
        )}

        <div className="flex flex-col gap-3">
          {(isConfirmed || isPending) && !isDelivered && (
            <Link to={`/track/${order.order_id}`} className="btn-primary w-full text-center">
              Track Order
            </Link>
          )}
          {isExpired && (
            <Link to="/menu" className="btn-primary w-full text-center flex items-center justify-center gap-2">
              <RotateCcw size={18} strokeWidth={2.2} />
              Order Again
            </Link>
          )}
          <Link to="/menu" className="btn-outline w-full text-center">
            {isDelivered ? 'Order More' : 'Back to Menu'}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function PickupReadyBanner({ order }: { order: Order }) {
  const [pulse, setPulse] = useState(true);
  const readyOrderLabel = getReadyOrderLabel(order);
  const serviceModeLabel = getServiceModeLabel(order);

  useEffect(() => {
    const timer = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-3xl mb-8 transition-all duration-500 ${
      pulse ? 'ring-4 ring-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : ''
    }`}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.15),transparent)]" />
      <div className="relative px-6 py-8">
        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand-surface-strong/80 backdrop-blur-sm ${
          pulse ? 'animate-bounce' : ''
        }`}>
          <Bell size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
          {readyOrderLabel}!
        </h1>
        <p className="text-emerald-100 text-[15px] font-medium mb-4">
          Show this order ID <span className="font-black">{order.order_id}</span> at the counter for your {serviceModeLabel.toLowerCase()} order
        </p>
        <div className="inline-flex items-center gap-2 bg-brand-surface-strong/80 backdrop-blur-sm rounded-full px-5 py-2.5 text-white text-[13px] font-bold">
          <Sparkles size={14} />
          Freshly made and ready now
        </div>
      </div>
    </div>
  );
}

function EnjoyFoodCelebration({ isPickup }: { isPickup: boolean }) {
  const [showParticles, setShowParticles] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowParticles(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative mb-8">
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                backgroundColor: ['#FFD700', '#FF6B35', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'][i % 6],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <div className="w-24 h-24 bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border-2 border-brand-gold/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
          <CheckCircle size={48} className="text-brand-gold" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white mb-3">
          {isPickup ? 'Enjoy Your Food!' : 'Order Delivered!'}
        </h1>
        <p className="text-brand-text-muted text-[15px] mb-2">
          {isPickup
            ? 'Thank you for dining with us. We hope you love every bite!'
            : 'Your waffles have arrived. Enjoy every bite!'}
        </p>
        <div className="inline-flex items-center gap-2 mt-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-5 py-2 text-brand-gold text-[13px] font-bold">
          <Star size={14} fill="currentColor" />
          We'd love to see you again soon!
        </div>
      </div>
    </div>
  );
}

function SpecialsSuggestions({ items, onViewMenu }: { items: MenuItem[]; onViewMenu: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-brand-gold/15 bg-gradient-to-b from-brand-gold/[0.04] to-transparent p-5 mb-6 text-left"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-brand-gold/10 rounded-lg flex items-center justify-center">
          <Sparkles size={16} className="text-brand-gold" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-white">Today's Top Picks</h3>
          <p className="text-[12px] text-brand-text-dim font-medium">Craving more? Try these favorites</p>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-3 gap-2.5 mb-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {items.slice(0, 3).map((item) => (
          <motion.div key={item.id} variants={staggerChild}>
            <Link
              to="/menu"
              className="group rounded-xl overflow-hidden border border-brand-border bg-brand-surface hover:border-brand-gold/30 transition-all block"
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
          </motion.div>
        ))}
      </motion.div>

      {items.length > 3 && (
        <div className="grid grid-cols-1 gap-2 mb-4">
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

      <button
        onClick={onViewMenu}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[13px] font-bold hover:bg-brand-gold/15 transition-all"
      >
        View Full Menu
        <ArrowRight size={14} />
      </button>
    </motion.div>
  );
}

function PaymentInstructionCard({ order, isPickup }: { order: Order; isPickup: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border-2 border-brand-gold/30 bg-brand-gold/[0.04] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-brand-gold/15 rounded-lg flex items-center justify-center">
          <Wallet size={16} className="text-brand-gold" />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-white">
            {isPickup ? 'Pay at Counter' : 'Cash on Delivery'}
          </h4>
          <p className="text-[11px] text-brand-text-dim">
            {isPickup ? 'Show this order ID and pay at the counter' : 'Pay the delivery partner when your order arrives'}
          </p>
        </div>
      </div>
      <div className="bg-brand-bg/60 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] text-brand-text-muted font-medium">Amount to Pay</span>
        <span className="text-2xl font-black text-brand-gold tabular-nums">{'\u20B9'}{order.total}</span>
      </div>
      <p className="text-[11px] text-brand-text-dim mt-2.5 text-center">
        {isPickup ? 'Cash or UPI accepted at the counter' : 'Please keep exact change ready'}
      </p>
    </div>
  );
}
