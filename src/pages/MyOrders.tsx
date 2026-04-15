import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle, ChefHat, ChevronRight, Clock, Copy, Gift, MessageSquare, Package, Star, Truck, User, Wallet, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { submitItemReview } from '../lib/itemReviews';
import { getReadyOrderLabel, getServiceModeLabel, isAwaitingCounterPayment, isAwaitingOnlinePayment } from '../lib/orderLabels';
import type { ItemReview, Order, OrderItem, ReviewRewardCoupon } from '../types';

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

type ReviewSubmissionResult = {
  review: ItemReview;
  rewardCoupon: ReviewRewardCoupon;
};

export default function MyOrders() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [reviewsByOrderItemId, setReviewsByOrderItemId] = useState<Record<string, ItemReview>>({});
  const [rewardCouponsByReviewId, setRewardCouponsByReviewId] = useState<Record<string, ReviewRewardCoupon>>({});
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setOrderItemsByOrderId({});
      setReviewsByOrderItemId({});
      setRewardCouponsByReviewId({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false });

    if (ordersError) {
      console.error('Failed to load customer orders', ordersError);
      setOrders([]);
      setOrderItemsByOrderId({});
      setReviewsByOrderItemId({});
      setRewardCouponsByReviewId({});
      setLoading(false);
      return;
    }

    const nextOrders = (ordersData || []) as Order[];
    setOrders(nextOrders);

    const deliveredOrderIds = nextOrders
      .filter((order) => order.status === 'delivered')
      .map((order) => order.id);

    if (deliveredOrderIds.length === 0) {
      setOrderItemsByOrderId({});
      setReviewsByOrderItemId({});
      setRewardCouponsByReviewId({});
      setLoading(false);
      return;
    }

    const [orderItemsResult, reviewsResult, rewardCouponsResult] = await Promise.all([
      supabase
        .from('order_items')
        .select('*')
        .in('order_id', deliveredOrderIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('item_reviews')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('review_reward_coupons')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (orderItemsResult.error) {
      console.error('Failed to load delivered order items', orderItemsResult.error);
    }

    if (reviewsResult.error) {
      console.error('Failed to load item reviews', reviewsResult.error);
    }

    if (rewardCouponsResult.error) {
      console.error('Failed to load review reward coupons', rewardCouponsResult.error);
    }

    const nextOrderItemsByOrderId = ((orderItemsResult.data || []) as OrderItem[]).reduce<Record<string, OrderItem[]>>((acc, item) => {
      if (!acc[item.order_id]) {
        acc[item.order_id] = [];
      }

      acc[item.order_id].push(item);
      return acc;
    }, {});

    const nextReviewsByOrderItemId = ((reviewsResult.data || []) as ItemReview[]).reduce<Record<string, ItemReview>>((acc, review) => {
      acc[review.order_item_id] = review;
      return acc;
    }, {});

    const nextRewardCouponsByReviewId = ((rewardCouponsResult.data || []) as ReviewRewardCoupon[]).reduce<Record<string, ReviewRewardCoupon>>((acc, rewardCoupon) => {
      acc[rewardCoupon.item_review_id] = rewardCoupon;
      return acc;
    }, {});

    setOrderItemsByOrderId(nextOrderItemsByOrderId);
    setReviewsByOrderItemId(nextReviewsByOrderItemId);
    setRewardCouponsByReviewId(nextRewardCouponsByReviewId);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUserId = user.id;
    const channel = supabase
      .channel('my-orders-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${currentUserId}` }, () => {
        void loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders, user]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled', 'expired'].includes(order.status)),
    [orders],
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => ['delivered', 'cancelled', 'expired'].includes(order.status)),
    [orders],
  );

  function handleReviewSubmitted(result: ReviewSubmissionResult) {
    setReviewsByOrderItemId((prev) => ({
      ...prev,
      [result.review.order_item_id]: result.review,
    }));
    setRewardCouponsByReviewId((prev) => ({
      ...prev,
      [result.review.id]: result.rewardCoupon,
    }));
  }

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

        {orders.length === 0 ? (
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
                    <PastOrderCard
                      key={order.id}
                      order={order}
                      orderItems={orderItemsByOrderId[order.id] || []}
                      reviewsByOrderItemId={reviewsByOrderItemId}
                      rewardCouponsByReviewId={rewardCouponsByReviewId}
                      onReviewSubmitted={handleReviewSubmitted}
                      showToast={showToast}
                    />
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
  const isOnlinePaymentPending = isAwaitingOnlinePayment(order);
  const isCounterPaymentPending = isAwaitingCounterPayment(order);
  const config = isOnlinePaymentPending
    ? { color: 'text-sky-400', bg: 'bg-sky-500/10', icon: Clock, label: 'Payment Processing' }
    : isCounterPaymentPending
      ? { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Wallet, label: 'Payment Pending' }
      : order.status === 'packed' && order.order_type === 'delivery'
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
            {isOnlinePaymentPending && (
              <p className="text-[11px] text-sky-400 mt-1">
                We are verifying your online payment
              </p>
            )}
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

function PastOrderCard({
  order,
  orderItems,
  reviewsByOrderItemId,
  rewardCouponsByReviewId,
  onReviewSubmitted,
  showToast,
}: {
  order: Order;
  orderItems: OrderItem[];
  reviewsByOrderItemId: Record<string, ItemReview>;
  rewardCouponsByReviewId: Record<string, ReviewRewardCoupon>;
  onReviewSubmitted: (result: ReviewSubmissionResult) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [showReviews, setShowReviews] = useState(false);
  const config = statusConfig[order.status] || statusConfig.pending;
  const pendingReviewCount = orderItems.filter((item) => !reviewsByOrderItemId[item.id]).length;
  const canReviewItems = order.status === 'delivered' && orderItems.length > 0;

  return (
    <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
      <Link
        to={`/track/${order.order_id}`}
        className="flex items-center justify-between px-3.5 py-3 transition-all active:scale-[0.98]"
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

      {canReviewItems && (
        <div className="border-t border-brand-border px-3.5 py-3">
          <button
            onClick={() => setShowReviews((prev) => !prev)}
            className="w-full rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-emerald-300">
                  {pendingReviewCount > 0
                    ? `Review ${pendingReviewCount} item${pendingReviewCount > 1 ? 's' : ''} and get 10% off`
                    : 'View your item reviews'}
                </p>
                <p className="text-[11px] text-emerald-200 mt-1">
                  Give a star rating and comment for each ordered item
                </p>
              </div>
              <Gift size={16} className="text-emerald-300 flex-shrink-0" />
            </div>
          </button>

          {showReviews && (
            <div className="mt-3 space-y-3">
              {orderItems.map((orderItem) => {
                const existingReview = reviewsByOrderItemId[orderItem.id] || null;
                const rewardCoupon = existingReview ? rewardCouponsByReviewId[existingReview.id] || null : null;

                return (
                  <OrderItemReviewCard
                    key={orderItem.id}
                    orderItem={orderItem}
                    existingReview={existingReview}
                    rewardCoupon={rewardCoupon}
                    onReviewSubmitted={onReviewSubmitted}
                    showToast={showToast}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderItemReviewCard({
  orderItem,
  existingReview,
  rewardCoupon,
  onReviewSubmitted,
  showToast,
}: {
  orderItem: OrderItem;
  existingReview: ItemReview | null;
  rewardCoupon: ReviewRewardCoupon | null;
  onReviewSubmitted: (result: ReviewSubmissionResult) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const effectiveRating = existingReview?.rating || rating;
  const rewardStatusText = rewardCoupon?.is_redeemed
    ? 'Reward used'
    : 'Use this on your next order';

  async function handleSubmit() {
    if (existingReview || submitting) {
      return;
    }

    if (rating < 1) {
      showToast('Please choose a star rating', 'error');
      return;
    }

    if (!comment.trim()) {
      showToast('Please add a short comment', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitItemReview({
        orderItemId: orderItem.id,
        rating,
        comment: comment.trim(),
      });

      onReviewSubmitted(result);
      showToast(`Review saved. ${result.rewardCoupon.code} unlocked.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit review';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function copyRewardCode() {
    if (!rewardCoupon) {
      return;
    }

    navigator.clipboard.writeText(rewardCoupon.code);
    showToast('Reward code copied');
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white text-[14px]">
            {orderItem.item_name}
            {orderItem.quantity > 1 ? ` x${orderItem.quantity}` : ''}
          </p>
          <p className="text-[11px] text-brand-text-dim mt-1">
            {orderItem.customizations.length > 0
              ? orderItem.customizations.map((customization) => customization.option_name).join(', ')
              : 'Ordered item'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-brand-gold flex-shrink-0">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={!!existingReview}
              onClick={() => setRating(star)}
              className={existingReview ? 'cursor-default' : 'cursor-pointer'}
            >
              <Star
                size={15}
                className={star <= effectiveRating ? 'fill-current text-brand-gold' : 'text-brand-border'}
              />
            </button>
          ))}
        </div>
      </div>

      {existingReview ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-brand-surface px-3 py-2">
            <div className="flex items-center gap-2 text-brand-text-muted text-[11px]">
              <MessageSquare size={12} />
              <span>Your comment</span>
            </div>
            <p className="mt-1 text-[13px] text-white">{existingReview.comment}</p>
          </div>

          {rewardCoupon && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-emerald-300">10% off unlocked</p>
                  <p className="text-[13px] font-bold text-emerald-200 mt-1">{rewardCoupon.code}</p>
                  <p className="text-[11px] text-emerald-200 mt-1">{rewardStatusText}</p>
                </div>
                <button
                  onClick={copyRewardCode}
                  className="rounded-lg border border-emerald-400/30 px-2.5 py-2 text-emerald-200"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Tell us what you liked or what should improve"
            className="input-field min-h-[88px] text-[13px] resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary mt-3 w-full py-2.5 text-[13px] font-semibold rounded-lg disabled:opacity-60"
          >
            {submitting ? 'Submitting Review...' : 'Submit Review and Get 10% Off'}
          </button>
        </div>
      )}
    </div>
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
