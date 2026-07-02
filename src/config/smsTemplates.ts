// SMS Templates Configuration
// Central configuration file for all DLT-approved SMS templates
// Updated: Feb 18, 2026 from GreenSMS DLT Excel export

export interface SMSTemplate {
  value: string;
  label: string;
  templateId: string;
  message: string;
  varCount: number;
  category: "otp" | "status" | "telecaller" | "marketing";
  companySlug?: "hariox" | "finance" | "capital" | null;
}

// =====================================================
// MASTER SMS TEMPLATE LIST (Updated Feb 18, 2026)
// Only latest DLT-approved templates kept
// =====================================================
export const SMS_TEMPLATES: SMSTemplate[] = [
  // ===== OTP TEMPLATES =====
  {
    value: "otp",
    label: "OTP Verification",
    templateId: "1707174160032929634",
    message: "Hello, OTP for your mobile number registration is {#var#}. Kindly do not share it with anyone. Thanks, HARIOX",
    varCount: 1,
    category: "otp",
    companySlug: null,
  },
  {
    value: "otp_a",
    label: "OTP A (Corporate)",
    templateId: "1707174160046186400",
    message: "Hello, OTP for your mobile number registration is {#var#}. Kindly do not share it with anyone. Thanks, Hariox Corporate",
    varCount: 1,
    category: "otp",
    companySlug: null,
  },
  {
    value: "otp_msg",
    label: "OTP MSG (Services)",
    templateId: "1707174297198878887",
    message: "Hello, Hariox Services OTP for your mobile number registration is {#var#} Kindly do not share it with anyone. Thanks, HARIOX CORPORATE SERVICES",
    varCount: 1,
    category: "otp",
    companySlug: null,
  },

  // ===== TELECALLER SMS (Company-specific) =====
  {
    value: "telecaller_credit",
    label: "Telecaller Credit",
    templateId: "1707177133107998564",
    message: "Your Rs.{#var#} Pre-Approved Loan is Confirmed. Get money in your bank in 10 mins. Apply here: https://credit.hariox.com/pay/telecaller . HARIOX",
    varCount: 1,
    category: "telecaller",
    companySlug: "hariox",
  },
  {
    value: "telecaller_finance",
    label: "Telecaller Finance Fundkredit",
    templateId: "1707178153009447504",
    message: "Congrats! Your {#var#} Loan has been Pre-Approved! Get money directly in your bank a/c. Get Offer Now https://finance.fundkredit.com/apply Finance Fundkredit",
    varCount: 1,
    category: "telecaller",
    companySlug: "finance",
  },
  {
    value: "telecaller_capital",
    label: "Telecaller Capital",
    templateId: "1707177133118458747",
    message: "Your Rs.{#var#} Pre-Approved Loan is Confirmed. Get money in your bank in 10 mins. Apply here: https://capital.hariox.com/pay/telecaller . HARIOX",
    varCount: 1,
    category: "telecaller",
    companySlug: "capital",
  },

  // ===== STATUS/TRANSACTION SMS =====
  {
    value: "payment_success",
    label: "Payment Success",
    templateId: "1707177005084194117",
    message: "Dear Customer, congratulations! Your loan application is approved. Our executive will contact you shortly for next steps. Team Hariox.",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "payment_done_docs",
    label: "Payment Done - Docs Upload",
    templateId: "1707177046090359201",
    message: "Dear Customer, congratulations! Thank u For Paying Fees. Now Upload Your Documents In Portal For faster process and next day Our executive will contact you for next steps. Team Hariox. https://credit.hariox.com/my-account",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "another_bank",
    label: "Another Bank (Processing)",
    templateId: "1707177005090686508",
    message: "It may take 15 to 20 days for your bank to process the transaction at another bank due to low transaction volume. Thanks Hariox Corporate",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "career_message",
    label: "Career Message",
    templateId: "1707177005115227559",
    message: "Thank you for showing interest with us. Our HR team will get call back soon. Have a nice day! Thanks & Regards, Hariox Corporate",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "document_pending",
    label: "Documents Pending",
    templateId: "1707177005136919738",
    message: "Hello Sir/Mam, Please upload your incomplete document. Thanks & Regards, Hariox Corporate",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "forget_password",
    label: "Forget Password",
    templateId: "1707174160150901333",
    message: "Hello {#var#} Your account new password is {#var#} (Do not share it with anyone). Thanks & Regards, Hariox Corporate",
    varCount: 2,
    category: "status",
    companySlug: null,
  },
  {
    value: "payout_message",
    label: "Loan Disbursed/Payout",
    templateId: "1707177005364583117",
    message: "Dear Customer, Payout is successfully credited to your account. Please check your portal! Thanks & Regards, Hariox Corporate",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "rejected",
    label: "Application Rejected",
    templateId: "1707177005392409980",
    message: "Dear Customer, we regret to inform you that your loan request could not be processed at this time due to eligibility criteria. Team Hariox.",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "website_maintenance",
    label: "Website Maintenance",
    templateId: "1707177005471065545",
    message: "Dear Customer, Hariox website is under maintenance. Please try again later. For support, contact our team. Thank you.",
    varCount: 0,
    category: "status",
    companySlug: null,
  },
  {
    value: "file_canceled",
    label: "File Canceled (Low CIBIL)",
    templateId: "1707177005482506432",
    message: "If your file has been canceled due to the low civil score of your profile, please correct it and give it after {#var#} months. Hariox Corporate",
    varCount: 1,
    category: "status",
    companySlug: null,
  },

  // ===== MARKETING / REMARKETING SMS (Company-specific) =====
  {
    value: "remarketing_credit",
    label: "Remarketing Credit",
    templateId: "1707177133076035580",
    message: "Your Rs.{#var#} Pre-Approved Loan Confirmed. Get money in your bank A/C in 10 mins. Complete process now: https://credit.hariox.com/pay/marketing HARIOX",
    varCount: 1,
    category: "marketing",
    companySlug: "hariox",
  },
  {
    value: "remarketing_finance",
    label: "Remarketing Finance Fundkredit",
    templateId: "1707178153009447504",
    message: "Congrats! Your {#var#} Loan has been Pre-Approved! Get money directly in your bank a/c. Get Offer Now https://finance.fundkredit.com/apply Finance Fundkredit",
    varCount: 1,
    category: "marketing",
    companySlug: "finance",
  },
  {
    value: "remarketing_capital",
    label: "Remarketing Capital",
    templateId: "1707177133093784308",
    message: "Your Rs.{#var#} Pre-Approved Loan Confirmed. Get money in your bank A/C in 10 mins. Complete process now: https://capital.hariox.com/pay/marketing HARIOX",
    varCount: 1,
    category: "marketing",
    companySlug: "capital",
  },
];

