import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Infer company slug from request hostname - ONLY for known hariox subdomains
// Custom franchise domains (like finance.fundkredit.com) must use custom_domain DB lookup
const inferCompanySlugFromHostname = (hostname: string): string | null => {
  const host = hostname.toLowerCase();
  if (host === "capital.hariox.com" || host.includes("capital.hariox") || host.includes("capital-hariox")) return "hariox";
  if (host === "finance.hariox.com" || host.includes("finance.hariox") || host.includes("finance-hariox")) return "hariox";
  if (host === "credit.hariox.com" || host.includes("credit.hariox") || host.includes("credit-hariox")) return "hariox";
  if (host.includes("finance.fundkredit") || host.includes("fundkredit")) return "hariox";
  if (host.includes("hariox")) return "hariox";
  return null;
};

const getHostnameFromRequest = (req: Request): string | null => {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {}
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {}
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const cleanPhone = phone.length > 10 ? phone.slice(-10) : phone;
    const code = String(body.code || "").trim();

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^\d{4,6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid OTP format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve company_id based on explicit body parameter or request origin
    let companyId = body.company_id || null;
    
    if (!companyId) {
      const hostname = getHostnameFromRequest(req);
      if (hostname) {
        const { data: matchedDomains } = await supabase
          .from("companies")
          .select("id")
          .ilike("custom_domain", `%${hostname}%`)
          .eq("is_active", true)
          .limit(1);

        const matchedDomain = matchedDomains?.[0] || null;

        if (matchedDomain?.id) {
          companyId = matchedDomain.id;
        } else {
          const inferredSlug = inferCompanySlugFromHostname(hostname);
          if (inferredSlug) {
            const { data: company } = await supabase
              .from("companies")
              .select("id")
              .eq("slug", inferredSlug)
              .eq("is_active", true)
              .maybeSingle();
            if (company?.id) companyId = company.id;
          }
        }
      }
    }

    // Helper: SHA-256 hash
    async function hashCode(val: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(val);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    // Find the latest unexpired, unverified OTP for this phone & company
    const now = new Date().toISOString();
    let otpQuery = supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", cleanPhone)
      .eq("verified", false)
      .gte("expires_at", now);

    if (companyId) {
      otpQuery = otpQuery.eq("company_id", companyId);
    }

    const { data: otpRecord, error: fetchError } = await otpQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("verify-otp:fetch_error", fetchError);
      throw new Error("Failed to verify OTP");
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP expired or not found. Please request a new one." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max attempts (5)
    if (otpRecord.attempts >= 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many attempts. Please request a new OTP." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify code using hash comparison
    const inputHash = await hashCode(code);
    const storedHash = otpRecord.hashed_code;
    // Support both hashed (new) and plain (legacy) codes
    const isMatch = storedHash ? (inputHash === storedHash) : false;
    if (!isMatch) {
      const attemptsLeft = 4 - otpRecord.attempts;
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: attemptsLeft > 0 
            ? `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
            : "Invalid OTP. Please request a new one."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    console.log("verify-otp:success", { phone: cleanPhone });

    return new Response(
      JSON.stringify({ success: true, message: "OTP verified successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("verify-otp:error", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
