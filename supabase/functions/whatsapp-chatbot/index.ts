import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Payment domains per company slug - each brand gets its own payment page
const PAYMENT_DOMAINS: Record<string, string> = {
  hariox: "hariox.com",
};

// Also map by company_id directly for 100% accuracy
const COMPANY_ID_DOMAINS: Record<string, string> = {
  default: "hariox.com",
};

const LOAN_INFO = `
## About Hariox
- RBI-compliant loan consultancy
- Partners with 30+ banks and NBFCs
- Personal Loans and Business Loans
- Interest rates starting from 8% p.a.
- Quick approval within 24-48 hours

## Loan Types & Interest Rates
- Personal Loan: 10.5% - 24% p.a., up to ₹40 Lakh
- Business Loan: 12% - 24% p.a., up to ₹50 Lakh

## Eligibility
- Age: 21-65 years
- Income: ₹15,000/month (salaried), ₹2 Lakh/year (self-employed)
- CIBIL: 650+ preferred (we also help low CIBIL)

## Documents
- KYC: Aadhaar, PAN
- Income: 3 months salary slips, 6 months bank statement
- Self-Employed: ITR 2 years, GST returns
`;

const buildSystemPrompt = (paymentLink: string, companyName: string) => `You are a quick loan assistant for ${companyName} on WhatsApp.
Answer loan questions briefly. Help customers apply step by step.

${LOAN_INFO}

RULES:
- Keep responses SHORT (2-3 sentences max)
- Simple language, be friendly and persuasive
- Always lead with BENEFITS of the consulting fee before asking for payment

## ₹799 CONSULTING FEE BENEFITS - Always pitch FIRST!
When a customer shows any interest in a loan, PROACTIVELY share these benefits BEFORE mentioning payment:
- ✅ Dedicated loan expert assigned ONLY to YOUR file
- ✅ We compare 30+ banks to find YOUR lowest interest rate
- ✅ Higher approval chances - we know exactly what each bank needs
- ✅ Document preparation & verification support included
- ✅ Priority processing - approval in 24-48 hours instead of weeks
- ✅ No hidden charges - ₹799 is one-time, fully transparent
- ✅ If loan not approved, we rework with another bank at NO extra cost
- Say: "₹799 is a small investment for the best loan deal. Our experts have helped 10,000+ customers get approved!"

## PAYMENT FLOW (always benefits first, then link)
After collecting lead details, use this exact format:
"🎯 Here's what your ₹799 Consulting Fee includes:
✅ Expert loan matching across 30+ banks
✅ Lowest interest rate guarantee
✅ Priority processing in 24-48 hours
✅ Full document support & verification
✅ Free re-application if loan rejected

Pay here to get started 👇"
[PAYMENT_LINK]

## AGENT ESCALATION
If customer asks to talk to a person, agent, executive:
[AGENT_REQUEST]
Say: "Sure! I'm connecting you with our loan expert. They'll reach out to you shortly. 🙏"
ONLY use [AGENT_REQUEST] when customer explicitly wants human help.

LEAD CAPTURE (when customer wants to apply):
1. Ask NAME (free text)
2. Ask LOAN TYPE with buttons:
   [OPTIONS: title="Select Loan Type", options="Personal Loan|Business Loan"]
3. Ask LOAN AMOUNT (free text)
4. Ask CITY (free text)
5. Ask EMPLOYMENT TYPE with buttons:
   [OPTIONS: title="Employment Type", options="Salaried|Self Employed|Business Owner"]

BUTTON RULES:
- ONLY use [OPTIONS] for Loan Type, Employment Type, Yes/No
- NEVER for Name, Phone, City, Amount
- Max 3 options per [OPTIONS]
- Greeting: [OPTIONS: title="How can I help?", options="Apply for Loan|Check Eligibility|Talk to Expert"]

When ALL details collected (name, loan type, amount, city):
[LEAD_CAPTURE: name="Name", loan_type="personal/business", amount="500000", city="Mumbai"]
Then IMMEDIATELY pitch consulting fee benefits and share the payment link.

After lead capture, always say the benefits then: [PAYMENT_LINK]`;

