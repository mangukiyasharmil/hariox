import { supabase } from "@/integrations/supabase/client";
import { getStoredUtmParams } from "@/hooks/useUtmParams";

/**
 * Create a minimal lead with just phone number OR return existing lead ID.
 * Used for early funnel capture when customer enters phone but doesn't complete application.
 * If lead already exists with this phone, returns the existing lead ID without creating a new one.
 * 
 * NOTE: This creates a "draft" lead that will be updated when the customer submits full details.
 */
export async function createPhoneLead(
  phone: string,
  companyId: string | null,
  source: string = "website"
): Promise<string | null> {
  console.log("createPhoneLead: Starting", { phone, companyId, source });
  
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    console.error("createPhoneLead: Invalid phone number", cleanPhone);
    return null;
  }

  try {
    // Check if lead already exists with this phone IN THE SAME COMPANY
    // Each company treats customers independently - applying on Capital doesn't affect Finance
    let existingLead = null;
    
    if (companyId) {
      const { data, error: selectError } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", cleanPhone)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error("createPhoneLead: Select error", selectError);
      }
      existingLead = data;
    } else {
      // No company context - check globally (legacy fallback)
      const { data, error: selectError } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", cleanPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error("createPhoneLead: Select error", selectError);
      }
      existingLead = data;
    }

    if (existingLead) {
      // Lead already exists in THIS company — but update UTM params if current session has them
      const utmParams = getStoredUtmParams();
      if (utmParams.utm_source || utmParams.utm_medium || utmParams.utm_campaign) {
        console.log("createPhoneLead: Updating UTM params on existing lead", { leadId: existingLead.id, ...utmParams });
        await supabase.functions.invoke("upsert-lead", {
          body: {
            phone: cleanPhone,
            company_id: companyId,
            is_draft: true,
            update_utm_only: true,
            ...utmParams,
          },
        });
      }
      console.log("createPhoneLead: Found existing lead in same company", { leadId: existingLead.id, phone: cleanPhone, companyId });
      return existingLead.id;
    }

    // Create minimal "draft" lead - will be updated when user submits full form
    // Use backend function to bypass RLS restrictions
    const utmParams = getStoredUtmParams();
    const { data, error } = await supabase.functions.invoke("upsert-lead", {
      body: {
        phone: cleanPhone,
        source,
        company_id: companyId,
        is_draft: true, // Flag to indicate this is a phone-only draft
        ...utmParams,
      },
    });

    if (error) {
      console.error("createPhoneLead: Edge function error", error);
      return null;
    }

    if (data?.success && data?.lead_id) {
      console.log("createPhoneLead: Created draft lead successfully", { leadId: data.lead_id, phone: cleanPhone });
      return data.lead_id;
    }

    console.error("createPhoneLead: Unexpected response", data);
    return null;
  } catch (err) {
    console.error("createPhoneLead: Exception", err);
    return null;
  }
}

/**
 * Create a lead from WhatsApp click with company context.
 */
export async function createWhatsAppLead(
  phone: string,
  companyId: string | null,
  companyName: string
): Promise<string | null> {
  return createPhoneLead(phone, companyId, `whatsapp-${companyName.toLowerCase().replace(/\s+/g, "-")}`);
}
