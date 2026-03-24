import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { isAwaitingCounterPayment, isAwaitingOnlinePayment } from '../../lib/orderLabels';
import type { Order } from '../../types';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('placed_at', today.toISOString())
      .order('placed_at', { ascending: false });

    if (error) {
      showToast(error.message || 'Failed to load dashboard stats', 'error');
    }

    setOrders(data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const visibleOrders = orders.filter((o) => !isAwaitingOnlinePayment(o));
  const todayOrders = visibleOrders.length;
  const pendingOrders = visibleOrders.filter((o) => o.status === 'pending' && !isAwaitingCounterPayment(o)).length;
  const todayRevenue = visibleOrders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'expired')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const confirmedOrders = visibleOrders.filter((o) => o.status !== 'pending' && o.status !== 'cancelled' && o.status !== 'expired').length;

  const stats = [
    { label: "Today's Orders", value: todayOrders, icon: ShoppingBag, color: 'bg-blue-500/10 text-blue-400' },
    { label: "Today's Revenue", value: `₹${todayRevenue.toFixed(0)}`, icon: DollarSign, color: 'bg-green-500/10 text-green-400' },
    { label: 'In Queue', value: pendingOrders, icon: Clock, color: 'bg-orange-500/10 text-orange-400' },
    { label: 'Confirmed', value: confirmedOrders, icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-400' },
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-brand-surface rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
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

      {visibleOrders.length === 0 ? (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-10 text-center text-brand-text-muted">
          No orders today
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
                {visibleOrders.slice(0, 10).map((order) => (
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
