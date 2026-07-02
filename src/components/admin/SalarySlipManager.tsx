import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { FileText, Download, Edit, Plus, Check, Clock, IndianRupee, Calendar, User, Printer } from "lucide-react";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface SalarySlip {
  id: string;
  user_id: string;
  company_id: string | null;
  month: number;
  year: number;
  total_working_days: number;
  days_present: number;
  days_absent: number;
  total_hours_worked: number;
  base_salary: number;
  per_day_rate: number;
  attendance_salary: number;
  lead_incentive: number;
  leads_count: number;
  incentive_rate: number;
  bonus: number;
  other_allowances: number;
  allowance_description: string | null;
  deductions: number;
  deduction_description: string | null;
  gross_salary: number;
  net_salary: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface SalarySlipManagerProps {
  staffMembers: StaffMember[];
  selectedStaffId?: string;
  isAdmin: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const INCENTIVE_TIERS = [
  { min: 1000, rate: 30 },
  { min: 750, rate: 25 },
  { min: 500, rate: 20 },
  { min: 250, rate: 15 },
  { min: 150, rate: 7 },
  { min: 0, rate: 0 },
];

const SalarySlipManager = ({ staffMembers, selectedStaffId, isAdmin }: SalarySlipManagerProps) => {
  const { currentCompany } = useCompany();
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [editForm, setEditForm] = useState<Partial<SalarySlip>>({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSalarySlips();
  }, [selectedMonth, selectedYear, currentCompany?.id, selectedStaffId]);

  const fetchSalarySlips = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    let query = supabase
      .from("salary_slips")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("month", selectedMonth)
      .eq("year", selectedYear);

    if (selectedStaffId) {
      query = query.eq("user_id", selectedStaffId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching salary slips:", error);
    } else {
      setSalarySlips(data || []);
    }
    setLoading(false);
  };

  const calculateAttendanceForStaff = async (userId: string, month: number, year: number) => {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const { data: attendance } = await supabase
      .from("staff_attendance")
      .select("*")
      .eq("user_id", userId)
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString());

    const daysPresent = attendance?.length || 0;
    const totalHours = attendance?.reduce((sum, a) => sum + (a.work_duration_minutes || 0), 0) / 60 || 0;
    const totalWorkingDays = getDaysInMonth(new Date(year, month - 1)) - 4; // Assuming 4 Sundays

    return { daysPresent, totalHours, totalWorkingDays };
  };

  const calculateLeadsForStaff = async (userId: string, month: number, year: number) => {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const { data: payments } = await supabase
      .from("payments")
      .select("*, leads!inner(assigned_to)")
      .eq("leads.assigned_to", userId)
      .eq("status", "captured")
      .eq("company_id", currentCompany?.id)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const leadsCount = payments?.length || 0;
    const incentiveRate = INCENTIVE_TIERS.find(t => leadsCount >= t.min)?.rate || 0;

    return { leadsCount, incentiveRate, leadIncentive: leadsCount * incentiveRate };
  };

  const generateSalarySlip = async (staffMember: StaffMember) => {
    if (!currentCompany?.id) return;
    setGenerating(true);

    try {
      // Check if slip already exists
      const { data: existing } = await supabase
        .from("salary_slips")
        .select("id")
        .eq("user_id", staffMember.id)
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .single();

      if (existing) {
        toast.error("Salary slip already exists for this month");
        setGenerating(false);
        return;
      }

      const attendance = await calculateAttendanceForStaff(staffMember.id, selectedMonth, selectedYear);
      const leads = await calculateLeadsForStaff(staffMember.id, selectedMonth, selectedYear);

      const baseSalary = 15000; // Default base salary
      const perDayRate = baseSalary / attendance.totalWorkingDays;
      const attendanceSalary = perDayRate * attendance.daysPresent;
      const grossSalary = attendanceSalary + leads.leadIncentive;
      const netSalary = grossSalary;

      const { data: session } = await supabase.auth.getSession();

      const { error } = await supabase.from("salary_slips").insert({
        user_id: staffMember.id,
        company_id: currentCompany.id,
        month: selectedMonth,
        year: selectedYear,
        total_working_days: attendance.totalWorkingDays,
        days_present: attendance.daysPresent,
        days_absent: attendance.totalWorkingDays - attendance.daysPresent,
        total_hours_worked: attendance.totalHours,
        base_salary: baseSalary,
        per_day_rate: perDayRate,
        attendance_salary: attendanceSalary,
        lead_incentive: leads.leadIncentive,
        leads_count: leads.leadsCount,
        incentive_rate: leads.incentiveRate,
        bonus: 0,
        other_allowances: 0,
        deductions: 0,
        gross_salary: grossSalary,
        net_salary: netSalary,
        status: "draft",
        created_by: session?.session?.user?.id,
      });

      if (error) throw error;

      toast.success("Salary slip generated successfully");
      fetchSalarySlips();
    } catch (error) {
      console.error("Error generating salary slip:", error);
      toast.error("Failed to generate salary slip");
    } finally {
      setGenerating(false);
    }
  };

  const openEditDialog = (slip: SalarySlip) => {
    setSelectedSlip(slip);
    setEditForm({
      base_salary: slip.base_salary,
      per_day_rate: slip.per_day_rate,
      total_working_days: slip.total_working_days,
      days_present: slip.days_present,
      days_absent: slip.days_absent,
      total_hours_worked: slip.total_hours_worked,
      attendance_salary: slip.attendance_salary,
      lead_incentive: slip.lead_incentive,
      leads_count: slip.leads_count,
      incentive_rate: slip.incentive_rate,
      bonus: slip.bonus,
      other_allowances: slip.other_allowances,
      allowance_description: slip.allowance_description,
      deductions: slip.deductions,
      deduction_description: slip.deduction_description,
      notes: slip.notes,
      status: slip.status,
    });
    setEditDialogOpen(true);
  };

  const recalculateTotals = () => {
    const attendanceSalary = (editForm.per_day_rate || 0) * (editForm.days_present || 0);
    const leadIncentive = (editForm.leads_count || 0) * (editForm.incentive_rate || 0);
    const grossSalary = attendanceSalary + leadIncentive + (editForm.bonus || 0) + (editForm.other_allowances || 0);
    const netSalary = grossSalary - (editForm.deductions || 0);

    setEditForm(prev => ({
      ...prev,
      attendance_salary: attendanceSalary,
      lead_incentive: leadIncentive,
      gross_salary: grossSalary,
      net_salary: netSalary,
    }));
  };

  useEffect(() => {
    if (editDialogOpen) {
      recalculateTotals();
    }
  }, [editForm.per_day_rate, editForm.days_present, editForm.leads_count, editForm.incentive_rate, editForm.bonus, editForm.other_allowances, editForm.deductions]);

  const saveSalarySlip = async () => {
    if (!selectedSlip) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const updateData: any = {
        ...editForm,
        gross_salary: editForm.gross_salary,
        net_salary: editForm.net_salary,
      };

      if (editForm.status === "approved" && selectedSlip.status !== "approved") {
        updateData.approved_by = session?.session?.user?.id;
        updateData.approved_at = new Date().toISOString();
      }

      if (editForm.status === "paid" && selectedSlip.status !== "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("salary_slips")
        .update(updateData)
        .eq("id", selectedSlip.id);

      if (error) throw error;

      toast.success("Salary slip updated successfully");
      setEditDialogOpen(false);
      fetchSalarySlips();
    } catch (error) {
      console.error("Error updating salary slip:", error);
      toast.error("Failed to update salary slip");
    }
  };

  const getStaffName = (userId: string) => {
    return staffMembers.find(s => s.id === userId)?.full_name || "Unknown";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "approved":
        return <Badge className="bg-blue-500"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case "paid":
        return <Badge className="bg-green-500"><IndianRupee className="w-3 h-3 mr-1" />Paid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const printSalarySlip = (slip: SalarySlip) => {
    const staffName = getStaffName(slip.user_id);
    const monthName = MONTHS[slip.month - 1];
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salary Slip - ${staffName} - ${monthName} ${slip.year}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #1a365d; }
          .slip-title { font-size: 18px; color: #666; margin-top: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f7fafc; padding: 15px; border-radius: 8px; }
          .info-label { font-size: 12px; color: #666; }
          .info-value { font-size: 16px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f7fafc; font-weight: 600; }
          .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px; color: #2d3748; }
          .total-row { font-weight: bold; background: #edf2f7; }
          .net-salary { font-size: 24px; color: #38a169; text-align: right; margin-top: 20px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${currentCompany?.name || "Company"}</div>
          <div class="slip-title">Salary Slip for ${monthName} ${slip.year}</div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Employee Name</div>
            <div class="info-value">${staffName}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Pay Period</div>
            <div class="info-value">${monthName} ${slip.year}</div>
          </div>
        </div>

        <div class="section-title">Attendance Summary</div>
        <table>
          <tr><td>Total Working Days</td><td>${slip.total_working_days}</td></tr>
          <tr><td>Days Present</td><td>${slip.days_present}</td></tr>
          <tr><td>Days Absent</td><td>${slip.days_absent}</td></tr>
          <tr><td>Total Hours Worked</td><td>${slip.total_hours_worked.toFixed(1)} hrs</td></tr>
        </table>

        <div class="section-title">Earnings</div>
        <table>
          <tr><td>Base Salary</td><td>₹${slip.base_salary.toFixed(2)}</td></tr>
          <tr><td>Per Day Rate</td><td>₹${slip.per_day_rate.toFixed(2)}</td></tr>
          <tr><td>Attendance Salary (${slip.days_present} days)</td><td>₹${slip.attendance_salary.toFixed(2)}</td></tr>
          <tr><td>Lead Incentive (${slip.leads_count} leads × ₹${slip.incentive_rate})</td><td>₹${slip.lead_incentive.toFixed(2)}</td></tr>
          ${slip.bonus > 0 ? `<tr><td>Bonus</td><td>₹${slip.bonus.toFixed(2)}</td></tr>` : ''}
          ${slip.other_allowances > 0 ? `<tr><td>Other Allowances ${slip.allowance_description ? `(${slip.allowance_description})` : ''}</td><td>₹${slip.other_allowances.toFixed(2)}</td></tr>` : ''}
          <tr class="total-row"><td>Gross Salary</td><td>₹${slip.gross_salary.toFixed(2)}</td></tr>
        </table>

        ${slip.deductions > 0 ? `
        <div class="section-title">Deductions</div>
        <table>
          <tr><td>Deductions ${slip.deduction_description ? `(${slip.deduction_description})` : ''}</td><td>₹${slip.deductions.toFixed(2)}</td></tr>
        </table>
        ` : ''}

        <div class="net-salary">Net Salary: ₹${slip.net_salary.toFixed(2)}</div>

        ${slip.notes ? `<p style="margin-top: 20px; color: #666;"><strong>Notes:</strong> ${slip.notes}</p>` : ''}

        <div class="footer">
          <p>This is a computer-generated document. No signature required.</p>
          <p>Generated on ${format(new Date(), "dd MMM yyyy, hh:mm a")}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const staffWithoutSlip = staffMembers.filter(
    s => !salarySlips.some(slip => slip.user_id === s.id)
  );

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Salary Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, idx) => (
                  <SelectItem key={idx} value={(idx + 1).toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Generate for Staff Without Slip */}
      {isAdmin && staffWithoutSlip.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Generate Salary Slips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {staffWithoutSlip.map(staff => (
                <Button
                  key={staff.id}
                  variant="outline"
                  size="sm"
                  onClick={() => generateSalarySlip(staff)}
                  disabled={generating}
                >
                  <User className="w-4 h-4 mr-1" />
                  {staff.full_name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Salary Slips List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Salary Slips - {MONTHS[selectedMonth - 1]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : salarySlips.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No salary slips for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Incentive</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarySlips.map(slip => (
                    <TableRow key={slip.id}>
                      <TableCell className="font-medium">{getStaffName(slip.user_id)}</TableCell>
                      <TableCell>{slip.days_present}/{slip.total_working_days} days</TableCell>
                      <TableCell>{slip.leads_count}</TableCell>
                      <TableCell>₹{slip.lead_incentive.toFixed(0)}</TableCell>
                      <TableCell className="font-semibold">₹{slip.net_salary.toFixed(0)}</TableCell>
                      <TableCell>{getStatusBadge(slip.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedSlip(slip);
                              setViewDialogOpen(true);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(slip)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => printSalarySlip(slip)}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Salary Slip - {selectedSlip && getStaffName(selectedSlip.user_id)}</DialogTitle>
          </DialogHeader>
          {selectedSlip && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Pay Period</p>
                  <p className="font-semibold">{MONTHS[selectedSlip.month - 1]} {selectedSlip.year}</p>
                </div>
                {getStatusBadge(selectedSlip.status)}
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Attendance Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Working Days</p>
                    <p className="text-xl font-bold">{selectedSlip.total_working_days}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Present</p>
                    <p className="text-xl font-bold text-green-600">{selectedSlip.days_present}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Absent</p>
                    <p className="text-xl font-bold text-red-600">{selectedSlip.days_absent}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Hours Worked</p>
                    <p className="text-xl font-bold text-blue-600">{selectedSlip.total_hours_worked.toFixed(1)}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Earnings</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Base Salary</span>
                    <span>₹{selectedSlip.base_salary.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Per Day Rate</span>
                    <span>₹{selectedSlip.per_day_rate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Attendance Salary ({selectedSlip.days_present} days)</span>
                    <span>₹{selectedSlip.attendance_salary.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Lead Incentive ({selectedSlip.leads_count} leads × ₹{selectedSlip.incentive_rate})</span>
                    <span>₹{selectedSlip.lead_incentive.toFixed(2)}</span>
                  </div>
                  {selectedSlip.bonus > 0 && (
                    <div className="flex justify-between">
                      <span>Bonus</span>
                      <span>₹{selectedSlip.bonus.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSlip.other_allowances > 0 && (
                    <div className="flex justify-between">
                      <span>Other Allowances {selectedSlip.allowance_description && `(${selectedSlip.allowance_description})`}</span>
                      <span>₹{selectedSlip.other_allowances.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Gross Salary</span>
                    <span>₹{selectedSlip.gross_salary.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedSlip.deductions > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Deductions</h4>
                    <div className="flex justify-between text-red-600">
                      <span>Deductions {selectedSlip.deduction_description && `(${selectedSlip.deduction_description})`}</span>
                      <span>-₹{selectedSlip.deductions.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex justify-between items-center text-xl font-bold">
                <span>Net Salary</span>
                <span className="text-green-600">₹{selectedSlip.net_salary.toFixed(2)}</span>
              </div>

              {selectedSlip.notes && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{selectedSlip.notes}</p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => printSalarySlip(selectedSlip)}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                {isAdmin && (
                  <Button onClick={() => {
                    setViewDialogOpen(false);
                    openEditDialog(selectedSlip);
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Salary Slip - {selectedSlip && getStaffName(selectedSlip.user_id)}</DialogTitle>
          </DialogHeader>
          {selectedSlip && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Attendance</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Working Days</Label>
                    <Input
                      type="number"
                      value={editForm.total_working_days || 0}
                      onChange={(e) => setEditForm(prev => ({ 
                        ...prev, 
                        total_working_days: parseInt(e.target.value) || 0,
                        days_absent: (parseInt(e.target.value) || 0) - (prev.days_present || 0)
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Days Present</Label>
                    <Input
                      type="number"
                      value={editForm.days_present || 0}
                      onChange={(e) => setEditForm(prev => ({ 
                        ...prev, 
                        days_present: parseInt(e.target.value) || 0,
                        days_absent: (prev.total_working_days || 0) - (parseInt(e.target.value) || 0)
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Days Absent</Label>
                    <Input type="number" value={editForm.days_absent || 0} disabled />
                  </div>
                  <div>
                    <Label>Hours Worked</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editForm.total_hours_worked || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, total_hours_worked: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Salary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Base Salary (₹)</Label>
                    <Input
                      type="number"
                      value={editForm.base_salary || 0}
                      onChange={(e) => {
                        const baseSalary = parseFloat(e.target.value) || 0;
                        const perDayRate = baseSalary / (editForm.total_working_days || 1);
                        setEditForm(prev => ({ ...prev, base_salary: baseSalary, per_day_rate: perDayRate }));
                      }}
                    />
                  </div>
                  <div>
                    <Label>Per Day Rate (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.per_day_rate?.toFixed(2) || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, per_day_rate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Incentives</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Leads Count</Label>
                    <Input
                      type="number"
                      value={editForm.leads_count || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, leads_count: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Incentive Rate (₹/lead)</Label>
                    <Input
                      type="number"
                      value={editForm.incentive_rate || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, incentive_rate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Lead Incentive (₹)</Label>
                    <Input type="number" value={editForm.lead_incentive?.toFixed(2) || 0} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Bonus (₹)</Label>
                    <Input
                      type="number"
                      value={editForm.bonus || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bonus: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Other Allowances (₹)</Label>
                    <Input
                      type="number"
                      value={editForm.other_allowances || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, other_allowances: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                {(editForm.other_allowances || 0) > 0 && (
                  <div className="mt-2">
                    <Label>Allowance Description</Label>
                    <Input
                      value={editForm.allowance_description || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, allowance_description: e.target.value }))}
                      placeholder="e.g., Travel, Food"
                    />
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Deductions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Deductions (₹)</Label>
                    <Input
                      type="number"
                      value={editForm.deductions || 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, deductions: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Deduction Reason</Label>
                    <Input
                      value={editForm.deduction_description || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, deduction_description: e.target.value }))}
                      placeholder="e.g., Advance, Penalty"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Attendance Salary</span>
                  <span>₹{(editForm.attendance_salary || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Lead Incentive</span>
                  <span>₹{(editForm.lead_incentive || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Bonus + Allowances</span>
                  <span>₹{((editForm.bonus || 0) + (editForm.other_allowances || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 font-semibold">
                  <span>Gross Salary</span>
                  <span>₹{(editForm.gross_salary || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 text-red-600">
                  <span>Deductions</span>
                  <span>-₹{(editForm.deductions || 0).toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-xl font-bold text-green-600">
                  <span>Net Salary</span>
                  <span>₹{(editForm.net_salary || 0).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveSalarySlip}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalarySlipManager;
