import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  const requested = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      requested ??
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get user roles
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    
    const { action, domain, company_id } = await req.json();

    if (!action || !domain) {
      return new Response(
        JSON.stringify({ error: "Missing action or domain" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Authorization check
    if (!isAdmin) {
      // Check if user is the franchise owner of this company
      const { data: ownerCompany } = await supabaseAdmin
        .from("franchise_owner_companies")
        .select("company_id")
        .eq("user_id", userData.user.id)
        .eq("company_id", company_id)
        .maybeSingle();

      if (!ownerCompany) {
        return new Response(
          JSON.stringify({ error: "Unauthorized to manage domain for this company" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfZoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");

    if (!cfToken || !cfZoneId) {
      // Fallback/Mocked response when credentials are not configured, so the flow remains functional.
      console.warn("Cloudflare API credentials not configured in Supabase environment secrets.");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Cloudflare credentials not configured. Showing instructions setup mode.",
          mocked: true,
          validation_records: [
            {
              txt_name: `_cf-custom-hostname.${domain}`,
              txt_value: "verify-owner-txt-records-once-keys-are-entered-in-cloudflare"
            }
          ],
          ssl_status: "pending_validation"
        }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const headers = {
      "Authorization": `Bearer ${cfToken}`,
      "Content-Type": "application/json"
    };

    if (action === "create") {
      // 1. Search if it exists first
      const searchRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${domain}`,
        { method: "GET", headers }
      );
      const searchData = await searchRes.json();

      if (searchData.success && searchData.result && searchData.result.length > 0) {
        // Already exists
        return new Response(
          JSON.stringify({ success: true, message: "Domain already registered in Cloudflare", result: searchData.result[0] }),
          { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // 2. Create Custom Hostname
      const createRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            hostname: domain,
            ssl: {
              method: "txt",
              type: "dv"
            }
          })
        }
      );
      const createData = await createRes.json();

      if (!createData.success) {
        return new Response(
          JSON.stringify({ success: false, error: createData.errors?.[0]?.message || "Cloudflare API Error", details: createData }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Custom hostname registered successfully", result: createData.result }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );

    } else if (action === "status") {
      const statusRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${domain}`,
        { method: "GET", headers }
      );
      const statusData = await statusRes.json();

      if (!statusData.success) {
        return new Response(
          JSON.stringify({ success: false, error: statusData.errors?.[0]?.message || "Cloudflare API Error" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      if (!statusData.result || statusData.result.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Domain not registered in Cloudflare yet." }),
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const hostnameObj = statusData.result[0];
      const ssl = hostnameObj.ssl || {};
      const validationRecords = ssl.validation_records || [];

      return new Response(
        JSON.stringify({ 
          success: true, 
          ssl_status: ssl.status, 
          validation_records: validationRecords.map((r: any) => ({
            txt_name: r.txt_name,
            txt_value: r.txt_value
          })),
          raw: hostnameObj
        }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );

    } else if (action === "delete") {
      // 1. Search ID
      const searchRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${domain}`,
        { method: "GET", headers }
      );
      const searchData = await searchRes.json();

      if (!searchData.success || !searchData.result || searchData.result.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "Domain not found on Cloudflare, nothing to delete." }),
          { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const id = searchData.result[0].id;

      // 2. Delete Custom Hostname
      const deleteRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames/${id}`,
        { method: "DELETE", headers }
      );
      const deleteData = await deleteRes.json();

      if (!deleteData.success) {
        return new Response(
          JSON.stringify({ success: false, error: deleteData.errors?.[0]?.message || "Cloudflare API Error" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Domain deleted successfully from Cloudflare." }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Cloudflare Edge Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
