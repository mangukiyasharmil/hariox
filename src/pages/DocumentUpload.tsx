import { useState, useEffect, useRef } from "react";
import { Upload, FileCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const requiredDocuments = [
  { type: "aadhaar", label: "Aadhaar Card" },
  { type: "pan", label: "PAN Card" },
  { type: "salary_slip", label: "Salary Slip (3 months)" },
  { type: "form16", label: "Form-16" },
  { type: "itr", label: "ITR (2 years)" },
  { type: "bank_statement", label: "Bank Statement (6 months)" },
];

const cibilScoreRanges = [
  { value: "750+", label: "750+ (Excellent)" },
  { value: "700-749", label: "700-749 (Good)" },
  { value: "650-699", label: "650-699 (Fair)" },
  { value: "below_650", label: "Below 650 (Poor)" },
  { value: "no_score", label: "No CIBIL Score" },
];

const DocumentUpload = () => {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [additionalInfo, setAdditionalInfo] = useState({
    state: "",
    currentMonthlyEmi: "",
    emiBounce: false,
  });
  const [infoSaved, setInfoSaved] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t");

    if (!token) {
      setError("Invalid or missing upload link. Please contact support.");
      return;
    }

    try {
      const decoded = atob(token);
      const [id, timestamp] = decoded.split(":");
      
      // Check if link is not older than 7 days
      const linkAge = Date.now() - Number(timestamp);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      if (linkAge > sevenDays) {
        setError("This upload link has expired. Please request a new one.");
        return;
      }

      setLeadId(id);
      fetchLeadInfo(id);
      fetchUploadedDocs(id);
    } catch {
      setError("Invalid upload link. Please contact support.");
    }
  }, []);

  const fetchLeadInfo = async (id: string) => {
    const { data } = await supabase
      .rpc("lookup_lead_by_id", { _lead_id: id });
    
    if (data && data.length > 0) {
      setLeadName(data[0].full_name);
    }

    // Fetch additional fields directly
    const { data: leadData } = await supabase
      .from("leads")
      .select("state, current_monthly_emi, emi_bounce_last_6_months")
      .eq("id", id)
      .maybeSingle();
    
    if (leadData) {
      if (leadData.state || leadData.current_monthly_emi || leadData.emi_bounce_last_6_months) {
        setAdditionalInfo({
          state: leadData.state || "",
          currentMonthlyEmi: leadData.current_monthly_emi ? String(leadData.current_monthly_emi) : "",
          emiBounce: leadData.emi_bounce_last_6_months || false,
        });
        if (leadData.state) setInfoSaved(true);
      }
    }
  };

  const handleSaveAdditionalInfo = async () => {
    if (!leadId) return;
    setSavingInfo(true);
    try {
      await supabase.from("leads").update({
        state: additionalInfo.state || null,
        current_monthly_emi: additionalInfo.currentMonthlyEmi ? Number(additionalInfo.currentMonthlyEmi) : null,
        emi_bounce_last_6_months: additionalInfo.emiBounce,
      }).eq("id", leadId);
      setInfoSaved(true);
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSavingInfo(false);
    }
  };

  const fetchUploadedDocs = async (id: string) => {
    const { data } = await supabase
      .rpc("get_uploaded_document_types", { _lead_id: id });

    if (data) {
      const uploaded: Record<string, boolean> = {};
      (data as Array<{ document_type: string }>).forEach((doc) => {
        uploaded[doc.document_type] = true;
      });
      setUploadedDocs(uploaded);
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    if (!leadId) return;

    setUploading(docType);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${leadId}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      await supabase.from("documents").insert({
        lead_id: leadId,
        document_type: docType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        status: "uploaded",
      });

      // Update lead status to documents_uploaded if customer is uploading docs
      const { data: leadRows } = await supabase
        .rpc("lookup_lead_by_id", { _lead_id: leadId });
      
      const currentLead = leadRows?.[0] || null;
      const docsUploadStatuses = ["paid", "documents_pending", "verification"];
      if (currentLead && docsUploadStatuses.includes(currentLead.status)) {
        await supabase
          .from("leads")
          .update({ status: "documents_uploaded" })
          .eq("id", leadId);
      }

      setUploadedDocs((prev) => ({ ...prev, [docType]: true }));

      // Check if all docs uploaded
      const allUploaded = requiredDocuments.every(
        (doc) => uploadedDocs[doc.type] || doc.type === docType
      );
      if (allUploaded) {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Error</h1>
          <p className="text-gray-600">{error}</p>
          <a href="/" className="text-primary hover:underline mt-4 inline-block">
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">All Documents Uploaded!</h1>
          <p className="text-gray-600">
            Thank you, {leadName}. Your documents have been submitted successfully. Our team will verify them shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="text-center mb-8">
            <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Upload Your Documents</h1>
            {leadName && (
              <p className="text-gray-600 mt-1">Hello, {leadName}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Please upload all required documents to proceed with your loan application.
            </p>
          </div>

          <div className="space-y-4">
            {requiredDocuments.map((doc) => (
              <div
                key={doc.type}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  uploadedDocs[doc.type]
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck
                      className={`w-5 h-5 ${
                        uploadedDocs[doc.type] ? "text-green-600" : "text-gray-400"
                      }`}
                    />
                    <span className="font-medium text-gray-900">{doc.label}</span>
                  </div>

                  {uploadedDocs[doc.type] ? (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Uploaded
                    </span>
                  ) : (
                    <>
                      <input
                        type="file"
                        ref={(el) => (fileRefs.current[doc.type] = el)}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleUpload(doc.type, e.target.files[0]);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={uploading === doc.type}
                        onClick={() => fileRefs.current[doc.type]?.click()}
                      >
                        {uploading === doc.type ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Information Section */}
          <div className="mt-6 p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">Additional Information (for bank submission)</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">State</label>
                <select
                  className="mt-1 w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
                  value={additionalInfo.state}
                  onChange={(e) => { setAdditionalInfo(p => ({ ...p, state: e.target.value })); setInfoSaved(false); }}
                >
                  <option value="">Select State</option>
                  {["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Current Monthly EMI (if any)</label>
                <input
                  type="number"
                  className="mt-1 w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
                  placeholder="e.g., 15000"
                  value={additionalInfo.currentMonthlyEmi}
                  onChange={(e) => { setAdditionalInfo(p => ({ ...p, currentMonthlyEmi: e.target.value })); setInfoSaved(false); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emiBounce"
                  checked={additionalInfo.emiBounce}
                  onChange={(e) => { setAdditionalInfo(p => ({ ...p, emiBounce: e.target.checked })); setInfoSaved(false); }}
                  className="rounded border-gray-300"
                />
                <label htmlFor="emiBounce" className="text-sm text-gray-700">EMI bounce in last 6 months?</label>
              </div>
              <Button
                onClick={handleSaveAdditionalInfo}
                disabled={savingInfo || infoSaved}
                className="w-full"
              >
                {savingInfo ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                ) : infoSaved ? (
                  <><CheckCircle2 className="w-4 h-4 mr-1" /> Saved</>
                ) : (
                  "Save Information"
                )}
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Accepted formats: PDF, JPG, PNG. Max file size: 10MB each.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
