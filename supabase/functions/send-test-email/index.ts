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
        JSON.stringify({ success: false, error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { to } = await req.json() as { to?: string };
    const recipient = to?.trim();

    if (!recipient) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const requestClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await requestClient.auth.getUser();
    const requester = authData.user;

    if (authError || !requester) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data, error } = await adminClient
      .from("site_settings")
      .select("smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not load SMTP settings from database" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const config = data as SmtpConfig;

    if (!config.smtp_pass) {
      const envPass = Deno.env.get("SMTP_PASS") || "";
      if (envPass) {
        config.smtp_pass = envPass;
      }
    }

    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SMTP is not fully configured. Please set host, username, and password.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const transport = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_port === 465,
      auth: { user: config.smtp_user, pass: config.smtp_pass },
      tls: { rejectUnauthorized: false },
    });

    const fromEmail = config.smtp_from_email || config.smtp_user;
    const fromName = config.smtp_from_name || "The Supreme Waffle";

    const info = await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipient,
      subject: "Test email from The Supreme Waffle",
      html: `
        <!doctype html>
        <html lang="en">
          <body style="margin:0; background:#f5f5f4; font-family:Arial, Helvetica, sans-serif; color:#111827;">
            <div style="max-width:680px; margin:0 auto; padding:32px 16px;">
              <div style="background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 12px 40px rgba(17,24,39,0.08);">
                <div style="background:linear-gradient(135deg, #7c2d12, #f59e0b); padding:28px 32px; color:#ffffff;">
                  <div style="font-size:13px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.9;">
                    The Supreme Waffle
                  </div>
                  <h1 style="margin:10px 0 0; font-size:28px; line-height:1.2;">
                    SMTP Test Successful
                  </h1>
                </div>
                <div style="padding:28px 32px;">
                  <p style="font-size:15px; line-height:1.6; color:#374151;">
                    This is a test email confirming that your SMTP settings are working correctly.
                    Order receipts and notifications will be sent from <strong>${fromEmail}</strong>.
                  </p>
                  <p style="font-size:13px; color:#6b7280; margin-top:16px;">
                    SMTP Host: ${config.smtp_host}:${config.smtp_port}<br/>
                    Sent at: ${new Date().toISOString()}
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `The Supreme Waffle - SMTP Test Successful\n\nThis is a test email confirming that your SMTP settings are working correctly.\nOrder receipts and notifications will be sent from ${fromEmail}.\n\nSMTP Host: ${config.smtp_host}:${config.smtp_port}\nSent at: ${new Date().toISOString()}`,
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
    console.error("send-test-email error:", error);
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
