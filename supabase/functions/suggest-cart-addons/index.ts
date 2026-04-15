import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SuggestionItemInput {
  menu_item_id?: string;
  name?: string;
  category_name?: string;
  quantity?: number;
  price?: number;
}

interface SuggestCartAddOnsBody {
  cartItems?: SuggestionItemInput[];
  candidateItems?: SuggestionItemInput[];
  limit?: number;
}

interface OpenRouterChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: string | undefined) {
  return (value || "").trim();
}

function clampLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 4;
  return Math.min(4, Math.max(1, Math.floor(value!)));
}

function getMessageText(message: OpenRouterChoice["message"] | undefined) {
  const content = message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();
  }

  return "";
}

function parseSuggestionPayload(rawText: string) {
  const directParse = () => JSON.parse(rawText) as {
    suggestions?: Array<{ menu_item_id?: string; reason?: string | null }>;
  };

  try {
    return directParse();
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI response was not valid JSON");
    }

    return JSON.parse(match[0]) as {
      suggestions?: Array<{ menu_item_id?: string; reason?: string | null }>;
    };
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
    const body = await req.json() as SuggestCartAddOnsBody;
    const cartItems = Array.isArray(body.cartItems) ? body.cartItems : [];
    const candidateItems = Array.isArray(body.candidateItems) ? body.candidateItems : [];
    const limit = clampLimit(body.limit);

    if (cartItems.length === 0 || candidateItems.length === 0) {
      return jsonResponse({ success: true, suggestions: [] });
    }

    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const openRouterModel = Deno.env.get("OPENROUTER_MODEL");

    if (!openRouterApiKey || !openRouterModel) {
      return jsonResponse({ success: false, error: "OpenRouter is not configured" }, 503);
    }

    const cleanedCartItems = cartItems.map((item) => ({
      menu_item_id: normalizeText(item.menu_item_id),
      name: normalizeText(item.name),
      category_name: normalizeText(item.category_name),
      quantity: Number(item.quantity ?? 1),
    })).filter((item) => item.menu_item_id && item.name);

    const cleanedCandidateItems = candidateItems.map((item) => ({
      menu_item_id: normalizeText(item.menu_item_id),
      name: normalizeText(item.name),
      category_name: normalizeText(item.category_name),
      price: Number(item.price ?? 0),
    })).filter((item) => item.menu_item_id && item.name);

    if (cleanedCartItems.length === 0 || cleanedCandidateItems.length === 0) {
      return jsonResponse({ success: true, suggestions: [] });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterModel,
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
        provider: {
          require_parameters: true,
        },
        messages: [
          {
            role: "system",
            content: [
              "You recommend add-on drinks for a food ordering cart.",
              "Only choose from the provided candidateItems.",
              "Focus on water bottles and cool drinks that fit savory snack orders.",
              "Never suggest an item already in the cart.",
              `Return JSON only in the form {"suggestions":[{"menu_item_id":"...","reason":"..."}]}.`,
              `Choose at most ${limit} items.`,
              "If nothing fits, return {\"suggestions\":[]}.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              cartItems: cleanedCartItems,
              candidateItems: cleanedCandidateItems,
              limit,
            }),
          },
        ],
      }),
    });

    const payload = await response.json() as OpenRouterResponse;

    if (!response.ok) {
      const message = payload.error?.message || `OpenRouter request failed with status ${response.status}`;
      return jsonResponse({ success: false, error: message }, 502);
    }

    const messageText = getMessageText(payload.choices?.[0]?.message);
    if (!messageText) {
      return jsonResponse({ success: true, suggestions: [] });
    }

    const parsed = parseSuggestionPayload(messageText);
    const validIds = new Set(cleanedCandidateItems.map((item) => item.menu_item_id));
    const seenIds = new Set<string>();

    const suggestions = (parsed.suggestions || [])
      .map((item) => ({
        menu_item_id: normalizeText(item.menu_item_id),
        reason: normalizeText(item.reason || undefined) || null,
      }))
      .filter((item) => item.menu_item_id && validIds.has(item.menu_item_id))
      .filter((item) => {
        if (seenIds.has(item.menu_item_id)) {
          return false;
        }
        seenIds.add(item.menu_item_id);
        return true;
      })
      .slice(0, limit);

    return jsonResponse({
      success: true,
      suggestions,
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
