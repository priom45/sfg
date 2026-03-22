import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MarkReadyBody {
  orderId?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requestReadyEmail(
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  orderId: string,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-order-ready-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    let readyEmailError = "Failed to send order-ready email";

    try {
      const payload = await response.clone().json() as { error?: string; message?: string };
      if (typeof payload.error === "string" && payload.error.trim()) {
        readyEmailError = payload.error;
      } else if (typeof payload.message === "string" && payload.message.trim()) {
        readyEmailError = payload.message;
      }
    } catch {
      try {
        const text = await response.text();
        if (text.trim()) {
          readyEmailError = text.trim();
        }
      } catch {
        // Ignore parsing failures and keep the fallback message.
      }
    }

    throw new Error(readyEmailError);
  }
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

    const { orderId } = await req.json() as MarkReadyBody;
    const appOrderId = orderId?.trim() || "";

    if (!appOrderId) {
      return jsonResponse({ success: false, error: "orderId is required" }, 400);
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

    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const requesterIsStaff = requesterProfile?.role === "admin" ||
      requesterProfile?.role === "chef";

    if (!requesterIsStaff) {
      return jsonResponse({ success: false, error: "Staff access required" }, 403);
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_id, order_type, status")
      .eq("order_id", appOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    if (order.status === "cancelled" || order.status === "expired" || order.status === "delivered") {
      return jsonResponse({ success: false, error: "Order cannot be marked ready from its current status" }, 409);
    }

    if (order.status !== "packed") {
      const { error: updateError } = await adminClient
        .from("orders")
        .update({
          status: "packed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateError) {
        throw updateError;
      }
    }

    let readyEmailSent = true;
    if (order.order_type === "pickup") {
      try {
        await requestReadyEmail(supabaseUrl, anonKey, serviceKey, order.order_id);
      } catch (readyEmailError) {
        readyEmailSent = false;
        console.error("Failed to send order-ready email", readyEmailError);
      }
    }

    return jsonResponse({
      success: true,
      appOrderId: order.order_id,
      readyEmailSent,
    });
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
