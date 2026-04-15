import { customerSupabase } from './supabase';

interface CartSuggestionRequestItem {
  menu_item_id: string;
  name: string;
  category_name: string;
  quantity?: number;
  price?: number;
}

interface CartSuggestionResult {
  menu_item_id: string;
  reason?: string | null;
}

interface SuggestCartAddOnsResponse {
  success: boolean;
  suggestions?: CartSuggestionResult[];
  error?: string;
}

interface SuggestCartAddOnsPayload {
  cartItems: CartSuggestionRequestItem[];
  candidateItems: CartSuggestionRequestItem[];
  limit?: number;
}

export async function suggestCartAddOns(payload: SuggestCartAddOnsPayload) {
  const { data, error } = await customerSupabase.functions.invoke<SuggestCartAddOnsResponse>(
    'suggest-cart-addons',
    {
      body: payload,
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to load AI suggestions');
  }

  return data.suggestions || [];
}
