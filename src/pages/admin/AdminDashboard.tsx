import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { isAwaitingCounterPayment, isAwaitingOnlinePayment } from '../../lib/orderLabels';
import type { Order } from '../../types';

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfMonth() {
  const date = startOfToday();
  date.setDate(1);
  return date;
}

function getVisibleOrders(orders: Order[]) {
  return orders.filter((order) => !isAwaitingOnlinePayment(order));
}

function getRevenue(orders: Order[]) {
  return orders
    .filter((order) => order.status !== 'cancelled' && order.status !== 'expired')
    .reduce((sum, order) => sum + Number(order.total), 0);
}

export default function AdminDashboard() {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [weekOrders, setWeekOrders] = useState<Order[]>([]);
  const [monthOrders, setMonthOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadStats = useCallback(async () => {
    const today = startOfToday().toISOString();
    const week = startOfWeek().toISOString();
    const month = startOfMonth().toISOString();

    const [recentRes, todayRes, weekRes, monthRes] = await Promise.all([
      supabase.from('orders').select('*').order('placed_at', { ascending: false }).limit(50),
      supabase.from('orders').select('*').gte('placed_at', today).order('placed_at', { ascending: false }),
      supabase.from('orders').select('*').gte('placed_at', week).order('placed_at', { ascending: false }),
      supabase.from('orders').select('*').gte('placed_at', month).order('placed_at', { ascending: false }),
    ]);

    const firstError = [recentRes.error, todayRes.error, weekRes.error, monthRes.error].find(Boolean);
    if (firstError) {
      showToast(firstError.message || 'Failed to load dashboard stats', 'error');
    }

    setRecentOrders(recentRes.data || []);
    setTodayOrders(todayRes.data || []);
    setWeekOrders(weekRes.data || []);
    setMonthOrders(monthRes.data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const visibleRecentOrders = getVisibleOrders(recentOrders);
  const visibleTodayOrders = getVisibleOrders(todayOrders);
  const visibleWeekOrders = getVisibleOrders(weekOrders);
  const visibleMonthOrders = getVisibleOrders(monthOrders);

  const queueOrders = visibleRecentOrders.filter((order) => order.status === 'pending' && !isAwaitingCounterPayment(order)).length;
  const activeOrders = visibleRecentOrders.filter((order) => !['cancelled', 'expired', 'delivered'].includes(order.status)).length;

  const periodStats = [
    {
      label: 'Today',
      revenue: getRevenue(visibleTodayOrders),
      orders: visibleTodayOrders.length,
      icon: ShoppingBag,
      color: 'bg-blue-500/10 text-blue-400',
    },
    {
      label: 'This Week',
      revenue: getRevenue(visibleWeekOrders),
      orders: visibleWeekOrders.length,
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      label: 'This Month',
      revenue: getRevenue(visibleMonthOrders),
      orders: visibleMonthOrders.length,
      icon: DollarSign,
      color: 'bg-violet-500/10 text-violet-400',
    },
  ];

  const quickStats = [
    { label: 'In Queue', value: queueOrders, icon: Clock, color: 'bg-orange-500/10 text-orange-400' },
    { label: 'Active Orders', value: activeOrders, icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-400' },
  ];

  function getStatusBadge(order: Order) {
    if (isAwaitingCounterPayment(order)) {
      return {
        label: 'awaiting payment',
        className: 'bg-amber-500/10 text-amber-400',
      };
    }

    if (order.status === 'delivered') {
      return {
        label: order.status.replace('_', ' '),
        className: 'bg-green-500/10 text-green-400',
      };
    }

    if (order.status === 'cancelled' || order.status === 'expired') {
      return {
        label: order.status.replace('_', ' '),
        className: 'bg-red-500/10 text-red-400',
      };
    }

    if (order.status === 'pending') {
      return {
        label: order.status.replace('_', ' '),
        className: 'bg-orange-500/10 text-orange-400',
      };
    }

    return {
      label: order.status.replace('_', ' '),
      className: 'bg-blue-500/10 text-blue-400',
    };
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-brand-surface rounded w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-brand-surface rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {periodStats.map((stat) => (
          <div key={stat.label} className="bg-brand-surface rounded-xl p-4 border border-brand-border">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-brand-text-dim">{stat.label}</p>
            <p className="text-2xl font-extrabold text-white mt-2">₹{stat.revenue.toFixed(0)}</p>
            <p className="text-sm text-brand-text-muted mt-1">{stat.orders} order{stat.orders !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {quickStats.map((stat) => (
          <div key={stat.label} className="bg-brand-surface rounded-xl p-4 border border-brand-border">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-2xl font-extrabold text-white">{stat.value}</p>
            <p className="text-xs text-brand-text-dim mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Recent Orders</h2>
        <Link to="/admin/orders" className="text-brand-gold text-sm font-semibold hover:underline">
          View All
        </Link>
      </div>

      {visibleRecentOrders.length === 0 ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-10 text-center text-brand-text-muted">
          No recent orders
        </div>
      ) : (
        <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-bg text-brand-text-dim text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Order ID</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {visibleRecentOrders.slice(0, 10).map((order) => (
                  <tr key={order.id} className="hover:bg-brand-surface-light/70 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">{order.order_id}</td>
                    <td className="px-4 py-3 text-brand-text-muted">{order.customer_name}</td>
                    <td className="px-4 py-3 font-medium text-white">₹{order.total}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusBadge(order).className}`}>
                        {getStatusBadge(order).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-text-dim text-xs">
                      {new Date(order.placed_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
