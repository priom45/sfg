import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type AdminClient = ReturnType<typeof createClient>;

type InventoryRpcResponse = {
  success?: boolean;
  error?: string;
};

async function callInventoryRpc(
  adminClient: AdminClient,
  fn: "reserve_menu_item_inventory" | "release_menu_item_inventory",
  orderId: string,
) {
  const { data, error } = await adminClient.rpc(fn, {
    p_order_id: orderId,
  });

  if (error) {
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
