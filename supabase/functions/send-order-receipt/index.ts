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

interface ReceiptOrder {
  id: string;
  order_id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  order_type: "pickup" | "delivery";
  pickup_option?: "dine_in" | "takeaway" | null;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  takeaway_fee?: number | null;
  total: number;
  payment_method: "cod" | "upi" | "card";
  payment_status: string;
  placed_at: string;
}

interface ReceiptItemRow {
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: unknown;
}

interface ReceiptCustomization {
  group_name: string;
  option_name: string;
  price: number;
}

interface ReceiptEmailCopy {
  subject: string;
  heading: string;
  introLead: string;
  title: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNumber(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(numberValue) ? numberValue : 0;
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

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isFreeOrder(total: number) {
  return total <= 0;
}

function paymentMethodLabel(
  paymentMethod: ReceiptOrder["payment_method"],
  orderType: ReceiptOrder["order_type"],
  total: number,
) {
  if (total <= 0) {
    return "No Payment Required";
  }

  if (paymentMethod === "cod") {
    return orderType === "pickup" ? "Pay at Counter" : "Cash on Delivery";
  }

  if (paymentMethod === "upi") {
    return orderType === "pickup" ? "UPI at Counter" : "UPI";
  }

  return "Card";
}

function serviceModeLabel(order: Pick<ReceiptOrder, "order_type" | "pickup_option">) {
  if (order.order_type === "delivery") return "Delivery";
  return order.pickup_option === "dine_in" ? "Dine In" : "Takeaway";
}

function receiptEmailCopy(order: ReceiptOrder, isConfirmation: boolean): ReceiptEmailCopy {
  if (isConfirmation || isFreeOrder(toNumber(order.total))) {
    return {
      subject: `Your order confirmation for order ${order.order_id}`,
      heading: "Your order confirmation",
      introLead: "Your order has been placed successfully. Here is your bill for order",
      title: "Order Confirmation",
    };
  }

  return {
    subject: `Your payment receipt for order ${order.order_id}`,
    heading: "Your payment receipt",
    introLead: "Your payment has been received. Here is your bill for order",
    title: "Payment Receipt",
  };
}

function isMissingOrderColumn(
  error: { code?: string; message?: string } | null,
  columnName: "pickup_option" | "takeaway_fee",
) {
  return !!error?.message?.includes(columnName) &&
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
        customer_phone,
        customer_email,
        order_type,
        subtotal,
        discount,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        placed_at
      `;

  let { data, error } = await adminClient
    .from("orders")
    .select(`${baseSelect}, pickup_option, takeaway_fee`)
    .eq("order_id", orderId)
    .maybeSingle();

  if (isMissingOrderColumn(error, "pickup_option") || isMissingOrderColumn(error, "takeaway_fee")) {
    const optionalColumns: string[] = [];

    if (!isMissingOrderColumn(error, "pickup_option")) {
      optionalColumns.push("pickup_option");
    }

    if (!isMissingOrderColumn(error, "takeaway_fee")) {
      optionalColumns.push("takeaway_fee");
    }

    const fallbackSelect = optionalColumns.length ? `${baseSelect}, ${optionalColumns.join(", ")}` : baseSelect;

    ({ data, error } = await adminClient
      .from("orders")
      .select(fallbackSelect)
      .eq("order_id", orderId)
      .maybeSingle());
  }

  return { data, error };
}

async function resolveRecipientEmail(
  adminClient: ReturnType<typeof createClient>,
  requester: { id: string; email?: string | null } | null,
  order: Pick<ReceiptOrder, "customer_email" | "user_id">,
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

function normalizeCustomizations(value: unknown): ReceiptCustomization[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const row = entry as Record<string, unknown>;

    return [
      {
        group_name:
          typeof row.group_name === "string" ? row.group_name : "Option",
        option_name:
          typeof row.option_name === "string" ? row.option_name : "Selected",
        price: toNumber(row.price),
      },
    ];
  });
}

function buildReceiptRows(items: ReceiptItemRow[]) {
  return items.map((item) => {
    const customizations = normalizeCustomizations(item.customizations);
    const customizationTotal = customizations.reduce(
      (sum, customization) => sum + customization.price,
      0,
    );
    const unitTotal = toNumber(item.unit_price) + customizationTotal;
    const lineTotal = unitTotal * Math.max(item.quantity, 1);

    return {
      ...item,
      customizations,
      unitTotal,
      lineTotal,
    };
  });
}

function buildEmailHtml(order: ReceiptOrder, items: ReceiptItemRow[], isConfirmation: boolean) {
  const logoUrl =
    "https://res.cloudinary.com/dlkovvlud/image/upload/v1771590689/Screenshot_2026-02-20_175222-removebg-preview_ufalk6.png";

  const rows = buildReceiptRows(items);
  const placedAt = formatPlacedAt(order.placed_at);
  const paymentLabel = paymentMethodLabel(order.payment_method, order.order_type, toNumber(order.total));
  const serviceMode = serviceModeLabel(order);
  const copy = receiptEmailCopy(order, isConfirmation);

  const itemRowsHtml = rows
    .map((item) => {
      const customizationHtml = item.customizations.length
        ? `
          <div style="margin-top:8px; font-size:13px; color:#c8b06e; line-height:1.6;">
            ${item.customizations
              .map((customization) =>
                `${escapeHtml(customization.group_name)}: ${escapeHtml(customization.option_name)}${customization.price > 0 ? ` (+${formatCurrency(customization.price)})` : ""}`,
              )
              .join("<br />")}
          </div>
        `
        : "";

      return `
        <tr>
          <td style="padding:16px 0; border-bottom:1px solid rgba(166,124,0,0.22); vertical-align:top;">
            <div style="font-size:15px; font-weight:700; color:#f0e2b6;">
              ${escapeHtml(item.item_name)}
            </div>
            <div style="margin-top:4px; font-size:13px; color:#b68b2c;">
              ${item.quantity} x ${formatCurrency(item.unitTotal)}
            </div>
            ${customizationHtml}
          </td>
          <td style="padding:16px 0; border-bottom:1px solid rgba(166,124,0,0.22); text-align:right; vertical-align:top; font-size:15px; font-weight:700; color:#c9971c;">
            ${formatCurrency(item.lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const discountHtml = order.discount > 0
    ? `
      <tr>
        <td style="padding:6px 0; color:#d8c89a;">Discount</td>
        <td style="padding:6px 0; text-align:right; color:#b68b2c; font-weight:700;">
          -${formatCurrency(toNumber(order.discount))}
        </td>
      </tr>
    `
    : "";

  const deliveryFeeHtml = order.delivery_fee > 0
    ? `
      <tr>
        <td style="padding:6px 0; color:#d8c89a;">Delivery Fee</td>
        <td style="padding:6px 0; text-align:right; color:#d8c89a; font-weight:600;">
          ${formatCurrency(toNumber(order.delivery_fee))}
        </td>
      </tr>
    `
    : "";

  const takeawayFeeHtml = toNumber(order.takeaway_fee) > 0
    ? `
      <tr>
        <td style="padding:6px 0; color:#d8c89a;">Takeaway Charge</td>
        <td style="padding:6px 0; text-align:right; color:#d8c89a; font-weight:600;">
          ${formatCurrency(toNumber(order.takeaway_fee))}
        </td>
      </tr>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(copy.title)}</title>
      </head>
      <body style="margin:0; padding:0; background:#2f3a1f; font-family:Arial, Helvetica, sans-serif; color:#e8d9a8;">
        <div style="width:100%; background:#2f3a1f; padding:32px 12px;">
          <div style="max-width:680px; margin:0 auto; background:#3a4726; border:1px solid rgba(166,124,0,0.18); border-radius:22px; overflow:hidden; box-shadow:0 14px 40px rgba(0,0,0,0.28);">

            <div style="background:linear-gradient(180deg, #46562d 0%, #384624 100%); padding:34px 28px 28px; text-align:center; border-bottom:1px solid rgba(166,124,0,0.18);">
              <img
                src="${logoUrl}"
                alt="The Supreme Waffle"
                style="display:block; width:150px; max-width:100%; height:auto; margin:0 auto 16px;"
              />
              <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#b68b2c; font-weight:700;">
                The Supreme Waffle
              </div>
              <h1 style="margin:12px 0 0; font-size:30px; line-height:1.2; color:#d4a437; font-weight:800;">
                ${escapeHtml(copy.heading)}
              </h1>
              <p style="margin:12px auto 0; max-width:520px; font-size:15px; line-height:1.7; color:#e2d1a0;">
                ${escapeHtml(copy.introLead)} <strong style="color:#d4a437;">${escapeHtml(order.order_id)}</strong>.
              </p>
            </div>

            <div style="padding:28px;">
              <div style="background:#313d20; border:1px solid rgba(166,124,0,0.16); border-radius:16px; padding:18px 18px 10px;">
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 10px; color:#b68b2c; font-size:13px;">Customer</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">${escapeHtml(order.customer_name)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#b68b2c; font-size:13px;">Phone</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">${escapeHtml(order.customer_phone)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#b68b2c; font-size:13px;">Order ID</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">${escapeHtml(order.order_id)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#b68b2c; font-size:13px;">Placed</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">${escapeHtml(placedAt)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#b68b2c; font-size:13px;">Order Type</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">${escapeHtml(titleCase(order.order_type))}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px; color:#b68b2c; font-size:13px;">Service Mode</td>
                    <td style="padding:0 0 10px; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">${escapeHtml(serviceMode)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0; color:#b68b2c; font-size:13px;">Payment</td>
                    <td style="padding:0; text-align:right; font-size:14px; font-weight:700; color:#f0e2b6;">
                      ${escapeHtml(paymentLabel)} (${escapeHtml(titleCase(order.payment_status))})
                    </td>
                  </tr>
                </table>
              </div>

              <div style="margin-top:24px; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.14em; color:#b68b2c;">
                Items
              </div>

              <div style="margin-top:10px; background:#313d20; border:1px solid rgba(166,124,0,0.16); border-radius:16px; padding:0 18px;">
                <table style="width:100%; border-collapse:collapse;">
                  ${itemRowsHtml}
                </table>
              </div>

              <div style="margin-top:24px; background:#313d20; border:1px solid rgba(166,124,0,0.16); border-radius:16px; padding:18px;">
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding:6px 0; color:#d8c89a;">Subtotal</td>
                    <td style="padding:6px 0; text-align:right; color:#d8c89a; font-weight:600;">
                      ${formatCurrency(toNumber(order.subtotal))}
                    </td>
                  </tr>
                  ${discountHtml}
                  ${takeawayFeeHtml}
                  ${deliveryFeeHtml}
                  <tr>
                    <td style="padding:14px 0 0; border-top:1px solid rgba(166,124,0,0.22); font-size:18px; font-weight:800; color:#d4a437;">
                      Total
                    </td>
                    <td style="padding:14px 0 0; border-top:1px solid rgba(166,124,0,0.22); text-align:right; font-size:20px; font-weight:800; color:#d4a437;">
                      ${formatCurrency(toNumber(order.total))}
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            <div style="padding:0 28px 28px; text-align:center;">
              <div style="font-size:13px; line-height:1.7; color:#c8b06e;">
                Thank you for ordering with <span style="color:#d4a437; font-weight:700;">The Supreme Waffle</span>.
              </div>
              <div style="margin-top:8px; font-size:11px; line-height:1.6; color:#9f8a56;">
                This is an automated email receipt for your order.
              </div>
            </div>

          </div>
        </div>
      </body>
    </html>
  `;
}

function buildEmailText(order: ReceiptOrder, items: ReceiptItemRow[], isConfirmation: boolean) {
  const rows = buildReceiptRows(items);
  const paymentLabel = paymentMethodLabel(order.payment_method, order.order_type, toNumber(order.total));
  const serviceMode = serviceModeLabel(order);
  const copy = receiptEmailCopy(order, isConfirmation);
  const itemLines = rows
    .map((item) => {
      const customizationLines = item.customizations
        .map((customization) =>
          `  - ${customization.group_name}: ${customization.option_name}${customization.price > 0 ? ` (+${formatCurrency(customization.price)})` : ""}`,
        )
        .join("\n");

      return [
        `${item.item_name} x ${item.quantity} - ${formatCurrency(item.lineTotal)}`,
        customizationLines,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const totals = [
    `Subtotal: ${formatCurrency(toNumber(order.subtotal))}`,
    order.discount > 0
      ? `Discount: -${formatCurrency(toNumber(order.discount))}`
      : "",
    toNumber(order.takeaway_fee) > 0
      ? `Takeaway Charge: ${formatCurrency(toNumber(order.takeaway_fee))}`
      : "",
    order.delivery_fee > 0
      ? `Delivery Fee: ${formatCurrency(toNumber(order.delivery_fee))}`
      : "",
    `Total: ${formatCurrency(toNumber(order.total))}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "The Supreme Waffle",
    copy.title,
    "",
    `${copy.introLead} ${order.order_id}.`,
    "",
    `Order ID: ${order.order_id}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Placed: ${formatPlacedAt(order.placed_at)}`,
    `Order Type: ${titleCase(order.order_type)}`,
    `Service Mode: ${serviceMode}`,
    `Payment: ${paymentLabel} (${titleCase(order.payment_status)})`,
    "",
    "Items:",
    itemLines,
    "",
    totals,
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

    const { orderId, type } = await req.json() as { orderId?: string; type?: string };
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

    const order = orderData as ReceiptOrder | null;

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isConfirmation = type === "confirmation";
    if (!isConfirmation && order.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, error: "Payment is not marked as paid yet" }),
        {
          status: 400,
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

    const { data: itemsData, error: itemsError } = await adminClient
      .from("order_items")
      .select("item_name, quantity, unit_price, customizations")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    const items = (itemsData ?? []) as ReceiptItemRow[];
    const copy = receiptEmailCopy(order, isConfirmation);

    const transport = createSmtpTransport(smtpConfig);
    const fromEmail = smtpConfig.smtp_from_email || smtpConfig.smtp_user;
    const fromName = smtpConfig.smtp_from_name || "The Supreme Waffle";

    const info = await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipient,
      subject: copy.subject,
      html: buildEmailHtml(order, items, isConfirmation),
      text: buildEmailText(order, items, isConfirmation),
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
    console.error("send-order-receipt error:", error);
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
