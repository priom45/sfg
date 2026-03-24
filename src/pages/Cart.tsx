import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Tag, User, Pencil, Store, Wallet, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useSiteSettings } from '../hooks/useSiteSettings';
import {
  getBestAutomaticOffer,
  getCartAddOnTotal,
  getOfferCode,
  getOfferDiscountAmount,
  getOfferEligibilityError,
  getOfferMode,
  getOfferRuleSummary,
} from '../lib/offers';
import { customerSupabase } from '../lib/supabase';
import { readCheckoutSuccessOrder, storeCheckoutSuccessOrder } from '../lib/checkoutSuccess';
import { getServiceModeLabel } from '../lib/orderLabels';
import { createCounterOrder } from '../lib/counterOrder';
import type { MenuItem, PaymentMethod, Offer, PickupOption, SelectedCustomization } from '../types';
import { useToast } from '../components/Toast';
import { RAZORPAY_BRAND_IMAGE, cancelRazorpayPayment, createRazorpayOrder, loadRazorpayScript, verifyRazorpayPayment } from '../lib/razorpay';
import { playOrderSound } from '../lib/sounds';
import CustomizationModal from '../components/CustomizationModal';

const SESSION_KEYWORDS = ['session expired', 'sign in again', 'please sign in'];
const TAKEAWAY_CHARGE = 10;

