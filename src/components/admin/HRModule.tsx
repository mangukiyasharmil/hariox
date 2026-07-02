import { useState, useEffect, useCallback } from "react";
import { ALL_MODULES, getDefaultPermissions, saveModulePermissions, type ModulePermission } from "@/hooks/useModulePermissions";
import { format, parseISO, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import {
  Users,
  Clock,
  Phone,
  Activity,
  FileText,
  Calendar,
  TreePalm,
  CheckCircle,
  XCircle,
  Plus,
  Heart,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  Building2,
  FileCheck,
  Filter,
  IndianRupee,
  Check,
  Printer,
  KeyRound,
  Crown as CrownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { AppRole } from "@/types/database";

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface StaffMember extends Profile {
  id: string;
  role: AppRole;
  created_at: string;
  companies?: string[];
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface Attendance {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  work_duration_minutes: number | null;
  notes: string | null;
  user?: { full_name: string };
}

interface AggregatedAttendance {
  user_id: string;
  date: string;
  user_name: string;
  sessions: { clock_in: string; clock_out: string | null; duration: number | null }[];
  total_duration: number;
}

interface CallLog {
  id: string;
  lead_id: string;
  caller_id: string;
  call_duration: number | null;
  notes: string | null;
  outcome: string | null;
  call_type: string | null;
  created_at: string;
  caller?: { full_name: string };
  lead?: { full_name: string };
}

interface ActivityLog {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  action: string;
  details: any;
  created_at: string;
  user?: { full_name: string };
  lead?: { full_name: string };
}

interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  days_per_year: number;
  is_paid: boolean;
  color: string;
}

interface Leave {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  leave_type?: LeaveType;
  user?: { full_name: string };
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
  description: string | null;
  year: number;
}

interface SalarySlip {
  id: string;
  user_id: string;
  month: number;
  year: number;
  total_working_days: number | null;
  days_present: number | null;
  days_absent: number | null;
  total_hours_worked: number | null;
  base_salary: number | null;
  per_day_rate: number | null;
  attendance_salary: number | null;
  lead_incentive: number | null;
  leads_count: number | null;
  incentive_rate: number | null;
  bonus: number | null;
  other_allowances: number | null;
  allowance_description: string | null;
  deductions: number | null;
  deduction_description: string | null;
  gross_salary: number | null;
  net_salary: number | null;
  status: string | null;
  notes: string | null;
  user?: { full_name: string };
}

interface HRModuleProps {
  userRoles: AppRole[];
}

const roleIcons: Record<AppRole, React.ElementType> = {
  admin: Shield,
  telecaller: Phone,
  verification: FileCheck,
  login_team: Building2,
  manager: Shield,
  ads: Building2,
  finance: Building2,
  gst: FileCheck,
  franchise_owner: CrownIcon,
};

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  telecaller: "Telecaller",
  verification: "Verification Team",
  login_team: "Bank Processing Team",
  manager: "Manager - Owner",
  ads: "Ads Team",
  finance: "Finance Team",
  gst: "GST Team",
  franchise_owner: "Franchise Owner",
};

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

const HRModule = ({ userRoles }: HRModuleProps) => {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const isAdmin = userRoles.includes("admin");
  
  const [activeTab, setActiveTab] = useState("staff");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Data states
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [aggregatedAttendance, setAggregatedAttendance] = useState<AggregatedAttendance[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  
  // Filter states
  const [attendanceStaffFilter, setAttendanceStaffFilter] = useState<string>("all");
  const [attendanceDateFrom, setAttendanceDateFrom] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [attendanceDateTo, setAttendanceDateTo] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  const [leavesStaffFilter, setLeavesStaffFilter] = useState<string>("all");
  const [leavesDateFrom, setLeavesDateFrom] = useState<string>("");
  const [leavesDateTo, setLeavesDateTo] = useState<string>("");
  
  const todayDate = format(new Date(), "yyyy-MM-dd");
  
  const [callLogsStaffFilter, setCallLogsStaffFilter] = useState<string>("all");
  const [callLogsDateFrom, setCallLogsDateFrom] = useState<string>(todayDate);
  const [callLogsDateTo, setCallLogsDateTo] = useState<string>(todayDate);
  
  const [activityStaffFilter, setActivityStaffFilter] = useState<string>("all");
  const [activityDateFrom, setActivityDateFrom] = useState<string>(todayDate);
  const [activityDateTo, setActivityDateTo] = useState<string>(todayDate);
  
  // Salary slip states
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
  const [salaryStaffFilter, setSalaryStaffFilter] = useState<string>("all");
  const [editSalarySlip, setEditSalarySlip] = useState<SalarySlip | null>(null);
  const [viewSalarySlip, setViewSalarySlip] = useState<SalarySlip | null>(null);
  const [salaryEditForm, setSalaryEditForm] = useState<Partial<SalarySlip>>({});
  const [generatingSalary, setGeneratingSalary] = useState(false);
  
  // Modal states
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  // Staff form state
  const [newStaff, setNewStaff] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "telecaller" as AppRole,
    companyIds: [] as string[],
  });
  const [newStaffPermissions, setNewStaffPermissions] = useState<ModulePermission[]>(getDefaultPermissions("telecaller"));
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "telecaller" as AppRole,
    companyIds: [] as string[],
  });
  const [editPermissions, setEditPermissions] = useState<ModulePermission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordChangeStaff, setPasswordChangeStaff] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  
  const [applyForm, setApplyForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchAllData();
    }
  }, [currentUserId, activeTab]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Refetch data when filters change
  useEffect(() => {
    if (activeTab === "attendance" && currentUserId) fetchAttendance();
  }, [attendanceStaffFilter, attendanceDateFrom, attendanceDateTo]);
  
  useEffect(() => {
    if (activeTab === "leaves" && currentUserId) fetchLeaves();
  }, [leavesStaffFilter, leavesDateFrom, leavesDateTo]);
  
  useEffect(() => {
    if (activeTab === "callLogs" && currentUserId) fetchCallLogs();
  }, [callLogsStaffFilter, callLogsDateFrom, callLogsDateTo]);
  
  useEffect(() => {
    if (activeTab === "activity" && currentUserId) fetchActivityLogs();
  }, [activityStaffFilter, activityDateFrom, activityDateTo]);
  
  useEffect(() => {
    if (activeTab === "salary" && currentUserId) fetchSalarySlips();
  }, [salaryMonth, salaryYear, salaryStaffFilter]);

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("id, name, slug").eq("is_active", true).order("name");
    if (data) setCompanies(data);
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Always fetch staff for overview
      const { data: rolesData } = await supabase.from("user_roles").select("id, user_id, role, created_at").order("created_at", { ascending: false });
      const userIds = rolesData?.map(r => r.user_id) || [];
      
      if (userIds.length > 0) {
        const [{ data: profiles }, { data: companyUsersData }] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", userIds),
          supabase.from("company_users").select("user_id, company_id").in("user_id", userIds),
        ]);
        
        const companyMap = new Map<string, string[]>();
        (companyUsersData || []).forEach(cu => {
          const existing = companyMap.get(cu.user_id) || [];
          companyMap.set(cu.user_id, [...existing, cu.company_id]);
        });
        
        const staffMembers = (profiles || []).map(p => ({
          ...p,
          id: rolesData?.find(r => r.user_id === p.user_id)?.id || "",
          role: rolesData?.find(r => r.user_id === p.user_id)?.role as AppRole,
          created_at: rolesData?.find(r => r.user_id === p.user_id)?.created_at || "",
          companies: companyMap.get(p.user_id) || [],
        }));
        setStaff(staffMembers);
      }

      // Fetch tab-specific data
      if (activeTab === "attendance") await fetchAttendance();
      else if (activeTab === "callLogs") await fetchCallLogs();
      else if (activeTab === "activity") await fetchActivityLogs();
      else if (activeTab === "leaves") await fetchLeaves();
      else if (activeTab === "salary") await fetchSalarySlips();
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    let query = supabase
      .from("staff_attendance")
      .select("*")
      .order("clock_in", { ascending: false });
    
    if (attendanceDateFrom) query = query.gte("clock_in", `${attendanceDateFrom}T00:00:00`);
    if (attendanceDateTo) query = query.lte("clock_in", `${attendanceDateTo}T23:59:59`);
    
    if (!isAdmin) {
      query = query.eq("user_id", currentUserId);
    } else if (attendanceStaffFilter !== "all") {
      query = query.eq("user_id", attendanceStaffFilter);
    }
    
    const { data } = await query;
    
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      
      const enriched = data.map(a => ({
        ...a,
        user: profiles?.find(p => p.user_id === a.user_id),
      }));
      setAttendance(enriched);
      
      const aggregated = aggregateAttendanceByDay(enriched);
      setAggregatedAttendance(aggregated);
    } else {
      setAttendance([]);
      setAggregatedAttendance([]);
    }
  };

  const aggregateAttendanceByDay = (records: Attendance[]): AggregatedAttendance[] => {
    const grouped = new Map<string, AggregatedAttendance>();
    
    records.forEach(record => {
      const dateKey = format(parseISO(record.clock_in), "yyyy-MM-dd");
      const key = `${record.user_id}-${dateKey}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          user_id: record.user_id,
          date: dateKey,
          user_name: record.user?.full_name || "-",
          sessions: [],
          total_duration: 0,
        });
      }
      
      const entry = grouped.get(key)!;
      const duration = record.work_duration_minutes || 0;
      entry.sessions.push({
        clock_in: record.clock_in,
        clock_out: record.clock_out,
        duration,
      });
      entry.total_duration += duration;
    });
    
    return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
  };

  const fetchCallLogs = async () => {
    let query = supabase
      .from("call_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    
    // Company isolation for call logs
    if (currentCompany?.id) {
      query = query.eq("company_id", currentCompany.id);
    }
    
    if (callLogsDateFrom) query = query.gte("created_at", `${callLogsDateFrom}T00:00:00`);
    if (callLogsDateTo) query = query.lte("created_at", `${callLogsDateTo}T23:59:59`);
    if (callLogsStaffFilter !== "all") query = query.eq("caller_id", callLogsStaffFilter);
    
    const { data } = await query;
    
    if (data && data.length > 0) {
      const callerIds = [...new Set(data.map(c => c.caller_id))];
      const leadIds = [...new Set(data.map(c => c.lead_id))];
      
      const [{ data: profiles }, { data: leads }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", callerIds),
        supabase.from("leads").select("id, full_name").in("id", leadIds),
      ]);
      
      const enriched = data.map(c => ({
        ...c,
        caller: profiles?.find(p => p.user_id === c.caller_id),
        lead: leads?.find(l => l.id === c.lead_id),
      }));
      setCallLogs(enriched);
    } else {
      setCallLogs([]);
    }
  };

  const fetchActivityLogs = async () => {
    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    
    if (activityDateFrom) query = query.gte("created_at", `${activityDateFrom}T00:00:00`);
    if (activityDateTo) query = query.lte("created_at", `${activityDateTo}T23:59:59`);
    if (activityStaffFilter !== "all") query = query.eq("user_id", activityStaffFilter);
    
    const { data } = await query;
    
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(a => a.user_id).filter(Boolean))];
      const leadIds = [...new Set(data.map(a => a.lead_id).filter(Boolean))];
      
      const [{ data: profiles }, { data: leads }] = await Promise.all([
        userIds.length > 0 ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) : { data: [] },
        leadIds.length > 0 ? supabase.from("leads").select("id, full_name").in("id", leadIds) : { data: [] },
      ]);
      
      const enriched = data.map(a => ({
        ...a,
        user: profiles?.find(p => p.user_id === a.user_id),
        lead: leads?.find(l => l.id === a.lead_id),
      }));
      setActivityLogs(enriched);
    } else {
      setActivityLogs([]);
    }
  };

  const fetchLeaves = async () => {
    const { data: typesData } = await supabase.from("leave_types").select("*").eq("is_active", true);
    setLeaveTypes(typesData || []);
    
    const { data: holidaysData } = await supabase.from("public_holidays").select("*").eq("year", 2026).order("date");
    setHolidays(holidaysData || []);
    
    let query = supabase.from("employee_leaves").select("*").order("created_at", { ascending: false });
    
    if (!isAdmin) {
      query = query.eq("user_id", currentUserId);
    } else if (leavesStaffFilter !== "all") {
      query = query.eq("user_id", leavesStaffFilter);
    }
    
    if (leavesDateFrom) query = query.gte("start_date", leavesDateFrom);
    if (leavesDateTo) query = query.lte("end_date", leavesDateTo);
    
    const { data: leavesData } = await query;
    
    if (leavesData && leavesData.length > 0) {
      const userIds = [...new Set(leavesData.map(l => l.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      
      const enriched = leavesData.map(l => ({
        ...l,
        leave_type: typesData?.find(t => t.id === l.leave_type_id),
        user: profiles?.find(p => p.user_id === l.user_id),
      }));
      setLeaves(enriched);
    } else {
      setLeaves([]);
    }
  };

  const fetchSalarySlips = async () => {
    let query = supabase.from("salary_slips")
      .select("*")
      .eq("month", salaryMonth)
      .eq("year", salaryYear)
      .order("created_at", { ascending: false });
    
    if (!isAdmin) {
      query = query.eq("user_id", currentUserId);
    } else if (salaryStaffFilter !== "all") {
      query = query.eq("user_id", salaryStaffFilter);
    }
    
    if (currentCompany?.id) {
      query = query.eq("company_id", currentCompany.id);
    }
    
    const { data } = await query;
    
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      
      const enriched = data.map(s => ({
        ...s,
        user: profiles?.find(p => p.user_id === s.user_id),
      }));
      setSalarySlips(enriched);
    } else {
      setSalarySlips([]);
    }
  };

  const calculateAttendanceForStaff = async (userId: string, month: number, year: number) => {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const { data: attendanceData } = await supabase
      .from("staff_attendance")
      .select("*")
      .eq("user_id", userId)
      .gte("clock_in", startDate.toISOString())
      .lte("clock_in", endDate.toISOString());

    const daysPresent = attendanceData?.length || 0;
    const totalHours = (attendanceData?.reduce((sum, a) => sum + (a.work_duration_minutes || 0), 0) || 0) / 60;
    const totalWorkingDays = getDaysInMonth(new Date(year, month - 1)) - 4;

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
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const leadsCount = payments?.length || 0;
    const incentiveRate = INCENTIVE_TIERS.find(t => leadsCount >= t.min)?.rate || 0;

    return { leadsCount, incentiveRate, leadIncentive: leadsCount * incentiveRate };
  };

  const generateSalarySlip = async (staffMember: StaffMember) => {
    if (!currentCompany?.id) return;
    setGeneratingSalary(true);

    try {
      const { data: existing } = await supabase
        .from("salary_slips")
        .select("id")
        .eq("user_id", staffMember.user_id)
        .eq("month", salaryMonth)
        .eq("year", salaryYear)
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (existing) {
        toast({ title: "Salary slip already exists", variant: "destructive" });
        setGeneratingSalary(false);
        return;
      }

      const attendanceCalc = await calculateAttendanceForStaff(staffMember.user_id, salaryMonth, salaryYear);
      const leads = await calculateLeadsForStaff(staffMember.user_id, salaryMonth, salaryYear);

      const baseSalary = 15000;
      const perDayRate = baseSalary / attendanceCalc.totalWorkingDays;
      const attendanceSalary = perDayRate * attendanceCalc.daysPresent;
      const grossSalary = attendanceSalary + leads.leadIncentive;
      const netSalary = grossSalary;

      const { data: session } = await supabase.auth.getSession();

      const { error } = await supabase.from("salary_slips").insert({
        user_id: staffMember.user_id,
        company_id: currentCompany.id,
        month: salaryMonth,
        year: salaryYear,
        total_working_days: attendanceCalc.totalWorkingDays,
        days_present: attendanceCalc.daysPresent,
        days_absent: attendanceCalc.totalWorkingDays - attendanceCalc.daysPresent,
        total_hours_worked: attendanceCalc.totalHours,
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

      toast({ title: "Salary slip generated" });
      fetchSalarySlips();
    } catch (error) {
      console.error("Error generating salary slip:", error);
      toast({ title: "Failed to generate", variant: "destructive" });
    } finally {
      setGeneratingSalary(false);
    }
  };

  const openSalaryEditDialog = (slip: SalarySlip) => {
    setEditSalarySlip(slip);
    setSalaryEditForm({
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
  };

  const recalculateSalaryTotals = () => {
    const attendanceSalary = (salaryEditForm.per_day_rate || 0) * (salaryEditForm.days_present || 0);
    const leadIncentive = (salaryEditForm.leads_count || 0) * (salaryEditForm.incentive_rate || 0);
    const grossSalary = attendanceSalary + leadIncentive + (salaryEditForm.bonus || 0) + (salaryEditForm.other_allowances || 0);
    const netSalary = grossSalary - (salaryEditForm.deductions || 0);

    setSalaryEditForm(prev => ({
      ...prev,
      attendance_salary: attendanceSalary,
      lead_incentive: leadIncentive,
      gross_salary: grossSalary,
      net_salary: netSalary,
    }));
  };

  useEffect(() => {
    if (editSalarySlip) recalculateSalaryTotals();
  }, [salaryEditForm.per_day_rate, salaryEditForm.days_present, salaryEditForm.leads_count, salaryEditForm.incentive_rate, salaryEditForm.bonus, salaryEditForm.other_allowances, salaryEditForm.deductions]);

  const saveSalarySlip = async () => {
    if (!editSalarySlip) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const updateData: any = {
        ...salaryEditForm,
        gross_salary: salaryEditForm.gross_salary,
        net_salary: salaryEditForm.net_salary,
      };

      if (salaryEditForm.status === "approved" && editSalarySlip.status !== "approved") {
        updateData.approved_by = session?.session?.user?.id;
        updateData.approved_at = new Date().toISOString();
      }

      if (salaryEditForm.status === "paid" && editSalarySlip.status !== "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("salary_slips")
        .update(updateData)
        .eq("id", editSalarySlip.id);

      if (error) throw error;

      toast({ title: "Salary slip updated" });
      setEditSalarySlip(null);
      fetchSalarySlips();
    } catch (error) {
      console.error("Error updating salary slip:", error);
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const printSalarySlip = (slip: SalarySlip) => {
    const staffName = slip.user?.full_name || "Unknown";
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
          <tr><td>Total Working Days</td><td>${slip.total_working_days || 0}</td></tr>
          <tr><td>Days Present</td><td>${slip.days_present || 0}</td></tr>
          <tr><td>Days Absent</td><td>${slip.days_absent || 0}</td></tr>
          <tr><td>Total Hours Worked</td><td>${(slip.total_hours_worked || 0).toFixed(1)} hrs</td></tr>
        </table>

        <div class="section-title">Earnings</div>
        <table>
          <tr><td>Base Salary</td><td>₹${(slip.base_salary || 0).toFixed(2)}</td></tr>
          <tr><td>Per Day Rate</td><td>₹${(slip.per_day_rate || 0).toFixed(2)}</td></tr>
          <tr><td>Attendance Salary (${slip.days_present || 0} days)</td><td>₹${(slip.attendance_salary || 0).toFixed(2)}</td></tr>
          <tr><td>Lead Incentive (${slip.leads_count || 0} leads × ₹${slip.incentive_rate || 0})</td><td>₹${(slip.lead_incentive || 0).toFixed(2)}</td></tr>
          ${(slip.bonus || 0) > 0 ? `<tr><td>Bonus</td><td>₹${slip.bonus?.toFixed(2)}</td></tr>` : ''}
          ${(slip.other_allowances || 0) > 0 ? `<tr><td>Other Allowances ${slip.allowance_description ? `(${slip.allowance_description})` : ''}</td><td>₹${slip.other_allowances?.toFixed(2)}</td></tr>` : ''}
          <tr class="total-row"><td>Gross Salary</td><td>₹${(slip.gross_salary || 0).toFixed(2)}</td></tr>
        </table>

        ${(slip.deductions || 0) > 0 ? `
        <div class="section-title">Deductions</div>
        <table>
          <tr><td>Deductions ${slip.deduction_description ? `(${slip.deduction_description})` : ''}</td><td>₹${slip.deductions?.toFixed(2)}</td></tr>
        </table>
        ` : ''}

        <div class="net-salary">Net Salary: ₹${(slip.net_salary || 0).toFixed(2)}</div>

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

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be logged in");

      const response = await supabase.functions.invoke("create-staff", {
        body: {
          email: newStaff.email,
          password: newStaff.password,
          fullName: newStaff.fullName,
          role: newStaff.role,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      if (response.data?.userId && newStaff.companyIds.length > 0) {
        const companyAssignments = newStaff.companyIds.map(companyId => ({
          user_id: response.data.userId,
          company_id: companyId,
          is_owner: false,
        }));
        await supabase.from("company_users").insert(companyAssignments);
      }

      // Save module permissions
      if (response.data?.userId) {
        await saveModulePermissions(response.data.userId, newStaffPermissions);
      }

      toast({ title: "Staff Created", description: "New staff member has been added successfully" });
      setNewStaff({ email: "", password: "", fullName: "", role: "telecaller", companyIds: [] });
      setNewStaffPermissions(getDefaultPermissions("telecaller"));
      setShowAddStaffForm(false);
      fetchAllData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaff = async (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({
      fullName: member.full_name,
      role: member.role,
      companyIds: member.companies || [],
    });
    // Load existing module permissions
    const { data: perms } = await supabase
      .from("staff_module_permissions")
      .select("module_key, can_view, can_edit")
      .eq("user_id", member.user_id);
    
    if (perms && perms.length > 0) {
      setEditPermissions(perms);
    } else {
      setEditPermissions(getDefaultPermissions(member.role));
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await supabase.from("profiles").update({ full_name: editForm.fullName }).eq("user_id", editingStaff.user_id);

      if (editForm.role !== editingStaff.role) {
        await supabase.from("user_roles").update({ role: editForm.role }).eq("id", editingStaff.id);
      }

      await supabase.from("company_users").delete().eq("user_id", editingStaff.user_id);

      if (editForm.companyIds.length > 0) {
        const companyAssignments = editForm.companyIds.map(companyId => ({
          user_id: editingStaff.user_id,
          company_id: companyId,
          is_owner: false,
        }));
        await supabase.from("company_users").insert(companyAssignments);
      }

      // Save module permissions
      await saveModulePermissions(editingStaff.user_id, editPermissions);

      toast({ title: "Staff Updated" });
      setEditingStaff(null);
      fetchAllData();
    } catch (err: any) {
      setFormError(err.message || "Failed to update");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordChangeStaff || newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-password-reset", {
        body: { action: "change_password", user_id: passwordChangeStaff.user_id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Password Changed", description: `Password updated for ${passwordChangeStaff.full_name}` });
      setPasswordChangeStaff(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStaff = async (roleId: string) => {
    if (!confirm("Remove this staff member's role?")) return;
    await supabase.from("user_roles").delete().eq("id", roleId);
    fetchAllData();
  };

  const calculateDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    const daysCount = calculateDays(applyForm.start_date, applyForm.end_date);
    if (daysCount <= 0) {
      toast({ title: "Invalid dates", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("employee_leaves").insert({
        user_id: currentUserId,
        leave_type_id: applyForm.leave_type_id,
        start_date: applyForm.start_date,
        end_date: applyForm.end_date,
        days_count: daysCount,
        reason: applyForm.reason,
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Leave Applied" });
      setShowApplyLeaveModal(false);
      setApplyForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      fetchLeaves();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleApproveLeave = async (approved: boolean) => {
    if (!selectedLeave || !currentUserId) return;

    try {
      await supabase.from("employee_leaves").update({
        status: approved ? "approved" : "rejected",
        approved_by: currentUserId,
        approved_at: new Date().toISOString(),
        rejection_reason: approved ? null : rejectionReason,
      }).eq("id", selectedLeave.id);

      toast({ title: approved ? "Leave Approved" : "Leave Rejected" });
      setShowApproveModal(false);
      setSelectedLeave(null);
      fetchLeaves();
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected": return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "paid": return <Badge className="bg-blue-100 text-blue-800"><IndianRupee className="w-3 h-3 mr-1" />Paid</Badge>;
      case "draft": return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getRoleColor = (role: AppRole) => {
    const colors: Record<AppRole, string> = {
      admin: "bg-purple-100 text-purple-800",
      telecaller: "bg-blue-100 text-blue-800",
      verification: "bg-green-100 text-green-800",
      login_team: "bg-orange-100 text-orange-800",
      manager: "bg-indigo-100 text-indigo-800",
      ads: "bg-pink-100 text-pink-800",
      finance: "bg-teal-100 text-teal-800",
      gst: "bg-amber-100 text-amber-800",
      franchise_owner: "bg-red-100 text-red-800",
    };
    return colors[role];
  };

  const getCompanyNames = (companyIds: string[]) => {
    return companyIds.map(id => companies.find(c => c.id === id)?.name).filter(Boolean).join(", ");
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const staffWithoutSlip = staff.filter(
    s => !salarySlips.some(slip => slip.user_id === s.user_id)
  );

  // Filters component
  const FilterBar = ({ 
    staffFilter, 
    setStaffFilter, 
    dateFrom, 
    setDateFrom, 
    dateTo, 
    setDateTo,
    showDateFilter = true 
  }: { 
    staffFilter: string;
    setStaffFilter: (v: string) => void;
    dateFrom: string;
    setDateFrom: (v: string) => void;
    dateTo: string;
    setDateTo: (v: string) => void;
    showDateFilter?: boolean;
  }) => (
    <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>
      {isAdmin && (
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {staff.map(s => (
              <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showDateFilter && (
        <>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
            placeholder="From"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
            placeholder="To"
          />
        </>
      )}
    </div>
  );

  if (isLoading && activeTab === "staff") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {(() => {
        const todayCallLogs = callLogs.filter(c => format(parseISO(c.created_at), "yyyy-MM-dd") === todayDate);
        const totalCalls = todayCallLogs.length;
        const connectedCalls = todayCallLogs.filter(c => c.outcome === "connected").length;
        // call_duration is stored in SECONDS, not minutes
        const totalDurationSecs = todayCallLogs.reduce((sum, c) => sum + (c.call_duration || 0), 0);
        const connectedCallsWithDuration = todayCallLogs.filter(c => c.outcome === "connected" && c.call_duration);
        const avgCallSecs = connectedCallsWithDuration.length > 0 
          ? Math.round(connectedCallsWithDuration.reduce((sum, c) => sum + (c.call_duration || 0), 0) / connectedCallsWithDuration.length) 
          : 0;
        
        // Format seconds to hours/minutes/seconds
        const formatSecondsToDisplay = (totalSecs: number) => {
          if (totalSecs === 0) return "-";
          const hours = Math.floor(totalSecs / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          if (hours > 0) return `${hours}h ${mins}m`;
          if (mins > 0) return `${mins}m ${secs}s`;
          return `${secs}s`;
        };
        
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg"><Phone className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm text-white/80">Today Calls</p>
                    <p className="text-2xl font-bold">{totalCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg"><CheckCircle className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm text-white/80">Connected</p>
                    <p className="text-2xl font-bold">{connectedCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg"><Clock className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm text-white/80">Call Duration</p>
                    <p className="text-2xl font-bold">{formatSecondsToDisplay(totalDurationSecs)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg"><Activity className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm text-white/80">Avg Call</p>
                    <p className="text-2xl font-bold">{formatSecondsToDisplay(avgCallSecs)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="staff" className="gap-2"><Users className="w-4 h-4" />Staff</TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2"><TreePalm className="w-4 h-4" />Leaves</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2"><Clock className="w-4 h-4" />Attendance</TabsTrigger>
          <TabsTrigger value="callLogs" className="gap-2"><Phone className="w-4 h-4" />Call Logs</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2"><Activity className="w-4 h-4" />Activity</TabsTrigger>
          <TabsTrigger value="salary" className="gap-2"><FileText className="w-4 h-4" />Salary Slip</TabsTrigger>
        </TabsList>

        {/* Staff Tab */}
        <TabsContent value="staff">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Staff Directory</CardTitle>
              {isAdmin && (
                <Button onClick={() => setShowAddStaffForm(!showAddStaffForm)} size="sm" className="gap-2">
                  <UserPlus className="w-4 h-4" />Add Staff
                </Button>
              )}
            </CardHeader>
            
            {showAddStaffForm && isAdmin && (
              <div className="mx-6 mb-4 p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-4">Add New Staff Member</h4>
                {formError && <div className="bg-destructive/10 text-destructive rounded-lg p-3 mb-4 text-sm">{formError}</div>}
                <form onSubmit={handleAddStaff} className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={newStaff.fullName} onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <select className="w-full px-4 py-2 rounded-lg border border-input bg-background" value={newStaff.role} onChange={(e) => {
                      const role = e.target.value as AppRole;
                      setNewStaff({ ...newStaff, role });
                      setNewStaffPermissions(getDefaultPermissions(role));
                    }}>
                      <option value="telecaller">Telecaller</option>
                      <option value="verification">Verification Team</option>
                      <option value="login_team">Bank Processing Team</option>
                      <option value="manager">Manager - Owner</option>
                      <option value="ads">Ads Team</option>
                      <option value="finance">Finance Team</option>
                      <option value="gst">GST Team</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  {companies.length > 0 && (
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Assign to Companies</Label>
                      <div className="grid grid-cols-2 gap-2 p-3 bg-background rounded-lg border">
                        {companies.map((company) => (
                          <div key={company.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`new-company-${company.id}`}
                              checked={newStaff.companyIds.includes(company.id)}
                              onCheckedChange={() => setNewStaff(prev => ({
                                ...prev,
                                companyIds: prev.companyIds.includes(company.id)
                                  ? prev.companyIds.filter(id => id !== company.id)
                                  : [...prev.companyIds, company.id]
                              }))}
                            />
                            <label htmlFor={`new-company-${company.id}`} className="text-sm">{company.name}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Module Permissions */}
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-medium">Module Access (View / Edit)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-background rounded-lg border max-h-60 overflow-y-auto">
                      {ALL_MODULES.map((mod) => {
                        const perm = newStaffPermissions.find(p => p.module_key === mod.key);
                        return (
                          <div key={mod.key} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={`new-view-${mod.key}`}
                              checked={perm?.can_view ?? false}
                              onCheckedChange={(checked) => {
                                setNewStaffPermissions(prev => {
                                  const existing = prev.find(p => p.module_key === mod.key);
                                  if (existing) {
                                    return prev.map(p => p.module_key === mod.key ? { ...p, can_view: !!checked, can_edit: !checked ? false : p.can_edit } : p);
                                  }
                                  return [...prev, { module_key: mod.key, can_view: !!checked, can_edit: false }];
                                });
                              }}
                            />
                            <Checkbox
                              id={`new-edit-${mod.key}`}
                              checked={perm?.can_edit ?? false}
                              onCheckedChange={(checked) => {
                                setNewStaffPermissions(prev => {
                                  const existing = prev.find(p => p.module_key === mod.key);
                                  if (existing) {
                                    return prev.map(p => p.module_key === mod.key ? { ...p, can_edit: !!checked, can_view: checked ? true : p.can_view } : p);
                                  }
                                  return [...prev, { module_key: mod.key, can_view: true, can_edit: !!checked }];
                                });
                              }}
                            />
                            <span>{mod.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Left checkbox = View, Right checkbox = Edit</p>
                  </div>
                  <div className="sm:col-span-2 flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowAddStaffForm(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Staff"}</Button>
                  </div>
                </form>
              </div>
            )}
            
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Companies</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => {
                    const RoleIcon = roleIcons[member.role];
                    return (
                      <TableRow key={member.user_id}>
                        <TableCell className="font-medium">{member.full_name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            {roleLabels[member.role]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {member.companies && member.companies.length > 0 ? (
                            <span className="text-sm text-muted-foreground">{getCompanyNames(member.companies)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">All companies</span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditStaff(member)}><Edit2 className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { setPasswordChangeStaff(member); setNewPassword(""); }} title="Change Password"><KeyRound className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveStaff(member.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Leave Requests</h3>
            <Button onClick={() => setShowApplyLeaveModal(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />Apply Leave
            </Button>
          </div>
          
          <FilterBar
            staffFilter={leavesStaffFilter}
            setStaffFilter={setLeavesStaffFilter}
            dateFrom={leavesDateFrom}
            setDateFrom={setLeavesDateFrom}
            dateTo={leavesDateTo}
            setDateTo={setLeavesDateTo}
          />
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Employee</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
                  ) : (
                    leaves.map((leave) => (
                      <TableRow key={leave.id}>
                        {isAdmin && <TableCell className="font-medium">{leave.user?.full_name || "-"}</TableCell>}
                        <TableCell>
                          <Badge variant="outline" style={{ borderColor: leave.leave_type?.color, color: leave.leave_type?.color }}>
                            {leave.leave_type?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(parseISO(leave.start_date), "dd MMM")} - {format(parseISO(leave.end_date), "dd MMM")}</TableCell>
                        <TableCell>{leave.days_count}</TableCell>
                        <TableCell className="max-w-32 truncate">{leave.reason || "-"}</TableCell>
                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {leave.status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => { setSelectedLeave(leave); setShowApproveModal(true); }}>Review</Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <FilterBar
            staffFilter={attendanceStaffFilter}
            setStaffFilter={setAttendanceStaffFilter}
            dateFrom={attendanceDateFrom}
            setDateFrom={setAttendanceDateFrom}
            dateTo={attendanceDateTo}
            setDateTo={setAttendanceDateTo}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Attendance - Daily Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Employee</TableHead>}
                    <TableHead>Date</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Total Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedAttendance.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground">No attendance records</TableCell></TableRow>
                  ) : (
                    aggregatedAttendance.map((record, idx) => (
                      <TableRow key={idx}>
                        {isAdmin && <TableCell className="font-medium">{record.user_name}</TableCell>}
                        <TableCell>{format(parseISO(record.date), "dd MMM yyyy, EEEE")}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {record.sessions.map((s, i) => (
                              <div key={i} className="text-xs text-muted-foreground">
                                {format(parseISO(s.clock_in), "hh:mm a")} - {s.clock_out ? format(parseISO(s.clock_out), "hh:mm a") : "Active"}
                                {s.duration ? ` (${formatDuration(s.duration)})` : ""}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">{formatDuration(record.total_duration)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Logs Tab */}
        <TabsContent value="callLogs">
          <FilterBar
            staffFilter={callLogsStaffFilter}
            setStaffFilter={setCallLogsStaffFilter}
            dateFrom={callLogsDateFrom}
            setDateFrom={setCallLogsDateFrom}
            dateTo={callLogsDateTo}
            setDateTo={setCallLogsDateTo}
          />
          
          <Card>
            <CardHeader><CardTitle>Call Logs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caller</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No call logs</TableCell></TableRow>
                  ) : (
                    callLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.caller?.full_name || "-"}</TableCell>
                        <TableCell>{log.lead?.full_name || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{log.call_type || "outbound"}</Badge></TableCell>
                        <TableCell>{log.call_duration ? `${log.call_duration}s` : "-"}</TableCell>
                        <TableCell className="capitalize">{log.outcome || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{format(parseISO(log.created_at), "dd MMM, hh:mm a")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <FilterBar
            staffFilter={activityStaffFilter}
            setStaffFilter={setActivityStaffFilter}
            dateFrom={activityDateFrom}
            setDateFrom={setActivityDateFrom}
            dateTo={activityDateTo}
            setDateTo={setActivityDateTo}
          />
          
          <Card>
            <CardHeader><CardTitle>Activity Logs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No activity logs</TableCell></TableRow>
                  ) : (
                    activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.user?.full_name || "System"}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.lead?.full_name || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{format(parseISO(log.created_at), "dd MMM, hh:mm a")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Slip Tab - Full Feature */}
        <TabsContent value="salary">
          <div className="space-y-4">
            {/* Period & Staff Filter */}
            <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Period:</span>
              </div>
              <Select value={salaryMonth.toString()} onValueChange={(v) => setSalaryMonth(parseInt(v))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={salaryYear.toString()} onValueChange={(v) => setSalaryYear(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={salaryStaffFilter} onValueChange={setSalaryStaffFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staff.map(s => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Generate Salary Slips */}
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
                    {staffWithoutSlip.map(s => (
                      <Button
                        key={s.user_id}
                        variant="outline"
                        size="sm"
                        onClick={() => generateSalarySlip(s)}
                        disabled={generatingSalary}
                      >
                        <Plus className="w-3 h-3 mr-1" />{s.full_name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Salary Slips Table */}
            <Card>
              <CardHeader><CardTitle>Salary Slips - {MONTHS[salaryMonth - 1]} {salaryYear}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && <TableHead>Employee</TableHead>}
                      <TableHead>Days Present</TableHead>
                      <TableHead>Base Salary</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Incentive</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salarySlips.length === 0 ? (
                      <TableRow><TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">No salary slips for this period</TableCell></TableRow>
                    ) : (
                      salarySlips.map((slip) => (
                        <TableRow key={slip.id}>
                          {isAdmin && <TableCell className="font-medium">{slip.user?.full_name || "-"}</TableCell>}
                          <TableCell>{slip.days_present || 0}/{slip.total_working_days || 0}</TableCell>
                          <TableCell>₹{(slip.base_salary || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(slip.attendance_salary || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(slip.lead_incentive || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{(slip.deductions || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">₹{(slip.net_salary || 0).toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(slip.status || "draft")}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {isAdmin && (
                                <Button variant="ghost" size="sm" onClick={() => openSalaryEditDialog(slip)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => printSalarySlip(slip)}>
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>

      {/* Apply Leave Modal */}
      <Dialog open={showApplyLeaveModal} onOpenChange={setShowApplyLeaveModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <form onSubmit={handleApplyLeave} className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={applyForm.leave_type_id} onValueChange={(v) => setApplyForm({ ...applyForm, leave_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                        {type.name} {type.is_paid ? "(Paid)" : "(Unpaid)"}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={applyForm.start_date} onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={applyForm.end_date} onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })} min={applyForm.start_date} required />
              </div>
            </div>
            {applyForm.start_date && applyForm.end_date && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="font-medium">Duration: </span>{calculateDays(applyForm.start_date, applyForm.end_date)} day(s)
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea value={applyForm.reason} onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowApplyLeaveModal(false)}>Cancel</Button>
              <Button type="submit" disabled={!applyForm.leave_type_id || !applyForm.start_date || !applyForm.end_date}>Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Leave Request</DialogTitle></DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><span className="font-medium">Employee:</span> {selectedLeave.user?.full_name}</p>
                <p><span className="font-medium">Type:</span> {selectedLeave.leave_type?.name}</p>
                <p><span className="font-medium">Duration:</span> {format(parseISO(selectedLeave.start_date), "dd MMM")} - {format(parseISO(selectedLeave.end_date), "dd MMM")} ({selectedLeave.days_count} days)</p>
                <p><span className="font-medium">Reason:</span> {selectedLeave.reason || "Not specified"}</p>
              </div>
              <div className="space-y-2">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Optional..." rows={2} />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleApproveLeave(false)}>Reject</Button>
                <Button onClick={() => handleApproveLeave(true)}>Approve</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Staff Modal */}
      <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Staff Member</DialogTitle></DialogHeader>
          {editingStaff && (
            <div className="space-y-4">
              {formError && <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{formError}</div>}
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select className="w-full px-4 py-2 rounded-lg border border-input bg-background" value={editForm.role} onChange={(e) => {
                  const role = e.target.value as AppRole;
                  setEditForm({ ...editForm, role });
                  // Reset permissions to role defaults when role changes
                  setEditPermissions(getDefaultPermissions(role));
                }}>
                  <option value="telecaller">Telecaller</option>
                  <option value="verification">Verification Team</option>
                  <option value="login_team">Bank Processing Team</option>
                  <option value="manager">Manager - Owner</option>
                  <option value="ads">Ads Team</option>
                  <option value="finance">Finance Team</option>
                  <option value="gst">GST Team</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              {companies.length > 0 && (
                <div className="space-y-2">
                  <Label>Assign to Companies</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                    {companies.map((company) => (
                      <div key={company.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-company-${company.id}`}
                          checked={editForm.companyIds.includes(company.id)}
                          onCheckedChange={() => setEditForm(prev => ({
                            ...prev,
                            companyIds: prev.companyIds.includes(company.id)
                              ? prev.companyIds.filter(id => id !== company.id)
                              : [...prev.companyIds, company.id]
                          }))}
                        />
                        <label htmlFor={`edit-company-${company.id}`} className="text-sm">{company.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Module Permissions */}
              <div className="space-y-2">
                <Label className="font-medium">Module Access (View / Edit)</Label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg max-h-60 overflow-y-auto">
                  {ALL_MODULES.map((mod) => {
                    const perm = editPermissions.find(p => p.module_key === mod.key);
                    return (
                      <div key={mod.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={`edit-view-${mod.key}`}
                          checked={perm?.can_view ?? false}
                          onCheckedChange={(checked) => {
                            setEditPermissions(prev => {
                              const existing = prev.find(p => p.module_key === mod.key);
                              if (existing) {
                                return prev.map(p => p.module_key === mod.key ? { ...p, can_view: !!checked, can_edit: !checked ? false : p.can_edit } : p);
                              }
                              return [...prev, { module_key: mod.key, can_view: !!checked, can_edit: false }];
                            });
                          }}
                        />
                        <Checkbox
                          id={`edit-edit-${mod.key}`}
                          checked={perm?.can_edit ?? false}
                          onCheckedChange={(checked) => {
                            setEditPermissions(prev => {
                              const existing = prev.find(p => p.module_key === mod.key);
                              if (existing) {
                                return prev.map(p => p.module_key === mod.key ? { ...p, can_edit: !!checked, can_view: checked ? true : p.can_view } : p);
                              }
                              return [...prev, { module_key: mod.key, can_view: true, can_edit: !!checked }];
                            });
                          }}
                        />
                        <span>{mod.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Left checkbox = View, Right checkbox = Edit</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
                <Button onClick={handleUpdateStaff} disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Salary Slip Modal */}
      <Dialog open={!!editSalarySlip} onOpenChange={() => setEditSalarySlip(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Salary Slip - {editSalarySlip?.user?.full_name}</DialogTitle></DialogHeader>
          {editSalarySlip && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Salary</Label>
                  <Input type="number" value={salaryEditForm.base_salary || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, base_salary: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Per Day Rate</Label>
                  <Input type="number" value={salaryEditForm.per_day_rate || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, per_day_rate: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Working Days</Label>
                  <Input type="number" value={salaryEditForm.total_working_days || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, total_working_days: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Days Present</Label>
                  <Input type="number" value={salaryEditForm.days_present || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, days_present: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Leads Count</Label>
                  <Input type="number" value={salaryEditForm.leads_count || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, leads_count: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Incentive Rate (₹/lead)</Label>
                  <Input type="number" value={salaryEditForm.incentive_rate || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, incentive_rate: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Bonus</Label>
                  <Input type="number" value={salaryEditForm.bonus || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, bonus: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Other Allowances</Label>
                  <Input type="number" value={salaryEditForm.other_allowances || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, other_allowances: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Allowance Description</Label>
                  <Input value={salaryEditForm.allowance_description || ""} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, allowance_description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Deductions</Label>
                  <Input type="number" value={salaryEditForm.deductions || 0} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, deductions: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={salaryEditForm.status || "draft"} onValueChange={(v) => setSalaryEditForm({ ...salaryEditForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Deduction Description</Label>
                  <Input value={salaryEditForm.deduction_description || ""} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, deduction_description: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={salaryEditForm.notes || ""} onChange={(e) => setSalaryEditForm({ ...salaryEditForm, notes: e.target.value })} rows={2} />
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Attendance Salary:</span>
                  <span className="font-medium">₹{(salaryEditForm.attendance_salary || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lead Incentive:</span>
                  <span className="font-medium">₹{(salaryEditForm.lead_incentive || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Salary:</span>
                  <span className="font-medium">₹{(salaryEditForm.gross_salary || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Net Salary:</span>
                  <span className="font-bold text-lg text-primary">₹{(salaryEditForm.net_salary || 0).toLocaleString()}</span>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditSalarySlip(null)}>Cancel</Button>
                <Button onClick={saveSalarySlip}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Change Password Dialog */}
      <Dialog open={!!passwordChangeStaff} onOpenChange={(open) => { if (!open) { setPasswordChangeStaff(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password — {passwordChangeStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Set a new password for <strong>{passwordChangeStaff?.email}</strong>. They will be logged out of all devices.</p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordChangeStaff(null); setNewPassword(""); }}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting || newPassword.length < 6}>
              {isSubmitting ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRModule;
