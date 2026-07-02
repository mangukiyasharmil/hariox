import { useState, useRef } from "react";
import { Upload, FileCheck, AlertCircle, CheckCircle2, Loader2, Phone, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { triggerDocumentUploadWorkflow } from "@/hooks/useWorkflowTrigger";

import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const requiredDocuments = [
  { type: "aadhaar", label: "Aadhaar Card" },
  { type: "pan", label: "PAN Card" },
  { type: "salary_slip", label: "Salary Slip (3 months)" },
  { type: "form16", label: "Form-16" },
  { type: "itr", label: "ITR (2 years)" },
  { type: "bank_statement", label: "Bank Statement (6 months)" },
];

// Stages where document upload is allowed
const allowedStages: LeadStatus[] = ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved"];

interface LeadInfo {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  company_id?: string | null;
  company?: { name: string } | null;
}

const UniversalDocumentUpload = () => {
  const [phone, setPhone] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handlePhoneSubmit = async () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Use RPC to bypass RLS for public page lookup
      const { data: leads, error: searchError } = await supabase
        .rpc("lookup_leads_by_phone", { _phone: cleanPhone });

      if (searchError) throw searchError;

      if (!leads || leads.length === 0) {
        setError("No application found with this mobile number. Please apply first.");
        return;
      }

      // Find the most recent lead in an allowed stage
      const eligibleLead = leads.find((l: any) => allowedStages.includes(l.status));

      if (!eligibleLead) {
        // Lead exists but not in allowed stage
        const hasAnyLead = leads.length > 0;
        if (hasAnyLead) {
          setError("Your payment is pending. Please complete the payment first to upload documents.");
        } else {
          setError("No application found with this mobile number. Please apply first.");
        }
        return;
      }

      const foundLead: LeadInfo = {
        id: eligibleLead.id,
        full_name: eligibleLead.full_name,
        phone: eligibleLead.phone,
        status: eligibleLead.status,
        company_id: eligibleLead.company_id,
      };
      setLead(foundLead);
      fetchUploadedDocs(foundLead.id);
    } catch (err) {
      console.error("Search error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchUploadedDocs = async (leadId: string) => {
    const { data } = await supabase
      .from("documents")
      .select("document_type")
      .eq("lead_id", leadId);

    if (data) {
      const uploaded: Record<string, boolean> = {};
      data.forEach((doc) => {
        uploaded[doc.document_type] = true;
      });
      setUploadedDocs(uploaded);

      // Check if all required docs uploaded
      const allUploaded = requiredDocuments.every((doc) => uploaded[doc.type]);
      if (allUploaded) {
        setSuccess(true);
      }
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    if (!lead) return;

    setUploading(docType);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${lead.id}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      await supabase.from("documents").insert({
        lead_id: lead.id,
        document_type: docType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        status: "uploaded",
      });

      // Update lead status to documents_uploaded if customer is uploading docs
      const docsUploadStatuses = ["paid", "documents_pending", "verification"];
      if (docsUploadStatuses.includes(lead.status)) {
        await supabase
          .from("leads")
          .update({ status: "documents_uploaded" })
          .eq("id", lead.id);
        // Update local lead status
        setLead({ ...lead, status: "documents_uploaded" as any });
        
        // Trigger document upload workflow
        triggerDocumentUploadWorkflow(lead.id, lead.company_id || undefined);
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

  // Phone entry screen
  if (!lead && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Documents</h1>
            <p className="text-gray-600 mt-2">
              Enter your registered mobile number to upload your KYC documents
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="tel"
                placeholder="Enter 10-digit mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                className="pl-10 h-12 text-lg"
                maxLength={10}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handlePhoneSubmit}
              disabled={isSearching || phone.length < 10}
              className="w-full h-12 text-lg"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Use the same mobile number you used during application
          </p>
        </div>
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">All Documents Uploaded!</h1>
          <p className="text-gray-600">
            Thank you, {lead?.full_name}. Your documents have been submitted successfully. Our team will verify them shortly.
          </p>
        </div>
      </div>
    );
  }

  // Document upload screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {/* Lead Info Header */}
          <div className="bg-primary/5 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{lead?.full_name}</h2>
                <p className="text-sm text-gray-600">{lead?.phone}</p>
              </div>
            </div>
            {lead?.company && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{lead.company.name}</span>
              </div>
            )}
          </div>

          <div className="text-center mb-6">
            <Upload className="w-10 h-10 text-primary mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">Upload Your Documents</h1>
            <p className="text-sm text-gray-500 mt-1">
              Please upload all required documents to proceed
            </p>
          </div>

          <div className="space-y-3">
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

          <p className="text-xs text-gray-500 text-center mt-6">
            Accepted formats: PDF, JPG, PNG. Max file size: 10MB each.
          </p>

          <button
            onClick={() => {
              setLead(null);
              setPhone("");
              setUploadedDocs({});
            }}
            className="text-sm text-primary hover:underline mt-4 block mx-auto"
          >
            Use different mobile number
          </button>
        </div>
      </div>
    </div>
  );
};

export default UniversalDocumentUpload;
