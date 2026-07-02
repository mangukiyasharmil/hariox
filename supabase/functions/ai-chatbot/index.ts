import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSystemPrompt = (company: string = "hariox") => {
  const companyName = company === "hariox" ? "Capital Hariox" : "Credit Hariox";
  
  return `You are a friendly and professional loan assistant for ${companyName}, a trusted loan consultancy in India. Your role is to help customers with loan-related queries.

## About ${companyName}
- RBI-compliant loan consultancy
- Partners with 30+ banks and NBFCs
- Provides Home Loans, Personal Loans, Business Loans, Education Loans, Vehicle Loans, Gold Loans, and Marriage Loans
- Interest rates starting from 8% p.a.
- Quick approval within 24-48 hours
- WhatsApp support: +91 84693 91818

## Loan Types & Interest Rates
- Personal Loan: 10.5% - 24% p.a., up to ₹40 Lakh
- Home Loan: 8% - 12% p.a., up to ₹5 Crore
- Business Loan: 12% - 24% p.a., up to ₹50 Lakh
- Education Loan: 8% - 14% p.a., up to ₹1 Crore
- Vehicle Loan: 8% - 15% p.a., up to ₹50 Lakh
- Gold Loan: 7% - 12% p.a., up to ₹50 Lakh

## Eligibility Criteria
- Age: 21-65 years
- Minimum income: ₹15,000/month (salaried), ₹2 Lakh/year (self-employed)
- CIBIL Score: 650+ preferred (we also help low CIBIL customers)
- Employment: Minimum 1 year work experience

## Required Documents
- KYC: Aadhaar Card, PAN Card
- Income Proof: 3 months salary slips, 6 months bank statement
- For Self-Employed: ITR for 2 years, GST returns
- Address Proof: Utility bill, Rent agreement
- Business Loan: Business registration, GST certificate

## IMPORTANT: Interactive Options Format
When asking the customer a question where they need to choose, ALWAYS provide clickable options using this EXACT format:

[OPTIONS]
- Option text 1
- Option text 2
- Option text 3
[/OPTIONS]

Examples of when to use options:
- When asking which loan type they want: provide loan type options
- When asking about employment type: Salaried, Self-Employed, Business Owner
- When asking about CIBIL score range: provide score ranges
- When asking yes/no questions: Yes, No
- When asking what info they need: provide topic options

ALWAYS use options when there are predefined choices. This makes it easier for the customer.

## Lead Collection Flow
When a customer shows interest in applying for a loan, collect their details step by step using options where possible:
1. First ask: What type of loan? (use options)
2. Ask: Loan amount needed?
3. Ask: Employment type? (use options: Salaried, Self-Employed, Business Owner)
4. Ask: Your full name?
5. Ask: Your phone number (10 digits)?
6. Ask: Your city?

When you have collected ALL these details (loan_type, amount, name, phone, city), output this EXACT tag at the end of your message:
[LEAD_CAPTURE: name="Customer Name", loan_type="personal/home/business/education/vehicle/gold/marriage", amount="500000", city="Mumbai", phone="9876543210"]

After capturing the lead, tell them: "Your application has been registered! To proceed with quick processing, please complete the payment here:" and include the payment link.

## Your Guidelines
1. Be helpful, concise, and professional
2. ALWAYS use [OPTIONS] format when presenting choices
3. Encourage users to apply through the website or WhatsApp
4. If you don't know something specific, suggest contacting support
5. Use bullet points and formatting for clarity
6. Never make up information - if unsure, direct to human support
7. Be empathetic to financial concerns
8. Highlight benefits and quick turnaround times
9. Always refer to the company as "${companyName}"
10. Keep responses SHORT and conversational

Remember: You're here to help customers understand their options and guide them towards applying for a loan that suits their needs.`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, company, capture_lead } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Handle lead capture request from frontend
    if (capture_lead) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { name, loan_type, amount, city, phone, company_id } = capture_lead;
      
      // Resolve company_id - use provided or fetch default
      let resolvedCompanyId = company_id;
      if (!resolvedCompanyId) {
        const { data: defaultCompany } = await supabase
          .from("companies")
          .select("id")
          .eq("is_active", true)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        resolvedCompanyId = defaultCompany?.id || null;
      }

      const loanTypeMap: Record<string, string> = {
        personal: "personal",
        home: "home",
        business: "business",
        education: "education",
        vehicle: "vehicle",
        gold: "gold",
        marriage: "marriage",
      };
      const mappedLoanType = loanTypeMap[loan_type?.toLowerCase()] || "personal";

      // Check if lead already exists
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      let existingLeadQuery = supabase
        .from("leads")
        .select("id")
        .eq("phone", cleanPhone);

      if (resolvedCompanyId) {
        existingLeadQuery = existingLeadQuery.eq("company_id", resolvedCompanyId);
      }

      const { data: existingLead } = await existingLeadQuery.maybeSingle();

      let leadId = existingLead?.id;
      let isNew = false;

      if (!existingLead) {
        isNew = true;
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .insert({
            full_name: name,
            phone: cleanPhone,
            email: `${cleanPhone}@chatbot.lead`,
            loan_type: mappedLoanType,
            loan_amount: parseInt(amount?.replace(/\D/g, "")) || 100000,
            city: city || "Unknown",
            employment_type: "salaried",
            monthly_income: 25000,
            source: "whatsapp",
            status: "unpaid",
            company_id: resolvedCompanyId,
          })
          .select()
          .single();

        if (leadError) {
          console.error("Lead creation error:", leadError);
        } else {
          leadId = lead.id;

          // Trigger workflow for new lead
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                trigger_type: "lead_created",
                lead_id: leadId,
                event_data: { source: "whatsapp_chatbot" },
              }),
            });
          } catch (wfErr) {
            console.error("Workflow trigger error:", wfErr);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          lead_id: leadId, 
          is_new: isNew,
          payment_link: "https://credit.hariox.com/pay/whatsapp"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = getSystemPrompt(company || "hariox");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service unavailable");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
