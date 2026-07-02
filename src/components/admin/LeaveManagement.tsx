import { useState, useEffect } from "react";
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, addMonths, subMonths } from "date-fns";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  TreePalm,
  Briefcase,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { AppRole } from "@/types/database";

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
  approver?: { full_name: string };
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
  description: string | null;
  year: number;
}

interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  leave_type?: LeaveType;
}

interface LeaveManagementProps {
  userRoles: AppRole[];
}

const LeaveManagement = ({ userRoles }: LeaveManagementProps) => {
  const { toast } = useToast();
  const isAdmin = userRoles.includes("admin");
  
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
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
      fetchData();
    }
  }, [currentUserId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch leave types
      const { data: typesData } = await supabase
        .from("leave_types")
        .select("*")
        .eq("is_active", true);
      setLeaveTypes(typesData || []);

      // Fetch leaves
      let leavesQuery = supabase
        .from("employee_leaves")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        leavesQuery = leavesQuery.eq("user_id", currentUserId);
      }

      const { data: leavesData } = await leavesQuery;

      if (leavesData) {
        // Enrich with user and leave type info
        const userIds = [...new Set(leavesData.map(l => l.user_id))];
        const approverIds = [...new Set(leavesData.map(l => l.approved_by).filter(Boolean))];
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", [...userIds, ...approverIds]);

        const enrichedLeaves = leavesData.map(leave => ({
          ...leave,
          leave_type: typesData?.find(t => t.id === leave.leave_type_id),
          user: profiles?.find(p => p.user_id === leave.user_id),
          approver: profiles?.find(p => p.user_id === leave.approved_by),
        }));
        setLeaves(enrichedLeaves);
      }

      // Fetch holidays for current year
      const { data: holidaysData } = await supabase
        .from("public_holidays")
        .select("*")
        .eq("year", new Date().getFullYear())
        .order("date");
      setHolidays(holidaysData || []);

      // Fetch balances
      if (currentUserId) {
        let balancesQuery = supabase
          .from("leave_balances")
          .select("*")
          .eq("year", new Date().getFullYear());

        if (!isAdmin) {
          balancesQuery = balancesQuery.eq("user_id", currentUserId);
        }

        const { data: balancesData } = await balancesQuery;
        
        if (balancesData) {
          const enrichedBalances = balancesData.map(b => ({
            ...b,
            leave_type: typesData?.find(t => t.id === b.leave_type_id),
          }));
          setBalances(enrichedBalances);
        }
      }
    } catch (error) {
      console.error("Error fetching leave data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    const daysCount = calculateDays(applyForm.start_date, applyForm.end_date);
    if (daysCount <= 0) {
      toast({ title: "Invalid dates", description: "End date must be after start date", variant: "destructive" });
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

      toast({ title: "Leave Applied", description: "Your leave request has been submitted for approval." });
      setShowApplyModal(false);
      setApplyForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      fetchData();
    } catch (error) {
      console.error("Error applying leave:", error);
      toast({ title: "Error", description: "Failed to submit leave request", variant: "destructive" });
    }
  };

  const handleApproveLeave = async (approved: boolean) => {
    if (!selectedLeave || !currentUserId) return;

    try {
      const updateData: any = {
        status: approved ? "approved" : "rejected",
        approved_by: currentUserId,
        approved_at: new Date().toISOString(),
      };

      if (!approved && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from("employee_leaves")
        .update(updateData)
        .eq("id", selectedLeave.id);

      if (error) throw error;

      // Update balance if approved
      if (approved) {
        const existingBalance = balances.find(
          b => b.user_id === selectedLeave.user_id && b.leave_type_id === selectedLeave.leave_type_id
        );

        if (existingBalance) {
          await supabase
            .from("leave_balances")
            .update({
              used_days: existingBalance.used_days + selectedLeave.days_count,
              pending_days: Math.max(0, existingBalance.pending_days - selectedLeave.days_count),
            })
            .eq("id", existingBalance.id);
        }
      }

      toast({
        title: approved ? "Leave Approved" : "Leave Rejected",
        description: `The leave request has been ${approved ? "approved" : "rejected"}.`,
      });
      setShowApproveModal(false);
      setSelectedLeave(null);
      setRejectionReason("");
      fetchData();
    } catch (error) {
      console.error("Error processing leave:", error);
      toast({ title: "Error", description: "Failed to process leave request", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => {
    const events: { type: "leave" | "holiday"; data: Leave | Holiday }[] = [];
    
    holidays.forEach(h => {
      if (isSameDay(parseISO(h.date), day)) {
        events.push({ type: "holiday", data: h });
      }
    });
    
    leaves.filter(l => l.status === "approved").forEach(l => {
      const start = parseISO(l.start_date);
      const end = parseISO(l.end_date);
      if (day >= start && day <= end) {
        events.push({ type: "leave", data: l });
      }
    });
    
    return events;
  };

  const pendingCount = leaves.filter(l => l.status === "pending").length;
  const approvedThisMonth = leaves.filter(l => 
    l.status === "approved" && 
    parseISO(l.start_date) >= monthStart && 
    parseISO(l.start_date) <= monthEnd
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <TreePalm className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-white/80">Total Leaves</p>
                <p className="text-2xl font-bold">{leaves.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-white/80">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-white/80">This Month</p>
                <p className="text-2xl font-bold">{approvedThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-white/80">Holidays</p>
                <p className="text-2xl font-bold">{holidays.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Leave Management</h2>
        <Button onClick={() => setShowApplyModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Apply Leave
        </Button>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>

        {/* Leave Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Employee</TableHead>}
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-muted-foreground">
                        No leave requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaves.map((leave) => (
                      <TableRow key={leave.id}>
                        {isAdmin && <TableCell className="font-medium">{leave.user?.full_name || "Unknown"}</TableCell>}
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            style={{ borderColor: leave.leave_type?.color, color: leave.leave_type?.color }}
                          >
                            {leave.leave_type?.name || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(leave.start_date), "dd MMM")} - {format(parseISO(leave.end_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>{leave.days_count}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{leave.reason || "-"}</TableCell>
                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {leave.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedLeave(leave);
                                  setShowApproveModal(true);
                                }}
                              >
                                Review
                              </Button>
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

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                
                {/* Empty cells for days before month start */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {daysInMonth.map(day => {
                  const events = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isWeekendDay = isWeekend(day);
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`aspect-square p-1 border rounded-lg relative ${
                        isToday ? "border-primary bg-primary/5" : "border-transparent"
                      } ${isWeekendDay ? "bg-muted/50" : ""}`}
                    >
                      <span className={`text-sm ${isToday ? "font-bold text-primary" : ""}`}>
                        {format(day, "d")}
                      </span>
                      <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap">
                        {events.slice(0, 2).map((event, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              event.type === "holiday" ? "bg-red-500" : "bg-blue-500"
                            }`}
                            title={event.type === "holiday" ? (event.data as Holiday).name : (event.data as Leave).user?.full_name}
                          />
                        ))}
                        {events.length > 2 && (
                          <span className="text-[8px] text-muted-foreground">+{events.length - 2}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Holiday
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  Leave
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holidays Tab */}
        <TabsContent value="holidays">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holiday</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>{format(parseISO(holiday.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{format(parseISO(holiday.date), "EEEE")}</TableCell>
                      <TableCell>
                        <Badge variant={holiday.is_optional ? "outline" : "default"}>
                          {holiday.is_optional ? "Optional" : "Gazetted"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaveTypes.map((type) => {
              const balance = balances.find(b => b.leave_type_id === type.id);
              const total = balance?.total_days || type.days_per_year;
              const used = balance?.used_days || 0;
              const pending = balance?.pending_days || 0;
              const available = total - used - pending;
              const percentage = total > 0 ? ((used + pending) / total) * 100 : 0;
              
              return (
                <Card key={type.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${type.color}20` }}
                      >
                        <TreePalm className="w-5 h-5" style={{ color: type.color }} />
                      </div>
                      <div>
                        <h4 className="font-semibold">{type.name}</h4>
                        <p className="text-xs text-muted-foreground">{type.is_paid ? "Paid" : "Unpaid"} Leave</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available</span>
                        <span className="font-semibold">{available} days</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: type.color 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Used: {used}</span>
                        <span>Pending: {pending}</span>
                        <span>Total: {total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Apply Leave Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleApplyLeave} className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={applyForm.leave_type_id}
                onValueChange={(v) => setApplyForm({ ...applyForm, leave_type_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={applyForm.start_date}
                  onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={applyForm.end_date}
                  onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
                  min={applyForm.start_date || format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
            </div>
            
            {applyForm.start_date && applyForm.end_date && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="font-medium">Duration: </span>
                {calculateDays(applyForm.start_date, applyForm.end_date)} day(s)
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                placeholder="Enter reason for leave..."
                rows={3}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowApplyModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!applyForm.leave_type_id || !applyForm.start_date || !applyForm.end_date}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedLeave.user?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Leave Type</p>
                  <Badge style={{ borderColor: selectedLeave.leave_type?.color, color: selectedLeave.leave_type?.color }} variant="outline">
                    {selectedLeave.leave_type?.name}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {format(parseISO(selectedLeave.start_date), "dd MMM")} - {format(parseISO(selectedLeave.end_date), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Days</p>
                  <p className="font-medium">{selectedLeave.days_count} day(s)</p>
                </div>
              </div>
              
              {selectedLeave.reason && (
                <div>
                  <p className="text-sm text-muted-foreground">Reason</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedLeave.reason}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={2}
                />
              </div>
              
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => handleApproveLeave(false)}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={() => handleApproveLeave(true)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;