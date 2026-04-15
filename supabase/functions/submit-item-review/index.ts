import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubmitItemReviewBody {
  orderItemId?: string;
  rating?: number;
  comment?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateRewardCode() {
  return `REVIEW10-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

async function createRewardCoupon(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  itemReviewId: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateRewardCode();

    const { data, error } = await adminClient
      .from("review_reward_coupons")
      .insert({
        user_id: userId,
        item_review_id: itemReviewId,
        code,
        discount_percentage: 10,
      })
      .select("*")
      .single();

    if (!error) {
      return data;
    }

    if (error.code !== "23505") {
      throw error;
    }

    const { data: existingCoupon, error: existingCouponError } = await adminClient
      .from("review_reward_coupons")
      .select("*")
      .eq("item_review_id", itemReviewId)
      .maybeSingle();

    if (existingCouponError) {
      throw existingCouponError;
    }

    if (existingCoupon) {
      return existingCoupon;
    }
  }

  throw new Error("Could not create review reward coupon");
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

    const body = await req.json() as SubmitItemReviewBody;
    const orderItemId = body.orderItemId?.trim() || "";
    const rating = Number(body.rating ?? 0);
    const comment = body.comment?.trim() || "";

    if (!orderItemId) {
      return jsonResponse({ success: false, error: "Order item is required" }, 400);
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonResponse({ success: false, error: "Rating must be between 1 and 5" }, 400);
    }

    if (!comment) {
      return jsonResponse({ success: false, error: "Comment is required" }, 400);
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

    const { data: orderItem, error: orderItemError } = await adminClient
      .from("order_items")
      .select("id, order_id, menu_item_id")
      .eq("id", orderItemId)
      .maybeSingle();

    if (orderItemError || !orderItem) {
      return jsonResponse({ success: false, error: "Order item not found" }, 404);
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_id, user_id, status")
      .eq("id", orderItem.order_id)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    if (order.user_id !== user.id) {
      return jsonResponse({ success: false, error: "Order access denied" }, 403);
    }

    if (order.status !== "delivered") {
      return jsonResponse({ success: false, error: "You can review items after the order is delivered" }, 409);
    }

    const { data: existingReview, error: existingReviewError } = await adminClient
      .from("item_reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("order_item_id", orderItem.id)
      .maybeSingle();

    if (existingReviewError) {
      throw existingReviewError;
    }

    if (existingReview) {
      return jsonResponse({ success: false, error: "You already reviewed this item" }, 409);
    }

    const { data: review, error: reviewError } = await adminClient
      .from("item_reviews")
      .insert({
        user_id: user.id,
        order_id: order.id,
        order_item_id: orderItem.id,
        menu_item_id: orderItem.menu_item_id,
        rating,
        comment,
      })
      .select("*")
      .single();

    if (reviewError || !review) {
      if (reviewError?.code === "23505") {
        return jsonResponse({ success: false, error: "You already reviewed this item" }, 409);
      }

      throw reviewError || new Error("Failed to submit item review");
    }

    const rewardCoupon = await createRewardCoupon(adminClient, user.id, review.id);

    return jsonResponse({
      success: true,
      review,
      rewardCoupon,
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
