// Public lead capture API — hardcoded to Capital Hariox
// Upsert-by-phone: same phone within Capital company updates the existing lead
// instead of creating a duplicate.
import { createClient } from "npm:@supabase/supabase-js@2";

const CAPITAL_COMPANY_ID = "bbe9fc5c-0caf-458e-aada-fa33143c4ff4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Columns on public.leads that we are allowed to write from the public API.
// Anything else in the incoming payload is ignored (so unknown keys like
// `payment_status` / `order_id` / `membership_amount` don't blow up the insert).
const ALLOWED_COLUMNS = new Set([
  "full_name", "email", "phone", "city", "state", "pincode",
  "loan_type", "loan_amount", "monthly_income", "employment_type",
  "emi_amount", "current_monthly_emi", "tenure_months", "interest_rate",
  "cibil_score_range", "is_interested", "emi_bounce_last_6_months",
  "status", "source",
  "utm_source", "utm_medium", "utm_campaign",
  "meta_fbc", "meta_fbp",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!["GET", "POST"].includes(req.method)) {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const body = await parseRequestData(req);
    console.log("[capture-lead-capital] request", { method: req.method, keys: Object.keys(body) });

    const pick = (...keys: string[]) =>
      keys.map((k) => body?.[k]).find((v) => v !== undefined && v !== null && v !== "");

    const phoneRaw = pick("phone", "mobile", "phone_number", "mobile_number", "contact", "Phone", "Mobile", "Phone Number", "Mobile Number");
    const phone = String(phoneRaw ?? "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return json({ success: false, error: "Invalid phone (must be 10-digit Indian mobile)", received: { phone: phoneRaw } }, 400);
    }

    const rawCity = pick("city", "City", "location", "Location");
    const rawState = pick("state", "State");
    const { city, state } = splitCityState(rawCity, rawState);
    const rawSource = pick("source", "Source");

    // Build a normalised candidate object; only include keys when the caller actually provided a value.
    const candidate: Record<string, unknown> = { phone };

    const fullName = pick("full_name", "name", "fullName", "customer_name", "first_name", "Full Name", "Name", "Customer Name");
    if (fullName) candidate.full_name = String(fullName).trim().slice(0, 100);

    const email = pick("email", "Email", "email_id", "Email ID");
    if (email) candidate.email = String(email).trim().toLowerCase().slice(0, 255);

    if (city) candidate.city = String(city).trim().slice(0, 100);
    if (state) candidate.state = String(state).trim().slice(0, 50);

    const loanType = pick("loan_type", "loanType", "loan_purpose", "Loan Purpose", "product");
    if (loanType !== undefined) candidate.loan_type = normalizeLoanType(loanType);

    const loanAmount = pick("loan_amount", "loanAmount", "amount", "Loan Amount", "loan_required");
    if (loanAmount !== undefined) candidate.loan_amount = parseAmount(loanAmount);

    const monthlyIncome = pick("monthly_income", "monthlyIncome", "income", "salary", "Monthly Income", "monthly_salary");
    if (monthlyIncome !== undefined) candidate.monthly_income = parseAmount(monthlyIncome);

    const employment = pick("employment_type", "employmentType", "user_type", "User Type");
    if (employment !== undefined) candidate.employment_type = normalizeEmployment(employment) ?? "salaried";

    const cibil = normalizeCibil(pick("cibil_score_range", "cibilScoreRange", "cibil_score", "cibilScore", "cibil", "CIBIL Score"));
    if (cibil !== undefined) candidate.cibil_score_range = cibil;

    const currentEmi = pick("current_monthly_emi", "currentMonthlyEmi", "monthly_emi", "monthlyEmi", "emi_amount", "Monthly EMI");
    if (currentEmi !== undefined && currentEmi !== null && currentEmi !== "") {
      const n = Number(currentEmi);
      if (Number.isFinite(n)) candidate.current_monthly_emi = n;
    }

    // Status: accept either `status` or `payment_status` ("paid"/"unpaid"/"success"/"failed").
    const paymentStatusRaw = pick("payment_status", "paymentStatus", "Payment Status");
    const mappedFromPayment = mapPaymentStatus(paymentStatusRaw);
    const statusVal = normalizeStatus(pick("status", "Status")) ?? mappedFromPayment;
    if (statusVal) candidate.status = statusVal;

    // Optional payment metadata (used to create/update a payments row when paid)
    const orderId = pick("order_id", "orderId", "Order ID", "razorpay_order_id");
    const membershipAmountRaw = pick("membership_amount", "membershipAmount", "amount_paid", "Membership Amount");
    const membershipAmount = membershipAmountRaw !== undefined ? parseAmount(membershipAmountRaw) : 0;

    if (rawSource) candidate.source = cleanSource(rawSource);

    const utmSource = pick("utm_source", "utmSource");
    if (utmSource) candidate.utm_source = String(utmSource);
    const utmMedium = pick("utm_medium", "utmMedium");
    if (utmMedium) candidate.utm_medium = String(utmMedium);
    const utmCampaign = pick("utm_campaign", "utmCampaign");
    if (utmCampaign) candidate.utm_campaign = String(utmCampaign);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing, error: lookupError } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", phone)
      .eq("company_id", CAPITAL_COMPANY_ID)
      .maybeSingle();

    if (lookupError) {
      console.error("[capture-lead-capital] lookup error", lookupError);
      return json({ success: false, error: lookupError.message }, 500);
    }

    if (existing) {
      // UPDATE: only overwrite columns with non-empty incoming values.
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(candidate)) {
        if (k === "phone") continue; // never rewrite the matching key
        if (!ALLOWED_COLUMNS.has(k)) continue;
        if (v === null || v === undefined || v === "") continue;
        updates[k] = v;
      }
      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", existing.id);

      if (updateError) {
        console.error("[capture-lead-capital] update error", updateError);
        return json({ success: false, error: updateError.message }, 500);
      }

      await recordPaymentIfPaid(supabase, existing.id, candidate.status as string | undefined, orderId, membershipAmount);
      await fireWorkflows(supabase, existing.id, candidate.status as string | undefined, false);
      return json({ success: true, updated: true, id: existing.id, lead_id: existing.id, status: candidate.status ?? null, company: "Capital Hariox" });
    }

    // INSERT with safe defaults for NOT NULL columns.
    const insertRow: Record<string, unknown> = {
      phone,
      full_name: candidate.full_name ?? `API Lead ${phone}`,
      email: candidate.email ?? `${phone}@fundkredit.lead`,
      city: candidate.city ?? "Not specified",
      state: candidate.state ?? null,
      loan_type: candidate.loan_type ?? "personal",
      loan_amount: candidate.loan_amount ?? 0,
      monthly_income: candidate.monthly_income ?? 0,
      employment_type: candidate.employment_type ?? "salaried",
      status: candidate.status ?? "unpaid",
      source: candidate.source ?? "fundkredit",
      company_id: CAPITAL_COMPANY_ID,
      utm_source: candidate.utm_source ?? null,
      utm_medium: candidate.utm_medium ?? null,
      utm_campaign: candidate.utm_campaign ?? null,
      cibil_score_range: candidate.cibil_score_range ?? null,
      current_monthly_emi: candidate.current_monthly_emi ?? 0,
    };

    const { data: ins, error: insertError } = await supabase
      .from("leads")
      .insert(insertRow)
      .select("id")
      .single();

    if (insertError) {
      console.error("[capture-lead-capital] insert error", insertError);
      return json({ success: false, error: insertError.message }, 500);
    }

    await recordPaymentIfPaid(supabase, ins.id, insertRow.status as string | undefined, orderId, membershipAmount);
    await fireWorkflows(supabase, ins.id, insertRow.status as string | undefined, true);
    return json({ success: true, inserted: true, id: ins.id, lead_id: ins.id, status: insertRow.status ?? null, company: "Capital Hariox" });
  } catch (e) {
    console.error("[capture-lead-capital] exception", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function parseRequestData(req: Request): Promise<Record<string, unknown>> {
  const url = new URL(req.url);
  const queryData = Object.fromEntries(url.searchParams.entries());
  if (req.method === "GET") return queryData;

  const contentType = req.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("application/json")) {
    const jsonBody = await req.json().catch(() => ({}));
    return { ...queryData, ...(jsonBody && typeof jsonBody === "object" ? jsonBody : {}) };
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    return { ...queryData, ...(form ? Object.fromEntries(form.entries()) : {}) };
  }
  const text = await req.text().catch(() => "");
  if (!text.trim()) return queryData;
  try {
    const parsed = JSON.parse(text);
    return { ...queryData, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    const params = new URLSearchParams(text);
    return { ...queryData, ...Object.fromEntries(params.entries()) };
  }
}

function normalizeCibil(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const raw = String(value).trim().toLowerCase();
  const numeric = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(numeric) && numeric > 0) {
    if (numeric >= 750) return "750+";
    if (numeric >= 650) return "650-750";
    if (numeric >= 550) return "550-650";
    return "below-550";
  }
  if (["750+", "750-plus", "750 plus", "excellent"].includes(raw)) return "750+";
  if (["650-750", "650 to 750", "good", "700-749", "650-699"].includes(raw)) return "650-750";
  if (["550-650", "550 to 650", "fair"].includes(raw)) return "550-650";
  if (["below-550", "below 550", "below_550", "poor", "below_650"].includes(raw)) return "below-550";
  if (["unknown", "no-credit", "no credit", "no_score", "no score", "na", "n/a"].includes(raw)) return "unknown";
  return undefined;
}

function normalizeStatus(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const allowed = ["unpaid","paid","verification","documents_pending","documents_uploaded","verified","rejected","processing","approved","disbursed","lost"];
  const v = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.includes(v) ? v : undefined;
}

function mapPaymentStatus(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const v = String(value).trim().toLowerCase();
  if (["paid","success","successful","completed","captured","settled","1","true","yes"].includes(v)) return "paid";
  if (["unpaid","pending","failed","cancelled","canceled","0","false","no"].includes(v)) return "unpaid";
  return undefined;
}

function normalizeLoanType(value: unknown) {
  if (value === undefined || value === null || value === "") return "personal";
  const raw = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["home","housing","home_loan"].includes(raw)) return "home";
  if (["business","business_loan","msme"].includes(raw)) return "business";
  if (["education","study","education_loan"].includes(raw)) return "education";
  if (["vehicle","car","auto","vehicle_loan"].includes(raw)) return "vehicle";
  if (["gold","gold_loan"].includes(raw)) return "gold";
  if (["marriage","wedding"].includes(raw)) return "marriage";
  return "personal";
}

