import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, Clock, TrendingUp, CalendarDays, Wallet, Landmark } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { isAwaitingCounterPayment, isAwaitingOnlinePayment } from '../../lib/orderLabels';
import type { Order } from '../../types';

type CollectionSummary = {
  cash: number;
  online: number;
  total: number;
  orders: number;
};

const DAILY_BREAKDOWN_DAYS = 14;

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfToday() {
  return startOfDay(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date = new Date()) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date = new Date()) {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

function toLocalDateKey(value: string | Date) {
  return formatDateInputValue(typeof value === 'string' ? new Date(value) : value);
}

function getVisibleOrders(orders: Order[]) {
  return orders.filter((order) => !isAwaitingOnlinePayment(order));
}

function isRevenueOrder(order: Order) {
  return order.status !== 'cancelled' && order.status !== 'expired';
}

function getRevenue(orders: Order[]) {
  return orders
    .filter(isRevenueOrder)
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
}

function isCollectedOrder(order: Order) {
  return isRevenueOrder(order) && order.payment_status === 'paid';
}

function getPaymentChannel(order: Order): 'cash' | 'online' | null {
  if (!isCollectedOrder(order) || Number(order.total || 0) <= 0) {
    return null;
  }

  if (order.counter_payment_method === 'cash' || order.counter_payment_method === 'online') {
    return order.counter_payment_method;
  }

  if (order.payment_provider === 'razorpay') {
    return 'online';
  }

  if (order.payment_method === 'cod') {
    return 'cash';
  }

  if (order.payment_method === 'upi' || order.payment_method === 'card') {
    return 'online';
  }

  return null;
}

function summarizeCollections(orders: Order[]): CollectionSummary {
  return orders.reduce<CollectionSummary>((summary, order) => {
    if (!isCollectedOrder(order)) {
      return summary;
    }

    const amount = Number(order.total || 0);
    if (!Number.isFinite(amount)) {
      return summary;
    }

    const channel = getPaymentChannel(order);

    return {
      cash: summary.cash + (channel === 'cash' ? amount : 0),
      online: summary.online + (channel === 'online' ? amount : 0),
      total: summary.total + amount,
      orders: summary.orders + 1,
    };
  }, {
    cash: 0,
    online: 0,
    total: 0,
    orders: 0,
  });
}

function summarizeOrderCollection(order: Order) {
  return summarizeCollections([order]);
}

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(0)}`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  }).format(parseDateInputValue(value));
}

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => formatDateInputValue(new Date()));
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [weekOrders, setWeekOrders] = useState<Order[]>([]);
  const [monthOrders, setMonthOrders] = useState<Order[]>([]);
  const [selectedDayOrders, setSelectedDayOrders] = useState<Order[]>([]);
  const [dailyBreakdownOrders, setDailyBreakdownOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadStats = useCallback(async () => {
    setLoading(true);

    const todayStart = startOfToday();
    const weekStart = startOfWeek(todayStart);
    const monthStart = startOfMonth(todayStart);
    const selectedDayStart = startOfDay(parseDateInputValue(selectedDate));
    const selectedDayEnd = addDays(selectedDayStart, 1);
    const breakdownStart = addDays(todayStart, -(DAILY_BREAKDOWN_DAYS - 1));

    const [recentRes, todayRes, weekRes, monthRes, selectedDayRes, breakdownRes] = await Promise.all([
      supabase.from('orders').select('*').order('placed_at', { ascending: false }).limit(50),
      supabase.from('orders').select('*').gte('placed_at', todayStart.toISOString()).order('placed_at', { ascending: false }),
      supabase.from('orders').select('*').gte('placed_at', weekStart.toISOString()).order('placed_at', { ascending: false }),
      supabase.from('orders').select('*').gte('placed_at', monthStart.toISOString()).order('placed_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*')
        .gte('placed_at', selectedDayStart.toISOString())
        .lt('placed_at', selectedDayEnd.toISOString())
        .order('placed_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*')
        .gte('placed_at', breakdownStart.toISOString())
        .order('placed_at', { ascending: false }),
    ]);

    const firstError = [
      recentRes.error,
      todayRes.error,
      weekRes.error,
      monthRes.error,
      selectedDayRes.error,
      breakdownRes.error,
    ].find(Boolean);

    if (firstError) {
      showToast(firstError.message || 'Failed to load dashboard stats', 'error');
    }

    setRecentOrders(recentRes.data || []);
    setTodayOrders(todayRes.data || []);
    setWeekOrders(weekRes.data || []);
    setMonthOrders(monthRes.data || []);
    setSelectedDayOrders(selectedDayRes.data || []);
    setDailyBreakdownOrders(breakdownRes.data || []);
    setLoading(false);
  }, [selectedDate, showToast]);

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

  const collectionRows = [
    {
      label: 'Selected Day',
      sublabel: formatDateLabel(selectedDate),
      summary: summarizeCollections(selectedDayOrders),
      icon: CalendarDays,
      color: 'bg-sky-500/10 text-sky-400',
    },
    {
      label: 'Today',
      sublabel: formatDateLabel(formatDateInputValue(new Date())),
      summary: summarizeCollections(todayOrders),
      icon: Wallet,
      color: 'bg-orange-500/10 text-orange-400',
    },
    {
      label: 'This Week',
      sublabel: `${formatDateLabel(formatDateInputValue(startOfWeek()))} onwards`,
      summary: summarizeCollections(weekOrders),
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      label: 'This Month',
      sublabel: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date()),
      summary: summarizeCollections(monthOrders),
      icon: Landmark,
      color: 'bg-violet-500/10 text-violet-400',
    },
  ];

  const breakdownSummaries = dailyBreakdownOrders.reduce<Record<string, CollectionSummary>>((summaryMap, order) => {
    const key = toLocalDateKey(order.placed_at);
    const nextSummary = summarizeOrderCollection(order);
    const current = summaryMap[key] || { cash: 0, online: 0, total: 0, orders: 0 };

    summaryMap[key] = {
      cash: current.cash + nextSummary.cash,
      online: current.online + nextSummary.online,
      total: current.total + nextSummary.total,
      orders: current.orders + nextSummary.orders,
    };

    return summaryMap;
  }, {});

  const dailyBreakdownRows = Array.from({ length: DAILY_BREAKDOWN_DAYS }, (_, index) => {
    const date = addDays(startOfToday(), -index);
    const key = formatDateInputValue(date);
    return {
      key,
      label: formatDateLabel(key),
      summary: breakdownSummaries[key] || { cash: 0, online: 0, total: 0, orders: 0 },
      isSelected: key === selectedDate,
    };
  });

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
        <div className="h-64 bg-brand-surface rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
        <button onClick={loadStats} className="text-sm text-brand-gold font-semibold hover:underline">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {periodStats.map((stat) => (
          <div key={stat.label} className="bg-brand-surface rounded-xl p-4 border border-brand-border">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-brand-text-dim">{stat.label}</p>
            <p className="text-2xl font-extrabold text-white mt-2">{formatCurrency(stat.revenue)}</p>
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

      <div className="bg-brand-surface rounded-xl border border-brand-border p-4 lg:p-5 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Collections Report</h2>
            <p className="text-sm text-brand-text-muted mt-1">
              Cash and online collections are shown separately for the selected day, current week, and current month.
            </p>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-brand-text-dim">Check date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 w-full lg:w-52 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-white outline-none transition-colors focus:border-brand-gold"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs uppercase tracking-wider text-brand-text-dim">
              <tr className="border-b border-brand-border">
                <th className="px-3 py-3 text-left font-medium">Period</th>
                <th className="px-3 py-3 text-right font-medium">Cash</th>
                <th className="px-3 py-3 text-right font-medium">Online</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 text-right font-medium">Paid Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {collectionRows.map((row) => (
                <tr key={row.label} className="hover:bg-brand-surface-light/60 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${row.color}`}>
                        <row.icon size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{row.label}</p>
                        <p className="text-xs text-brand-text-dim">{row.sublabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-400">{formatCurrency(row.summary.cash)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-sky-400">{formatCurrency(row.summary.online)}</td>
                  <td className="px-3 py-3 text-right font-bold text-white">{formatCurrency(row.summary.total)}</td>
                  <td className="px-3 py-3 text-right text-brand-text-muted">{row.summary.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Last {DAILY_BREAKDOWN_DAYS} Days</h3>
            <p className="text-xs text-brand-text-dim">Select any date above to compare it quickly.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs uppercase tracking-wider text-brand-text-dim">
                <tr className="border-b border-brand-border">
                  <th className="px-3 py-3 text-left font-medium">Date</th>
                  <th className="px-3 py-3 text-right font-medium">Cash</th>
                  <th className="px-3 py-3 text-right font-medium">Online</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-3 py-3 text-right font-medium">Paid Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {dailyBreakdownRows.map((row) => (
                  <tr
                    key={row.key}
                    className={`transition-colors ${row.isSelected ? 'bg-brand-gold/10' : 'hover:bg-brand-surface-light/60'}`}
                  >
                    <td className="px-3 py-3">
                      <p className={`font-medium ${row.isSelected ? 'text-brand-gold' : 'text-white'}`}>{row.label}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-emerald-400">{formatCurrency(row.summary.cash)}</td>
                    <td className="px-3 py-3 text-right font-medium text-sky-400">{formatCurrency(row.summary.online)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-white">{formatCurrency(row.summary.total)}</td>
                    <td className="px-3 py-3 text-right text-brand-text-muted">{row.summary.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