// Helper to get template by value
export const getSMSTemplate = (value: string): SMSTemplate | undefined => {
  return SMS_TEMPLATES.find(t => t.value === value);
};

// Get templates by category
export const getSMSTemplatesByCategory = (category: SMSTemplate["category"], companySlug?: string): SMSTemplate[] => {
  return SMS_TEMPLATES.filter(t => 
    t.category === category && 
    (t.companySlug === null || !companySlug || t.companySlug === companySlug)
  );
};

// Get preview message with variables replaced
export const getPreviewMessage = (
  template: SMSTemplate,
  var1?: string,
  var2?: string
): string => {
  let message = template.message;
  if (template.varCount >= 1) {
    message = message.replace("{#var#}", var1 || "{amount}");
  }
  if (template.varCount >= 2) {
    message = message.replace("{#var#}", var2 || "{url}");
  }
  return message;
};

// Get company-specific telecaller template value
export const getCompanyTelecallerTemplate = (companySlug: string): string => {
  if (companySlug === "capital") return "telecaller_capital";
  if (companySlug === "finance" || companySlug === "finance-fundkredit") return "telecaller_finance";
  return "telecaller_credit";
};

// Get company-specific remarketing template value
export const getCompanyRemarketingTemplate = (companySlug: string): string => {
  if (companySlug === "capital") return "remarketing_capital";
  if (companySlug === "finance" || companySlug === "finance-fundkredit") return "remarketing_finance";
  return "remarketing_credit";
};