export default function CartPage() {
  const { items, subtotal, itemCount, removeItem, updateQuantity, clearCart, addItem } = useCart();
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupOption, setPickupOption] = useState<PickupOption>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [activeOffers, setActiveOffers] = useState<Offer[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [couponError, setCouponError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<{ cartItemId: string; menuItem: MenuItem } | null>(null);
  const pendingSuccessOrderId = readCheckoutSuccessOrder();

  useEffect(() => {
    if (profile) {
      if (profile.full_name && !name) setName(profile.full_name);
      if (profile.phone && !phone) setPhone(profile.phone);
    }
  }, [profile, name, phone]);

  useEffect(() => {
    if (items.length > 0 || !pendingSuccessOrderId) return;
    navigate(`/order-success/${pendingSuccessOrderId}`, { replace: true });
  }, [items.length, navigate, pendingSuccessOrderId]);

  useEffect(() => {
    void loadActiveOffers();
  }, []);

  async function loadActiveOffers() {
    const now = new Date().toISOString();
    const { data } = await customerSupabase
      .from('offers')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', now)
      .gte('valid_until', now)
      .order('created_at', { ascending: false });

    setActiveOffers(data || []);
  }

  async function applyCoupon() {
    setCouponError('');
    if (!couponCode.trim()) return;
    const matchingOffer = activeOffers.find((offer) => (
      getOfferMode(offer) === 'coupon' && getOfferCode(offer) === couponCode.trim().toUpperCase()
    ));

    if (!matchingOffer) {
      setCouponError('Invalid or expired coupon code');
      setAppliedOffer(null);
      return;
    }

    const offerEligibilityError = getOfferEligibilityError(matchingOffer, {
      subtotal,
      itemCount,
      addOnTotal: getCartAddOnTotal(items),
    });

    if (offerEligibilityError) {
      setCouponError(offerEligibilityError);
      setAppliedOffer(null);
      return;
    }

    setAppliedOffer(matchingOffer);
    showToast('Coupon applied!');
  }

  const addOnTotal = getCartAddOnTotal(items);
  const pricingContext = { subtotal, itemCount, addOnTotal };
  const couponDiscount = appliedOffer ? getOfferDiscountAmount(appliedOffer, pricingContext) : 0;
  const automaticOffer = getBestAutomaticOffer(activeOffers, pricingContext);
  const automaticDiscount = automaticOffer?.discountAmount || 0;
  const featuredAutomaticOffer = automaticOffer?.offer || activeOffers.find((offer) => getOfferMode(offer) === 'automatic') || null;
  const discount = Math.min(subtotal, couponDiscount + automaticDiscount);
  const takeawayFee = pickupOption === 'takeaway' ? TAKEAWAY_CHARGE : 0;
  const total = Math.max(0, subtotal - discount) + takeawayFee;
  const isFreeOrder = total <= 0;
  const serviceModeLabel = getServiceModeLabel({ order_type: 'pickup', pickup_option: pickupOption });

  useEffect(() => {
    if (isFreeOrder || paymentMethod !== 'card') return;
    void loadRazorpayScript().catch((error) => {
      console.error('Failed to preload Razorpay checkout', error);
    });
  }, [isFreeOrder, paymentMethod]);

  useEffect(() => {
    if (!appliedOffer) return;

    const latestOffer = activeOffers.find((offer) => offer.id === appliedOffer.id) || appliedOffer;
    const offerEligibilityError = getOfferEligibilityError(latestOffer, {
      subtotal,
      itemCount,
      addOnTotal,
    });

    if (offerEligibilityError) {
      setAppliedOffer(null);
      setCouponError(`${latestOffer.title} is no longer eligible for this cart`);
      return;
    }

    if (latestOffer !== appliedOffer) {
      setAppliedOffer(latestOffer);
    }
  }, [activeOffers, addOnTotal, appliedOffer, itemCount, subtotal]);

  function getCustomerEmail() {
    return profile?.email?.trim() || user?.email?.trim() || '';
  }

  async function syncProfileDetails() {
    if (!user) return;

    const { error: profileUpdateError } = await customerSupabase.from('profiles').update({
      full_name: name.trim(),
      phone: phone.trim(),
    }).eq('id', user.id);

    if (profileUpdateError) {
      console.error('Failed to update profile before placing order', profileUpdateError);
    }
  }

  async function startRazorpayCheckout(customerEmail: string) {
    const razorpayScriptPromise = loadRazorpayScript();
    const razorpayOrder = await createRazorpayOrder({
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerEmail,
      pickupOption,
      subtotal,
      discount,
      total,
      items: items.map((item) => ({
        menu_item_id: item.menu_item.id,
        item_name: item.menu_item.name,
        quantity: item.quantity,
        unit_price: item.menu_item.price,
        customizations: item.customizations,
      })),
    });

    try {
      await razorpayScriptPromise;

      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) {
        throw new Error('Razorpay checkout is unavailable');
      }

      await new Promise<void>((resolve, reject) => {
        let paymentFinalized = false;

        const checkout = new RazorpayCheckout({
          key: razorpayOrder.keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: 'The Supreme Waffle',
          image: RAZORPAY_BRAND_IMAGE,
          description: `${serviceModeLabel} Order`,
          order_id: razorpayOrder.razorpayOrderId,
          prefill: {
            name: razorpayOrder.customerName,
            email: razorpayOrder.customerEmail,
            contact: razorpayOrder.customerPhone,
          },
          notes: {
            app_order_id: razorpayOrder.appOrderId,
          },
          theme: {
            color: '#D8B24E',
          },
          retry: {
            enabled: true,
            max_count: 2,
          },
          modal: {
            confirm_close: true,
            ondismiss: () => {
              if (paymentFinalized) return;
              void cancelRazorpayPayment(razorpayOrder.appOrderId).catch((cancelError) => {
                console.error('Failed to cancel pending Razorpay order', cancelError);
              });
              reject(new Error('Payment cancelled'));
            },
          },
          handler: (response) => {
            paymentFinalized = true;

            void (async () => {
              try {
                const verification = await verifyRazorpayPayment({
                  appOrderId: razorpayOrder.appOrderId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });

                const successfulOrderId = verification.appOrderId || razorpayOrder.appOrderId;
                storeCheckoutSuccessOrder(successfulOrderId);
                showToast('Order placed successfully');
                playOrderSound();
                navigate(`/order-success/${successfulOrderId}`, { replace: true });
                clearCart();
                resolve();
              } catch (verificationError) {
                console.error('Failed to verify Razorpay payment', verificationError);
                reject(verificationError instanceof Error ? verificationError : new Error('Payment verification failed'));
              }
            })();
          },
        });

        checkout.on('payment.failed', (failure) => {
          if (paymentFinalized) return;
          paymentFinalized = true;
          void cancelRazorpayPayment(razorpayOrder.appOrderId).catch((cancelError) => {
            console.error('Failed to cancel failed Razorpay payment', cancelError);
          });
          reject(new Error(failure.error?.description || 'Payment failed'));
        });

        checkout.open();
      });
    } catch (razorpayCheckoutError) {
      await cancelRazorpayPayment(razorpayOrder.appOrderId).catch((cancelError) => {
        console.error('Failed to cancel Razorpay order after checkout setup error', cancelError);
      });
      throw razorpayCheckoutError;
    }
  }

  async function handlePlaceOrder() {
    if (settings && !settings.site_is_open) {
      showToast(settings.reopening_text || 'Ordering is currently unavailable', 'error');
      return;
    }

    if (!user) {
      navigate('/auth', { state: { from: '/cart' } });
      return;
    }

    if (!name.trim() || !phone.trim()) {
      showToast('Please fill in your name and phone number', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const customerEmail = getCustomerEmail();
      void syncProfileDetails().catch((error) => {
        console.error('Failed to sync profile details during checkout', error);
      });

      if (paymentMethod === 'card' && !isFreeOrder) {
        await startRazorpayCheckout(customerEmail);
        return;
      }

      const order = await createCounterOrder({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail,
        pickupOption,
        subtotal,
        discount,
        total,
        paymentMethod,
        items: items.map((item) => ({
          menu_item_id: item.menu_item.id,
          item_name: item.menu_item.name,
          quantity: item.quantity,
          unit_price: item.menu_item.price,
          customizations: item.customizations,
        })),
      });

      storeCheckoutSuccessOrder(order.appOrderId);
      showToast('Order placed successfully');
      playOrderSound();
      navigate(`/order-success/${order.appOrderId}`, { replace: true });
      clearCart();
    } catch (placeOrderError) {
      console.error('Unexpected order placement error', placeOrderError);
      const message = placeOrderError instanceof Error
        ? placeOrderError.message
        : (typeof placeOrderError === 'object' && placeOrderError !== null && 'message' in placeOrderError && typeof (placeOrderError as { message: unknown }).message === 'string')
          ? (placeOrderError as { message: string }).message
          : 'Failed to place order. Please try again.';
      const lowerMessage = message.toLowerCase();
      const isSessionError = SESSION_KEYWORDS.some((kw) => lowerMessage.includes(kw));
      if (isSessionError) {
        navigate('/auth', { state: { from: '/cart' }, replace: true });
      }
      showToast(message === 'Payment cancelled' ? 'Payment cancelled' : message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditConfirm(menuItem: MenuItem, quantity: number, customizations: SelectedCustomization[]) {
    if (!editingItem) return;
    removeItem(editingItem.cartItemId);
    addItem(menuItem, quantity, customizations);
    setEditingItem(null);
    showToast('Item updated!');
  }

  if (items.length === 0) {
    if (pendingSuccessOrderId) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center section-padding bg-brand-bg">
          <div className="w-24 h-24 bg-brand-surface rounded-full flex items-center justify-center mb-6">
            <ShoppingBag size={40} className="text-brand-gold" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Redirecting to your order...</h2>
          <p className="text-brand-text-muted text-[15px]">We are opening your order confirmation page.</p>
        </div>
      );
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center section-padding bg-brand-bg">
        <div className="w-24 h-24 bg-brand-surface rounded-full flex items-center justify-center mb-6">
          <ShoppingBag size={40} className="text-brand-text-dim" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Your cart is empty</h2>
        <p className="text-brand-text-muted text-[15px]">Add some delicious waffles to get started</p>
        <Link to="/menu" className="btn-primary mt-6">Browse Menu</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto px-4 py-6 pb-32"
      >
        <div className="flex items-center justify-between mb-5">
          <Link to="/menu" className="inline-flex items-center gap-2 text-[13px] text-brand-text-dim hover:text-brand-gold transition-colors">
            <ArrowLeft size={15} />
            Menu
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
            <Store size={12} strokeWidth={2.5} />
            {serviceModeLabel} Order
          </div>
        </div>

        <h1 className="text-xl font-extrabold tracking-tight text-white mb-5">
          Cart <span className="text-brand-text-dim font-semibold text-base tabular-nums">({itemCount})</span>
        </h1>

        <div className="space-y-2.5 mb-6">
          <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60, height: 0, marginBottom: 0, transition: { duration: 0.25, ease: 'easeIn' } }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="bg-brand-surface rounded-xl p-3.5 border border-brand-border flex gap-3"
            >
              <img
                src={item.menu_item.image_url}
                alt={item.menu_item.name}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white text-[14px] leading-snug">{item.menu_item.name}</h3>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 hover:bg-red-500/10 rounded-lg text-brand-text-dim hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </div>

                {item.customizations.length > 0 && (
                  <div className="mt-1 flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <CartCustomizations customizations={item.customizations} />
                    </div>
                    <button
                      onClick={() => setEditingItem({ cartItemId: item.id, menuItem: item.menu_item })}
                      className="flex items-center gap-1 text-[11px] font-bold text-brand-gold hover:text-brand-gold-soft transition-colors flex-shrink-0 mt-0.5"
                    >
                      <Pencil size={10} />
                      Edit
                    </button>
                  </div>
                )}

                {item.customizations.length === 0 && (
                  <button
                    onClick={() => setEditingItem({ cartItemId: item.id, menuItem: item.menu_item })}
                    className="flex items-center gap-1 text-[11px] font-bold text-brand-gold hover:text-brand-gold-soft transition-colors mt-1"
                  >
                    <Plus size={10} />
                    Add toppings
                  </button>
                )}

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-brand-gold/30 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center text-brand-gold hover:bg-brand-gold/10 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-[12px] font-bold tabular-nums text-brand-gold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center text-brand-gold hover:bg-brand-gold/10 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="font-bold text-brand-gold tabular-nums text-[14px]">{'\u20B9'}{item.total_price.toFixed(0)}</span>
                </div>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>

          <Link
            to="/menu"
            className="flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold text-brand-gold hover:bg-brand-gold/5 rounded-xl transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add more items
          </Link>
        </div>

        {!user && (
          <div className="bg-brand-gold/5 rounded-xl p-4 border border-brand-gold/20 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-gold/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-[14px]">Sign in to order</h3>
                <p className="text-[12px] text-brand-text-dim">Track orders and save your details</p>
              </div>
              <Link
                to="/auth"
                state={{ from: '/cart' }}
                className="btn-primary text-[13px] py-2 px-4"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}

        {user && (
          <div className="bg-brand-surface rounded-xl p-4 border border-brand-border mb-4">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Your Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field text-[14px]"
              />
              <input
                type="tel"
                placeholder="Phone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field text-[14px]"
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-bold text-white text-[14px] mb-3">How would you like this order?</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setPickupOption('dine_in')}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                pickupOption === 'dine_in'
                  ? 'border-brand-gold bg-brand-gold/10'
                  : 'border-brand-border bg-brand-surface hover:border-brand-border'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                pickupOption === 'dine_in' ? 'bg-brand-gold/20' : 'bg-brand-surface-light'
              }`}>
                <Store size={20} className={pickupOption === 'dine_in' ? 'text-brand-gold' : 'text-brand-text-dim'} />
              </div>
              <div>
                <span className={`text-[14px] font-bold block ${pickupOption === 'dine_in' ? 'text-white' : 'text-brand-text-muted'}`}>Dine In</span>
                <span className="text-[11px] text-brand-text-dim">Enjoy it at the shop</span>
              </div>
            </button>
            <button
              onClick={() => setPickupOption('takeaway')}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                pickupOption === 'takeaway'
                  ? 'border-brand-gold bg-brand-gold/10'
                  : 'border-brand-border bg-brand-surface hover:border-brand-border'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                pickupOption === 'takeaway' ? 'bg-brand-gold/20' : 'bg-brand-surface-light'
              }`}>
                <ShoppingBag size={20} className={pickupOption === 'takeaway' ? 'text-brand-gold' : 'text-brand-text-dim'} />
              </div>
              <div>
                <span className={`text-[14px] font-bold block ${pickupOption === 'takeaway' ? 'text-white' : 'text-brand-text-muted'}`}>Takeaway</span>
                <span className="text-[11px] text-brand-text-dim">Pack it to go + ₹{TAKEAWAY_CHARGE}</span>
              </div>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-bold text-white text-[14px] mb-3">
            {isFreeOrder ? 'Payment covered by offer' : 'How would you like to settle payment?'}
          </h3>
          {isFreeOrder ? (
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto bg-emerald-500/20 mb-2">
                <Tag size={20} className="text-emerald-400" />
              </div>
              <div>
                <span className="text-[14px] font-bold block text-white">Free Order</span>
                <span className="text-[11px] text-emerald-300">
                  Coupon covered the full amount. No payment is required.
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                  paymentMethod === 'card'
                    ? 'border-brand-gold bg-brand-gold/10'
                    : 'border-brand-border bg-brand-surface hover:border-brand-border'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  paymentMethod === 'card' ? 'bg-brand-gold/20' : 'bg-brand-surface-light'
                }`}>
                  <CreditCard size={20} className={paymentMethod === 'card' ? 'text-brand-gold' : 'text-brand-text-dim'} />
                </div>
                <div>
                  <span className={`text-[14px] font-bold block ${paymentMethod === 'card' ? 'text-white' : 'text-brand-text-muted'}`}>Pay Online</span>
                  <span className="text-[11px] text-brand-text-dim">
                    UPI, cards, and more with Razorpay
                  </span>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod('cod')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                  paymentMethod === 'cod'
                    ? 'border-brand-gold bg-brand-gold/10'
                    : 'border-brand-border bg-brand-surface hover:border-brand-border'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  paymentMethod === 'cod' ? 'bg-brand-gold/20' : 'bg-brand-surface-light'
                }`}>
                  <Wallet size={20} className={paymentMethod === 'cod' ? 'text-brand-gold' : 'text-brand-text-dim'} />
                </div>
                <div>
                  <span className={`text-[14px] font-bold block ${paymentMethod === 'cod' ? 'text-white' : 'text-brand-text-muted'}`}>Pay at Counter</span>
                  <span className="text-[11px] text-brand-text-dim">
                    {pickupOption === 'dine_in' ? 'Cash / UPI while dining' : 'Cash / UPI at collection'}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="bg-brand-surface rounded-xl p-4 border border-brand-border mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-dim" />
              <input
                type="text"
                placeholder="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="input-field pl-9 text-[13px]"
              />
            </div>
            <button onClick={applyCoupon} className="btn-outline px-4 py-2 text-[13px] font-semibold rounded-lg">Apply</button>
          </div>
          {couponError && <p className="text-red-400 text-[12px] mt-2">{couponError}</p>}
          {appliedOffer && (
            <div className="mt-2.5 bg-emerald-500/10 text-emerald-400 text-[12px] px-3 py-2 rounded-lg flex items-center justify-between">
              <span className="font-semibold">{appliedOffer.title} applied! {getOfferRuleSummary(appliedOffer)}</span>
              <button onClick={() => { setAppliedOffer(null); setCouponCode(''); }} className="font-semibold hover:underline">Remove</button>
            </div>
          )}
          {featuredAutomaticOffer && (
            <div className={`mt-2.5 text-[12px] px-3 py-2 rounded-lg border ${
              automaticDiscount > 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-brand-gold/10 text-brand-gold border-brand-gold/20'
            }`}>
              <span className="font-semibold">
                {automaticDiscount > 0 ? `${featuredAutomaticOffer.title} applied automatically!` : `${featuredAutomaticOffer.title} available:`}
              </span>{' '}
              {automaticDiscount > 0
                ? `You saved ₹${automaticDiscount.toFixed(0)}.`
                : getOfferRuleSummary(featuredAutomaticOffer)}
            </div>
          )}
        </div>

        <div className="bg-brand-surface rounded-xl p-4 border border-brand-border mb-6">
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between text-brand-text-muted">
              <span className="text-[13px]">Subtotal</span>
              <span className="tabular-nums">{'\u20B9'}{subtotal.toFixed(0)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="text-[13px]">Coupon</span>
                <span className="tabular-nums">-{'\u20B9'}{couponDiscount.toFixed(0)}</span>
              </div>
            )}
            {automaticDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="text-[13px]">Offer</span>
                <span className="tabular-nums">-{'\u20B9'}{automaticDiscount.toFixed(0)}</span>
              </div>
            )}
            {addOnTotal > 0 && (
              <div className="flex justify-between text-brand-text-muted">
                <span className="text-[13px]">Add-ons in cart</span>
                <span className="tabular-nums">{'\u20B9'}{addOnTotal.toFixed(0)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="text-[13px]">Total savings</span>
                <span className="tabular-nums">-{'\u20B9'}{discount.toFixed(0)}</span>
              </div>
            )}
            {takeawayFee > 0 && (
              <div className="flex justify-between text-brand-text-muted">
                <span className="text-[13px]">Takeaway charge</span>
                <span className="tabular-nums">{'\u20B9'}{takeawayFee.toFixed(0)}</span>
              </div>
            )}
            <div className="border-t border-brand-border pt-2.5 flex justify-between font-bold">
              <span className="text-white">Total</span>
              <span className="tabular-nums text-lg tracking-tight text-brand-gold">{'\u20B9'}{total.toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div className="cart-submit-bar">
          <div className="max-w-lg mx-auto">
            <motion.button
              onClick={handlePlaceOrder}
              disabled={submitting || !!(settings && !settings.site_is_open)}
              whileTap={{ scale: 0.97 }}
              animate={submitting ? { boxShadow: ['0 0 0 0 rgba(216,178,78,0)', '0 0 16px 4px rgba(216,178,78,0.2)', '0 0 0 0 rgba(216,178,78,0)'] } : {}}
              transition={submitting ? { duration: 1.2, repeat: Infinity } : { duration: 0.1 }}
              className="btn-primary w-full text-center text-[15px] font-extrabold py-3.5 rounded-xl tracking-tight"
            >
              {!user
                ? 'Sign In to Continue'
                : settings && !settings.site_is_open
                ? settings.reopening_text || 'Orders Closed'
                : submitting
                ? paymentMethod === 'card' && !isFreeOrder ? 'Opening Payment...' : 'Placing Order...'
                : isFreeOrder
                ? 'Proceed to Checkout • FREE'
                : <>Proceed to Checkout • {'\u20B9'}{total.toFixed(0)}</>}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {editingItem && (
        <CustomizationModal
          item={editingItem.menuItem}
          onClose={() => setEditingItem(null)}
          onConfirm={handleEditConfirm}
        />
      )}
    </div>
  );
}

function CartCustomizations({ customizations }: { customizations: SelectedCustomization[] }) {
  const grouped: Record<string, string[]> = {};
  for (const c of customizations) {
    if (!grouped[c.group_name]) grouped[c.group_name] = [];
    grouped[c.group_name].push(c.option_name);
  }

  return (
    <div className="space-y-0.5">
      {Object.entries(grouped).map(([group, options]) => (
        <p key={group} className="text-[11px] text-brand-text-dim leading-snug truncate">
          <span className="text-brand-text-muted">{group}:</span> {options.join(', ')}
        </p>
      ))}
    </div>
  );
}
