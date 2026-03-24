import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChefHat, Truck, CheckCircle, XCircle, Clock, Bell, ChevronRight, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getReadyOrderLabel, getServiceModeLabel, isAwaitingOnlinePayment } from '../lib/orderLabels';
import type { Order } from '../types';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'text-orange-400', bg: 'bg-orange-500/10', icon: Clock, label: 'In Queue' },
  confirmed: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle, label: 'Confirmed' },
  preparing: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: ChefHat, label: 'Preparing' },
  packed: { color: 'text-teal-400', bg: 'bg-teal-500/10', icon: Package, label: 'Ready' },
  out_for_delivery: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Truck, label: 'On the way' },
  delivered: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'Cancelled' },
  expired: { color: 'text-brand-text-dim', bg: 'bg-brand-surface-light', icon: Clock, label: 'Expired' },
};

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const currentUser = user;
    setLoading(true);

    async function loadOrders() {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('placed_at', { ascending: false });

      setOrders(data || []);
      setLoading(false);
    }

    void loadOrders();

    const channel = supabase
      .channel('my-orders-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === (payload.new as Order).id ? (payload.new as Order) : o))
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const visibleOrders = orders.filter((o) => !isAwaitingOnlinePayment(o));
  const activeOrders = visibleOrders.filter((o) => !['delivered', 'cancelled', 'expired'].includes(o.status));
  const pastOrders = visibleOrders.filter((o) => ['delivered', 'cancelled', 'expired'].includes(o.status));

  if (loading) {
    return (
      <div className="min-h-[60vh] max-w-lg mx-auto px-4 py-8 bg-brand-bg">
        <div className="animate-pulse space-y-3">
          <div className="h-7 bg-brand-surface-light rounded-lg w-32 mb-6" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-brand-surface-light rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-brand-bg">
        <div className="w-20 h-20 bg-brand-surface rounded-full flex items-center justify-center mb-5">
          <User size={32} className="text-brand-text-dim" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1.5">Sign in to view your orders</h2>
        <p className="text-brand-text-muted text-[14px] mb-6 text-center">Track active orders and review past purchases</p>
        <Link to="/auth" className="btn-primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24 animate-fade-in">
        <h1 className="text-xl font-extrabold text-white mb-5">Orders</h1>

        {visibleOrders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-brand-surface rounded-full flex items-center justify-center mx-auto mb-5">
              <Package size={32} className="text-brand-text-dim" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1.5">No orders yet</h2>
            <p className="text-brand-text-muted text-[14px] mb-6">Your order history will appear here</p>
            <Link to="/menu" className="btn-primary">Order Now</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {activeOrders.length > 0 && (
              <section>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-brand-text-dim mb-3">Active</h2>
                <div className="space-y-2">
                  {activeOrders.map((order) => (
                    <ActiveOrderCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}

            {pastOrders.length > 0 && (
              <section>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-brand-text-dim mb-3">Past</h2>
                <div className="space-y-2">
                  {pastOrders.map((order) => (
                    <PastOrderCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveOrderCard({ order }: { order: Order }) {
  const isReady = order.status === 'packed' && order.order_type === 'pickup';
  const config = order.status === 'packed' && order.order_type === 'delivery'
    ? { color: 'text-sky-400', bg: 'bg-sky-500/10', icon: Package, label: 'Packed' }
    : statusConfig[order.status] || statusConfig.pending;
  const Icon = config.icon;
  const readyLabel = getReadyOrderLabel(order);

  return (
    <Link
      to={`/track/${order.order_id}`}
      className={`block rounded-xl p-3.5 transition-all active:scale-[0.98] ${
        isReady
          ? 'bg-brand-gold/[0.06] border-2 border-brand-gold/40'
          : 'bg-brand-surface border border-brand-border'
      }`}
    >
      {isReady && (
        <div className="flex items-center gap-2 mb-2.5">
          <Bell size={14} className="text-brand-gold animate-pulse" />
          <span className="text-[13px] font-bold text-brand-gold">{readyLabel}!</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
            <Icon size={16} className={config.color} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-[15px] text-white">{order.order_id}</span>
              <span className={`text-[11px] font-bold ${config.color}`}>{config.label}</span>
            </div>
            <p className="text-[11px] text-brand-text-dim mt-0.5">
              {formatOrderDate(order.placed_at)} • {getServiceModeLabel(order)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-bold text-brand-gold tabular-nums">{'\u20B9'}{order.total}</span>
          <ChevronRight size={16} className="text-brand-text-dim" />
        </div>
      </div>
    </Link>
  );
}

function PastOrderCard({ order }: { order: Order }) {
  const config = statusConfig[order.status] || statusConfig.pending;

  return (
    <Link
      to={`/track/${order.order_id}`}
      className="flex items-center justify-between bg-brand-surface rounded-xl px-3.5 py-3 border border-brand-border transition-all active:scale-[0.98]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[14px] text-white">{order.order_id}</span>
          <span className={`text-[11px] font-semibold ${config.color}`}>{config.label}</span>
        </div>
        <p className="text-[11px] text-brand-text-dim mt-0.5">
          {formatOrderDate(order.placed_at)} • {getServiceModeLabel(order)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-bold text-brand-text-muted tabular-nums text-[14px]">{'\u20B9'}{order.total}</span>
        <ChevronRight size={14} className="text-brand-text-dim" />
      </div>
    </Link>
  );
}

function formatOrderDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + `, ${time}`;
}
