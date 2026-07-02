// Proxies WhatsApp/Meta media URLs (scontent.whatsapp.net etc.) so browsers can render them.
// These CDN URLs sometimes require server-side fetching due to hotlink/referrer protections.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url param", { status: 400, headers: corsHeaders });
    }

    // Only allow Meta/WhatsApp CDN hosts for safety
    const allowed = /(^https:\/\/[\w.-]*\.(whatsapp|fbcdn|facebook)\.(net|com)\/)/i;
    if (!allowed.test(target)) {
      return new Response("Host not allowed", { status: 400, headers: corsHeaders });
    }

    const accessToken = Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");
    const resp = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 WhatsAppMediaProxy",
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
    });

    if (!resp.ok) {
      return new Response(`Upstream ${resp.status}`, { status: resp.status, headers: corsHeaders });
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const buf = await resp.arrayBuffer();

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
