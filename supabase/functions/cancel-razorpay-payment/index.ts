import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CancelBody {
  appOrderId?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Missing authorization" }, 401);
    }

    const { appOrderId } = await req.json() as CancelBody;
    const normalizedOrderId = appOrderId?.trim() || "";

    if (!normalizedOrderId) {
      return jsonResponse({ success: false, error: "appOrderId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized request" }, 401);
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_id, user_id, payment_provider, payment_status, status")
      .eq("order_id", normalizedOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: true, appOrderId: normalizedOrderId });
    }

    if (order.user_id !== user.id) {
      return jsonResponse({ success: false, error: "Order access denied" }, 403);
    }

    if (order.payment_provider !== "razorpay" || order.payment_status === "paid") {
      return jsonResponse({ success: true, appOrderId: order.order_id });
    }

    await adminClient
      .from("orders")
      .update({
        payment_status: "failed",
        status: "expired",
      })
      .eq("id", order.id);

    return jsonResponse({ success: true, appOrderId: order.order_id });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
