import { supabase } from './supabase';

const INVENTORY_COLUMN_NAMES = ['available_quantity', 'manual_availability', 'track_inventory'];
const EXPIRE_ORDERS_FUNCTION_NAME = 'expire_stale_pending_orders';

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

export function isMissingInventorySchemaError(error: SupabaseLikeError | null | undefined) {
  const message = error?.message?.toLowerCase() || '';
  return INVENTORY_COLUMN_NAMES.some((columnName) => message.includes(columnName));
}

export function isMissingExpireOrdersFunctionError(error: SupabaseLikeError | null | undefined) {
  const message = error?.message?.toLowerCase() || '';
  return error?.code === 'PGRST202' || message.includes(EXPIRE_ORDERS_FUNCTION_NAME);
}

export async function detectInventorySchemaSupport() {
  const { error } = await supabase
    .from('menu_items')
    .select('id, manual_availability, track_inventory, available_quantity')
    .limit(1);

  if (error) {
    if (isMissingInventorySchemaError(error)) {
      return false;
    }

    throw error;
  }

  return true;
}

export async function expireStalePendingOrders() {
  const { error } = await supabase.rpc(EXPIRE_ORDERS_FUNCTION_NAME);

  if (error) {
    if (isMissingExpireOrdersFunctionError(error)) {
      return false;
    }

    throw error;
  }

  return true;
}
