import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_email: string;
  smtp_from_name: string;
}

interface ReadyOrder {
  id: string;
  order_id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  order_type: "pickup" | "delivery";
  pickup_option?: "dine_in" | "takeaway" | null;
  total: number;
  payment_status: string;
  placed_at: string;
  status: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value: number) {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatPlacedAt(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function serviceModeLabel(order: Pick<ReadyOrder, "order_type" | "pickup_option">) {
  if (order.order_type === "delivery") return "Delivery";
  return order.pickup_option === "dine_in" ? "Dine In" : "Takeaway";
}

function readyHeadline(order: Pick<ReadyOrder, "order_type" | "pickup_option">) {
  if (order.order_type === "delivery") return "Your order is packed";
  return order.pickup_option === "dine_in"
    ? "Your order is ready to serve"
    : "Your order is ready for pickup";
}

function readyMessage(order: Pick<ReadyOrder, "order_type" | "pickup_option">) {
  if (order.order_type === "delivery") {
    return "Your waffles are packed and will move to the next delivery step shortly.";
  }

  return order.pickup_option === "dine_in"
    ? "Your order is ready at the table service counter."
    : "Your order is ready at the counter. Please show your order ID while collecting it.";
}

function isMissingPickupOptionColumn(error: { code?: string; message?: string } | null) {
  return !!error?.message?.includes("pickup_option") &&
    (error.code === "42703" || error.code === "PGRST204");
}

async function fetchOrderWithPickupFallback(
  adminClient: ReturnType<typeof createClient>,
  orderId: string,
) {
  const baseSelect = `
        id,
        order_id,
        user_id,
        customer_name,
        customer_email,
        order_type,
        total,
        payment_status,
        placed_at,
        status
      `;

  let { data, error } = await adminClient
    .from("orders")
    .select(`${baseSelect}, pickup_option`)
    .eq("order_id", orderId)
    .maybeSingle();

  if (isMissingPickupOptionColumn(error)) {
    ({ data, error } = await adminClient
      .from("orders")
      .select(baseSelect)
      .eq("order_id", orderId)
      .maybeSingle());
  }

  return { data, error };
}

async function resolveRecipientEmail(
  adminClient: ReturnType<typeof createClient>,
  requester: { id: string; email?: string | null } | null,
  order: Pick<ReadyOrder, "customer_email" | "user_id">,
) {
  const customerEmail = order.customer_email.trim();
  if (customerEmail) return customerEmail;

  if (order.user_id) {
    const { data, error } = await adminClient.auth.admin.getUserById(order.user_id);
    const ownerEmail = data.user?.email?.trim() || "";
    if (!error && ownerEmail) return ownerEmail;
  }

  if (requester && order.user_id === requester.id) {
    return requester.email?.trim() || "";
  }

  return "";
}

function buildEmailHtml(order: ReadyOrder) {
  const logoUrl =
    "https://res.cloudinary.com/dlkovvlud/image/upload/v1771590689/Screenshot_2026-02-20_175222-removebg-preview_ufalk6.png";

  const headline = readyHeadline(order);
  const message = readyMessage(order);
  const serviceMode = serviceModeLabel(order);
  const placedAt = formatPlacedAt(order.placed_at);
  const paymentLabel = order.payment_status === "paid" ? "Paid" : "Pending";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(headline)}</title>
      </head>
      <body style="margin:0; padding:0; background:#2f3a1f; font-family:Arial, Helvetica, sans-serif; color:#d4a437;">
        <div style="width:100%; background:#2f3a1f; padding:32px 12px;">
          <div style="max-width:680px; margin:0 auto; background:#3a4726; border:1px solid rgba(212,164,55,0.22); border-radius:22px; overflow:hidden; box-shadow:0 14px 40px rgba(0,0,0,0.28);">

            <div style="background:linear-gradient(180deg, #46562d 0%, #384624 100%); padding:34px 28px 28px; text-align:center; border-bottom:1px solid rgba(212,164,55,0.22);">
              <img
                src="${logoUrl}"
                alt="The Supreme Waffle"
                style="display:block; width:150px; max-width:100%; height:auto; margin:0 auto 16px;"
              />
              <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#c9971c; font-weight:700;">
                The Supreme Waffle
              </div>
              <h1 style="margin:12px 0 0; font-size:30px; line-height:1.2; color:#e0b84f; font-weight:800;">
                ${escapeHtml(headline)}
              </h1>
              <p style="margin:12px auto 0; max-width:520px; font-size:15px; line-height:1.7; color:#d4a437;">
                ${escapeHtml(message)}
              </p>
            </div>

            <div style="padding:28px;">
              <div style="background:#313d20; border:1px solid rgba(212,164,55,0.18); border-radius:16px; padding:18px;">
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 10px; color:#c9971c; font-size:13px;">Order ID</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#e0b84f;">
                      ${escapeHtml(order.order_id)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#c9971c; font-size:13px;">Customer</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#e0b84f;">
                      ${escapeHtml(order.customer_name)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#c9971c; font-size:13px;">Placed</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#e0b84f;">
                      ${escapeHtml(placedAt)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#c9971c; font-size:13px;">Service</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#e0b84f;">
                      ${escapeHtml(serviceMode)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#c9971c; font-size:13px;">Payment</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#e0b84f;">
                      ${escapeHtml(paymentLabel)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0 0; border-top:1px solid rgba(212,164,55,0.22); font-size:18px; font-weight:800; color:#f0c75e;">
                      Total
                    </td>
                    <td style="padding:14px 0 0; border-top:1px solid rgba(212,164,55,0.22); text-align:right; font-size:20px; font-weight:800; color:#f0c75e;">
                      ${formatCurrency(order.total)}
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            <div style="padding:0 28px 28px; text-align:center;">
              <div style="font-size:13px; line-height:1.7; color:#d4a437;">
                Thank you for choosing <span style="color:#f0c75e; font-weight:700;">The Supreme Waffle</span>.
              </div>
              <div style="margin-top:8px; font-size:11px; line-height:1.6; color:#b68b2c;">
                This is an automated order update email.
              </div>
            </div>

          </div>
        </div>
      </body>
    </html>
  `;
}

function buildEmailText(order: ReadyOrder) {
  const headline = readyHeadline(order);
  const message = readyMessage(order);

  return [
    "The Supreme Waffle",
    headline,
    "",
    message,
    "",
    `Order ID: ${order.order_id}`,
    `Customer: ${order.customer_name}`,
    `Placed: ${formatPlacedAt(order.placed_at)}`,
    `Service: ${serviceModeLabel(order)}`,
    `Payment: ${order.payment_status === "paid" ? "Paid" : "Pending"}`,
    `Total: ${formatCurrency(order.total)}`,
  ].join("\n");
}

async function loadSmtpConfig(
  adminClient: ReturnType<typeof createClient>,
): Promise<SmtpConfig | null> {
  const { data, error } = await adminClient
    .from("site_settings")
    .select("smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to load SMTP config from site_settings:", error);
    return null;
  }

  const config = data as SmtpConfig;

  if (!config.smtp_pass) {
    const envPass = Deno.env.get("SMTP_PASS") || "";
    if (envPass) {
      config.smtp_pass = envPass;
    }
  }

  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    return null;
  }

  return config;
}

function createSmtpTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: config.smtp_port === 465,
    auth: { user: config.smtp_user, pass: config.smtp_pass },
    tls: { rejectUnauthorized: false },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "orderId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const smtpConfig = await loadSmtpConfig(adminClient);

    if (!smtpConfig) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "SMTP is not configured. Set SMTP settings in the admin panel under Website settings.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : authHeader.trim();
    const isInternalServiceCall = authToken === serviceKey;

    let requester: { id: string; email?: string | null } | null = null;
    let requesterIsStaff = false;

    if (!isInternalServiceCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser();

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized request" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      requester = user;

      const { data: requesterProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      requesterIsStaff = requesterProfile?.role === "admin" ||
        requesterProfile?.role === "chef";
    }

    const { data: orderData, error: orderError } = await fetchOrderWithPickupFallback(
      adminClient,
      orderId.trim(),
    );
    const order = orderData as ReadyOrder | null;

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!isInternalServiceCall && requester && order.user_id !== requester.id && !requesterIsStaff) {
      return new Response(
        JSON.stringify({ success: false, error: "Order access denied" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (order.status !== "packed") {
      return new Response(
        JSON.stringify({ success: false, error: "Order is not ready yet" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const recipient = await resolveRecipientEmail(adminClient, requester, order);
    if (!recipient) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipient email found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const transport = createSmtpTransport(smtpConfig);
    const fromEmail = smtpConfig.smtp_from_email || smtpConfig.smtp_user;
    const fromName = smtpConfig.smtp_from_name || "The Supreme Waffle";

    const info = await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipient,
      subject: `${readyHeadline(order)} - ${order.order_id}`,
      html: buildEmailHtml(order),
      text: buildEmailText(order),
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipient,
        messageId: info?.messageId ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-order-ready-email error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});