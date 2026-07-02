import { supabase } from "@/integrations/supabase/client";

interface TriggerWorkflowOptions {
  trigger_type: string;
  lead_id: string;
  from_status?: string;
  to_status?: string;
  company_id?: string;
}

export const triggerWorkflow = async (options: TriggerWorkflowOptions) => {
  try {
    const response = await supabase.functions.invoke("execute-workflow", {
      body: options,
    });

    if (response.error) {
      console.error("[triggerWorkflow] Error:", response.error);
      return { success: false, error: response.error };
    }

    console.log("[triggerWorkflow] Result:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("[triggerWorkflow] Exception:", error);
    return { success: false, error };
  }
};

// Map specific trigger types to their corresponding status values
const triggerStatusMap: Record<string, string> = {
  documents_verified: "verified",
  loan_approved: "approved",
  loan_rejected: "rejected",
  loan_disbursed: "disbursed",
  document_uploaded: "documents_uploaded",
};

export const triggerStatusWorkflow = async (
  leadId: string,
  fromStatus: string,
  toStatus: string,
  companyId?: string
) => {
  // Trigger generic status_changed workflows
  await triggerWorkflow({
    trigger_type: "status_changed",
    lead_id: leadId,
    from_status: fromStatus,
    to_status: toStatus,
    company_id: companyId,
  });

  // Trigger specific status workflows (e.g., documents_verified, loan_approved)
  const specificTrigger = Object.entries(triggerStatusMap).find(
    ([, status]) => status === toStatus
  );

  if (specificTrigger) {
    await triggerWorkflow({
      trigger_type: specificTrigger[0],
      lead_id: leadId,
      from_status: fromStatus,
      to_status: toStatus,
      company_id: companyId,
    });
  }

  // Payment received trigger
  if (toStatus === "paid" && fromStatus === "unpaid") {
    await triggerWorkflow({
      trigger_type: "payment_received",
      lead_id: leadId,
      from_status: fromStatus,
      to_status: toStatus,
      company_id: companyId,
    });
  }
};

// Trigger for document upload events
export const triggerDocumentUploadWorkflow = async (
  leadId: string,
  companyId?: string
) => {
  await triggerWorkflow({
    trigger_type: "document_uploaded",
    lead_id: leadId,
    company_id: companyId,
  });
};

// Trigger for new lead creation
export const triggerLeadCreatedWorkflow = async (
  leadId: string,
  companyId?: string
) => {
  await triggerWorkflow({
    trigger_type: "lead_created",
    lead_id: leadId,
    company_id: companyId,
  });
};

// Trigger for form submission
export const triggerFormFilledWorkflow = async (
  leadId: string,
  companyId?: string
) => {
  await triggerWorkflow({
    trigger_type: "form_filled",
    lead_id: leadId,
    company_id: companyId,
  });
};

export const useWorkflowTrigger = () => {
  return {
    triggerWorkflow,
    triggerStatusWorkflow,
    triggerDocumentUploadWorkflow,
    triggerLeadCreatedWorkflow,
    triggerFormFilledWorkflow,
  };
};