// System prompt for PAID customers — completely different flow, no repeating questions
const buildPaidCustomerPrompt = (customerName: string, companyName: string, documentUploadLink: string) => `You are a friendly loan processing assistant for ${companyName} on WhatsApp.
This customer (${customerName}) has ALREADY PAID the consulting fee. They are an existing paid customer.

CRITICAL RULES FOR PAID CUSTOMERS:
- NEVER ask for their name, loan type, loan amount, city, employment, income or any details again — you already have them.
- NEVER mention ₹799 fee or payment links to them again.
- DO NOT ask them to fill any form or re-apply.
- Be warm, reassuring and professional.
- Keep responses SHORT (2-3 sentences max).

## WHAT TO TELL PAID CUSTOMERS:
1. Acknowledge their payment and thank them.
2. Tell them our team will call them within 2 working days to guide them through the next steps.
3. Ask them to upload their documents using the link below so we can start processing faster.
4. If they ask about status/progress: Reassure them that the team is working on their file and they will be contacted within 2 working days.
5. If they ask about documents needed: Tell them to upload Aadhaar, PAN, 3 months salary slip, and 6 months bank statement using the document link.
6. If they have any loan questions (rates, tenure, etc.) — answer briefly and helpfully.

## DOCUMENT UPLOAD LINK:
Always share this when relevant: ${documentUploadLink}
Say: "📂 Please upload your KYC documents here to speed up processing: ${documentUploadLink}"

## STANDARD RESPONSE FOR PAID CUSTOMERS:
"Thank you for completing your payment! 🎉 Your application is now in queue with our loan experts.
📞 Our team will call you within *2 working days* to guide you through the next steps.
📂 Meanwhile, please upload your documents here to speed up approval: ${documentUploadLink}"

## AGENT ESCALATION
If customer asks to talk to a person, agent, executive:
[AGENT_REQUEST]
Say: "Sure! I'm connecting you with our loan expert. They'll reach out to you shortly. 🙏"
ONLY use [AGENT_REQUEST] when customer explicitly wants human help.

Remember: This customer has paid. Be reassuring, helpful, and guide them toward document upload and await team contact.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, phone_number, account_id, conversation_history = [] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve company_id and payment domain directly from account_id (exact match, no fuzzy)
    let companyId: string | null = null;
    let companySlug = "hariox";
    let companyName = "Hariox";
    let paymentDomain = "credit.hariox.com";

    try {
      const { data: accData } = await supabase
        .from("whatsapp_accounts")
        .select("company_id")
        .eq("id", account_id)
        .single();

      if (accData?.company_id) {
        companyId = accData.company_id;
        const { data: company } = await supabase
          .from("companies")
          .select("id, name, slug, custom_domain")
          .eq("id", companyId)
          .single();

        if (company) {
          companySlug = company.slug || "hariox";
          companyName = company.name || "Hariox";
          if (company.custom_domain) {
            paymentDomain = company.custom_domain.replace(/\/$/, "");
          } else {
            paymentDomain =
              COMPANY_ID_DOMAINS[companyId!] ||
              PAYMENT_DOMAINS[companySlug] ||
              PAYMENT_DOMAINS[companySlug.split("-")[0]] ||
              "hariox.com";
          }
        }
      }
    } catch { /* ignore, use defaults */ }

    const paymentLink = `https://${paymentDomain}/pay/whatsapp`;

    // Check if this phone number belongs to a PAID lead
    const cleanPhoneForLookup = phone_number.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10);
    const paidStatuses = ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"];

    let leadQueryForStatus = supabase
      .from("leads")
      .select("id, full_name, status")
      .or(`phone.eq.${cleanPhoneForLookup},phone.eq.${phone_number}`);

    if (companyId) {
      leadQueryForStatus = leadQueryForStatus.eq("company_id", companyId);
    }

    const { data: existingLeadForStatus } = await leadQueryForStatus
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isPaidCustomer = existingLeadForStatus && paidStatuses.includes(existingLeadForStatus.status);
    const customerName = existingLeadForStatus?.full_name || "Customer";
    const documentUploadLink = `https://${paymentDomain}/upload`;

    const SYSTEM_PROMPT = isPaidCustomer
      ? buildPaidCustomerPrompt(customerName, companyName, documentUploadLink)
      : buildSystemPrompt(paymentLink, companyName);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversation_history.slice(-6),
      { role: "user", content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages,
        max_tokens: 350,
        temperature: 0.5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            reply: `We're busy right now. Please visit ${paymentDomain} to apply online! 🌐`,
            lead_captured: false 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI service unavailable");
    }

    const aiData = await response.json();
    let reply = aiData.choices?.[0]?.message?.content || `Please visit ${paymentDomain} to apply for a loan! 🌐`;

    // Detect agent escalation request
    const agentRequested = reply.includes("[AGENT_REQUEST]");
    reply = reply.replace(/\[AGENT_REQUEST\]/g, "").trim();

    // Check for lead capture
    const leadPattern = /\[LEAD_CAPTURE:\s*name="([^"]+)",\s*loan_type="([^"]+)",\s*amount="([^"]+)",\s*city="([^"]+)"\]/i;
    const match = reply.match(leadPattern);
    let leadCaptured = false;
    let leadId = null;

    if (match) {
      const [, name, loanType, amount, city] = match;
      reply = reply.replace(leadPattern, "").trim();

      const loanTypeMap: Record<string, string> = {
        personal: "personal", "personal loan": "personal",
        business: "business", "business loan": "business",
        home: "home", education: "education",
        vehicle: "vehicle", gold: "gold", marriage: "marriage",
      };
      const mappedLoanType = loanTypeMap[loanType.toLowerCase()] || "personal";

      const cleanPhone = phone_number.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10);

      let existingLeadQuery = supabase
        .from("leads").select("id, full_name").eq("phone", cleanPhone);

      if (companyId) {
        existingLeadQuery = existingLeadQuery.eq("company_id", companyId);
      }

      const { data: existingLead } = await existingLeadQuery
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (existingLead) {
        await supabase.from("leads").update({
          full_name: name || existingLead.full_name,
          loan_type: mappedLoanType,
          loan_amount: parseInt(amount.replace(/\D/g, "")) || 100000,
          city: city,
          updated_at: new Date().toISOString(),
        }).eq("id", existingLead.id);

        leadCaptured = true;
        leadId = existingLead.id;
      } else {
        const { data: lead, error: leadError } = await supabase
          .from("leads").insert({
            full_name: name, phone: cleanPhone,
            email: `${cleanPhone}@whatsapp.lead`,
            loan_type: mappedLoanType,
            loan_amount: parseInt(amount.replace(/\D/g, "")) || 100000,
            city: city, employment_type: "salaried",
            monthly_income: 25000, source: "whatsapp",
            status: "unpaid", company_id: companyId,
          }).select().single();

        if (!leadError && lead) {
          leadCaptured = true;
          leadId = lead.id;
        }
      }

      // Consulting benefits + payment link after lead capture
      reply += `\n\n🎯 Here's what your ₹799 Consulting Fee includes:\n✅ Expert loan matching across 30+ banks\n✅ Lowest interest rate guarantee\n✅ Priority processing in 24-48 hours\n✅ Full document support & verification\n✅ Free re-application if loan rejected\n\nPay here to get started 👇\n💳 ${paymentLink}`;
    }

    // Replace [PAYMENT_LINK] tags with benefits + actual link
    reply = reply.replace(
      /\[PAYMENT_LINK\]/g,
      `\n🎯 ₹799 Consulting Fee includes:\n✅ 30+ bank comparison\n✅ Lowest rate guarantee\n✅ 24-48hr priority processing\n✅ Free re-application support\n\n💳 ${paymentLink}`
    );

    // Handle agent escalation - flag the conversation
    if (agentRequested) {
      const cleanPhone = phone_number.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10);
      
      let agentLeadId = leadId;
      if (!agentLeadId) {
        let agentLeadQuery = supabase
          .from("leads").select("id, assigned_to")
          .or(`phone.eq.${cleanPhone},phone.eq.${phone_number}`);

        if (companyId) {
          agentLeadQuery = agentLeadQuery.eq("company_id", companyId);
        }

        const { data: existingLead } = await agentLeadQuery
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        agentLeadId = existingLead?.id || null;
      }

      if (agentLeadId) {
        await supabase.from("whatsapp_messages").update({
          needs_agent: true,
        }).eq("lead_id", agentLeadId)
          .eq("phone_number", phone_number)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      const { data: adminRoles } = await supabase
        .from("user_roles").select("user_id").in("role", ["admin", "staff"]);

      const notifyUserIds = new Set<string>();
      (adminRoles || []).forEach((r: any) => notifyUserIds.add(r.user_id));

      const notifications = Array.from(notifyUserIds).map(uid => ({
        user_id: uid,
        type: "live_agent_request",
        title: "🆘 Customer Wants to Talk to Agent",
        message: `WhatsApp customer ${phone_number} requested human support via AI chatbot`,
        link: "/admin/dashboard/inbox",
        metadata: { lead_id: agentLeadId, phone: phone_number, account_id, source: "chatbot_escalation" },
      }));

      if (notifications.length > 0) {
        await supabase.from("staff_notifications").insert(notifications);
      }
    }

    // Parse [OPTIONS] for interactive buttons
    const optionsPattern = /\[OPTIONS:\s*title="([^"]+)",\s*options="([^"]+)"\]/g;
    const interactiveButtons: Array<{ title: string; options: string[] }> = [];
    let cleanReply = reply;

    let optMatch;
    while ((optMatch = optionsPattern.exec(reply)) !== null) {
      const [fullMatch, title, optionsStr] = optMatch;
      const options = optionsStr.split("|").map((o: string) => o.trim()).slice(0, 3);
      interactiveButtons.push({ title, options });
      cleanReply = cleanReply.replace(fullMatch, "").trim();
    }

    return new Response(
      JSON.stringify({ 
        reply: cleanReply, 
        lead_captured: leadCaptured,
        lead_id: leadId,
        agent_requested: agentRequested,
        interactive_buttons: interactiveButtons.length > 0 ? interactiveButtons : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("WhatsApp chatbot error:", error);
    return new Response(
      JSON.stringify({ 
        reply: "Our team will reach out to you shortly. You can also visit hariox.com to apply online! 🌐",
        lead_captured: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