function parseAmount(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const amount = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeEmployment(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const raw = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["salaried","salary","employee"].includes(raw)) return "salaried";
  if (["self_employed","selfemployed","self"].includes(raw)) return "self_employed";
  if (["business_owner","business","businessowner","owner"].includes(raw)) return "business_owner";
  return "salaried";
}

function splitCityState(cityValue: unknown, stateValue: unknown) {
  const cityText = cityValue === undefined || cityValue === null ? "" : String(cityValue).trim();
  const stateText = stateValue === undefined || stateValue === null ? "" : String(stateValue).trim();
  if (stateText || !cityText.includes(",")) return { city: cityText, state: stateText || undefined };
  const [cityPart, ...stateParts] = cityText.split(",");
  return { city: cityPart.trim(), state: stateParts.join(",").trim() || undefined };
}

function cleanSource(value: unknown) {
  const source = value === undefined || value === null || value === "" ? "fundkredit" : String(value).trim();
  const baseSource = source.split(";")[0].trim();
  if (baseSource.toLowerCase().startsWith("fundkredit")) return "fundkredit";
  return baseSource.slice(0, 100) || "fundkredit";
}

async function recordPaymentIfPaid(
  supabase: any,
  leadId: string,
  status: string | undefined,
  orderId: unknown,
  membershipAmount: number,
) {
  if (status !== "paid") return;
  try {
    const total = membershipAmount && membershipAmount > 0 ? membershipAmount : 799;
    const base = +(total / 1.18).toFixed(2);
    const gst = +(total - base).toFixed(2);
    const orderIdStr = orderId ? String(orderId).slice(0, 200) : null;

    let paymentRow: any = null;

    if (orderIdStr) {
      const { data: existing } = await supabase
        .from("payments")
        .select("id, lead_id, amount, gst_amount, total_amount, company_id")
        .eq("razorpay_order_id", orderIdStr)
        .maybeSingle();
      if (existing) {
        const { data: upd } = await supabase.from("payments").update({
          status: "captured",
          payment_date: new Date().toISOString(),
          amount: base,
          gst_amount: gst,
          total_amount: total,
        }).eq("id", existing.id).select("id, lead_id, amount, gst_amount, total_amount, company_id").maybeSingle();
        paymentRow = upd ?? existing;
      }
    }

    if (!paymentRow) {
      const { data: ins } = await supabase.from("payments").insert({
        lead_id: leadId,
        company_id: CAPITAL_COMPANY_ID,
        amount: base,
        gst_amount: gst,
        total_amount: total,
        status: "captured",
        payment_source: "direct",
        razorpay_order_id: orderIdStr,
        payment_date: new Date().toISOString(),
      }).select("id, lead_id, amount, gst_amount, total_amount, company_id").maybeSingle();
      paymentRow = ins;
    }

    // Stop remarketing
    await supabase
      .from("remarketing_cycles")
      .update({ status: "stopped" })
      .eq("lead_id", leadId)
      .eq("status", "active");

    // Auto-generate GST invoice
    if (paymentRow?.id) {
      try {
        const { data: existingInvoice } = await supabase
          .from("gst_invoices")
          .select("id")
          .eq("payment_id", paymentRow.id)
          .maybeSingle();

        if (!existingInvoice) {
          const { data: lead } = await supabase
            .from("leads")
            .select("full_name, email, phone")
            .eq("id", leadId)
            .single();

          if (lead) {
            const { data: invoiceNum } = await supabase.rpc("generate_invoice_number", {
              p_company_id: CAPITAL_COMPANY_ID,
            });
            const invoiceNumber = invoiceNum || `INV/${Date.now()}`;

            const { error: invErr } = await supabase.from("gst_invoices").insert({
              invoice_number: invoiceNumber,
              lead_id: leadId,
              payment_id: paymentRow.id,
              company_id: CAPITAL_COMPANY_ID,
              customer_name: lead.full_name,
              customer_email: lead.email,
              customer_phone: lead.phone,
              amount: paymentRow.amount,
              gst_amount: paymentRow.gst_amount,
              total_amount: paymentRow.total_amount,
              invoice_date: new Date().toISOString().split("T")[0],
              status: "generated",
            });
            if (invErr) console.error("[capture-lead-capital] invoice insert error", invErr);
            else console.log("[capture-lead-capital] invoice generated", invoiceNumber);
          }
        }
      } catch (invE) {
        console.error("[capture-lead-capital] invoice exception", invE);
      }
    }

    // Activity log
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: "payment_completed",
      details: { razorpay_order_id: orderIdStr, payment_source: "direct", source: "capture-lead-capital" },
    }).then(() => {}, () => {});
  } catch (err) {
    console.error("[capture-lead-capital] payment record error", err);
  }
}

async function fireWorkflows(
  supabase: any,
  leadId: string,
  status: string | undefined,
  isNew: boolean,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const invoke = async (payload: Record<string, unknown>) => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/execute-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ ...payload, lead_id: leadId, company_id: CAPITAL_COMPANY_ID }),
      });
    } catch (e) {
      console.error("[capture-lead-capital] workflow error", payload, e);
    }
  };

  if (isNew) {
    await invoke({ trigger_type: "lead_created" });
  }

  if (status === "paid") {
    await invoke({ trigger_type: "payment_received" });
    await invoke({ trigger_type: "status_changed", from_status: "unpaid", to_status: "paid" });

    // Payment success SMS
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone")
        .eq("id", leadId)
        .maybeSingle();
      if (lead?.phone) {
        await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ type: "payment_success", phone: lead.phone, leadId }),
        });
      }
    } catch (smsErr) {
      console.error("[capture-lead-capital] sms error", smsErr);
    }
  } else if (status && status !== "unpaid") {
    await invoke({ trigger_type: "status_changed", to_status: status });
  }
}
