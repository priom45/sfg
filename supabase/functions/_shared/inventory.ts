import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type AdminClient = ReturnType<typeof createClient>;

type InventoryRpcResponse = {
  success?: boolean;
  error?: string;
};

function isMissingRpcError(error: { code?: string; message?: string } | null, fn: string) {
  return !!error &&
    (error.code === "PGRST202" || error.code === "42883" || error.message?.includes(fn));
}

async function callInventoryRpc(
  adminClient: AdminClient,
  fn: "reserve_menu_item_inventory" | "release_menu_item_inventory",
  orderId: string,
) {
  const { data, error } = await adminClient.rpc(fn, {
    p_order_id: orderId,
  });

  if (error) {
    if (isMissingRpcError(error, fn)) {
      return { success: true, error: null };
    }

    throw error;
  }

  const payload = (data || {}) as InventoryRpcResponse;

  return {
    success: payload.success !== false,
    error: typeof payload.error === "string" ? payload.error : null,
  };
}

export async function reserveOrderInventory(
  adminClient: AdminClient,
  orderId: string,
) {
  return callInventoryRpc(adminClient, "reserve_menu_item_inventory", orderId);
}

export async function releaseOrderInventory(
  adminClient: AdminClient,
  orderId: string,
) {
  return callInventoryRpc(adminClient, "release_menu_item_inventory", orderId);
}

export async function expireStalePendingOrders(adminClient: AdminClient) {
  const { error } = await adminClient.rpc("expire_stale_pending_orders");

  if (error && !isMissingRpcError(error, "expire_stale_pending_orders")) {
    throw error;
  }
}
