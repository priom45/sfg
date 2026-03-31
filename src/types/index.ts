export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  display_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  prep_time: number;
  rating: number;
  is_veg: boolean;
  is_eggless: boolean;
  is_available: boolean;
  has_customizations?: boolean;
  display_order: number;
}

export interface CustomizationGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multi';
  is_required: boolean;
  display_order: number;
}

export interface CustomizationOption {
  id: string;
  group_id: string;
  name: string;
  price: number;
  created_at?: string;
  preview_image_url: string;
  preview_image_source?: 'item' | 'category' | 'default' | null;
  is_available: boolean;
  display_order: number;
}

export interface CustomizationGroupTarget {
  id: string;
  group_id: string;
  category_id: string | null;
  menu_item_id: string | null;
}

export interface CustomizationOptionPreviewOverride {
  id: string;
  group_id: string;
  option_name: string;
  category_id: string | null;
  menu_item_id: string | null;
  preview_image_url: string;
}

export interface DeliveryZone {
  id: string;
  pincode: string;
  area_name: string;
  delivery_fee: number;
  min_order: number;
  estimated_time: number;
  is_active: boolean;
}

export interface SiteSettings {
  id: boolean;
  site_is_open: boolean;
  closure_title: string;
  closure_message: string;
  reopening_text: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from_email: string;
  smtp_from_name: string;
  created_at: string;
  updated_at: string;
}

export type OfferMode = 'coupon' | 'automatic';
export type OfferTriggerType = 'min_order' | 'item_quantity';
export type OfferDiscountType = 'percentage' | 'flat' | 'free_addons';

export interface Offer {
  id: string;
  title: string;
  description: string;
  code: string | null;
  display_badge?: string | null;
  display_reward?: string | null;
  background_image_url?: string | null;
  is_cart_eligible?: boolean | null;
  offer_mode?: OfferMode | null;
  trigger_type?: OfferTriggerType | null;
  discount_type: OfferDiscountType;
  discount_value: number;
  min_order: number;
  required_item_quantity?: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

export interface SelectedCustomization {
  group_name: string;
  option_name: string;
  price: number;
}

export interface CartItem {
  id: string;
  menu_item: MenuItem;
  quantity: number;
  customizations: SelectedCustomization[];
  total_price: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'expired';

export type OrderType = 'delivery' | 'pickup';
export type PickupOption = 'dine_in' | 'takeaway';
export type PaymentMethod = 'upi' | 'card' | 'cod';
export type PaymentProvider = 'razorpay' | null;

export interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string;
  pincode: string;
  order_type: OrderType;
  pickup_option: PickupOption;
  delivery_fee: number;
  takeaway_fee: number;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  payment_provider: PaymentProvider;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_verified_at: string | null;
  status: OrderStatus;
  placed_at: string;
  confirmed_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  queue_position: number | null;
  expires_at: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: SelectedCustomization[];
}
