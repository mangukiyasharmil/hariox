import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate, Routes, Route, Link, useLocation } from "react-router-dom";
import { useAdminManifest } from "@/hooks/useAdminManifest";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import {
  LayoutDashboard,
  Users,
  Phone,
  FileCheck,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Inbox,
  IndianRupee,
  MessageCircle,
  BarChart3,
  Briefcase,
  MessageSquare,
  Headphones,
  Workflow,
  Megaphone,
  Receipt,
  FileText,
  Crown,
  ShoppingCart,
  Package,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/database";
import financeLogoIcon from "@/assets/finance-logo-icon.jpg";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import CompanySelector from "@/components/admin/CompanySelector";
import ClockInOutButton from "@/components/admin/ClockInOutButton";
import NotificationCenter from "@/components/admin/NotificationCenter";
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy load ALL dashboard modules for faster admin panel load
const DashboardOverview = lazy(() => import("@/components/admin/DashboardOverview"));
const LeadsManagement = lazy(() => import("@/components/admin/LeadsManagement"));
const TelecallerPanel = lazy(() => import("@/components/admin/TelecallerPanel"));
const PaymentsManagement = lazy(() => import("@/components/admin/PaymentsManagement"));
const VerificationPanel = lazy(() => import("@/components/admin/VerificationPanel"));
const LoginTeamPanel = lazy(() => import("@/components/admin/LoginTeamPanel"));
const SystemSettings = lazy(() => import("@/components/admin/SystemSettings"));
const WhatsAppMarketing = lazy(() => import("@/components/admin/WhatsAppMarketing"));
const ReportsSection = lazy(() => import("@/components/admin/ReportsSection"));
const CompanyManagement = lazy(() => import("@/components/admin/CompanyManagement"));
const SMSDashboard = lazy(() => import("@/components/admin/SMSDashboard"));
const HRModule = lazy(() => import("@/components/admin/HRModule"));
const UnifiedInbox = lazy(() => import("@/components/admin/UnifiedInbox"));
const SupportSection = lazy(() => import("@/components/admin/SupportSection"));
const WorkflowBuilder = lazy(() => import("@/components/admin/WorkflowBuilder"));
const AccountingModule = lazy(() => import("@/components/admin/AccountingModule"));
const MetaAdsPerformance = lazy(() => import("@/components/admin/dashboard/MetaAdsPerformance"));
const BlogManager = lazy(() => import("@/components/admin/BlogManager"));
const AgencyPanel = lazy(() => import("@/components/admin/AgencyPanel"));
const FranchiseOnboarding = lazy(() => import("@/components/admin/FranchiseOnboarding"));
const FranchiseBillingPanel = lazy(() => import("@/components/admin/FranchiseBillingPanel"));

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: AppRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "", roles: ["admin", "manager", "telecaller", "verification", "login_team"] },
      { icon: Inbox, label: "Inbox", path: "inbox", roles: ["admin", "manager", "telecaller"] },
    ],
  },
  {
    label: "CRM",
    items: [
      { icon: ShoppingCart, label: "Cart Leads", path: "leads", roles: ["admin", "manager"] },
      { icon: Phone, label: "Sales Agents", path: "telecaller", roles: ["admin", "manager", "telecaller"] },
      { icon: DollarSign, label: "Payments", path: "payments", roles: ["admin", "manager", "telecaller"] },
      { icon: FileCheck, label: "Order Review", path: "verification", roles: ["admin", "manager", "verification"] },
      { icon: Package, label: "Fulfillment", path: "login-team", roles: ["admin", "manager", "login_team"] },
    ],
  },
  {
    label: "Marketing",
    items: [
      { icon: MessageCircle, label: "WhatsApp", path: "whatsapp", roles: ["admin", "manager"] },
      { icon: MessageSquare, label: "SMS", path: "sms", roles: ["admin", "manager"] },
      { icon: Megaphone, label: "Ads", path: "ads", roles: ["admin", "manager"] },
      { icon: FileText, label: "Blog", path: "blog", roles: ["admin", "manager"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { icon: BarChart3, label: "Reports", path: "reports", roles: ["admin", "manager"] },
      { icon: Receipt, label: "Accounting", path: "finance", roles: ["admin", "manager"] },
      { icon: Workflow, label: "Workflows", path: "workflows", roles: ["admin", "manager"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { icon: Users, label: "HR", path: "hr", roles: ["admin", "manager", "telecaller", "verification", "login_team"] },
      { icon: Headphones, label: "Support", path: "support", roles: ["admin", "manager", "telecaller"] },
      { icon: IndianRupee, label: "Royalty & Fees", path: "royalty-fees", roles: ["admin", "franchise_owner", "manager", "telecaller", "verification", "login_team"] },
      { icon: Crown, label: "Franchise Setup", path: "franchise-onboarding", roles: ["admin", "manager"] },
      { icon: Crown, label: "Agency", path: "agency", roles: ["admin", "manager"] },
      { icon: Settings, label: "Settings", path: "settings", roles: ["admin", "manager"] },
    ],
  },
];

// Flatten for routing and mobile nav
const navItems: NavItem[] = navGroups.flatMap(g => g.items);

const isTransientAuthError = (err: unknown) => {
  const message = String((err as { message?: string })?.message || err || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("abort") ||
    message.includes("timeout") ||
    message.includes("load failed")
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T,>(operation: () => Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
};

const fetchSessionWithRetry = async () => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await withTimeout(
        async () => await supabase.auth.getSession(),
        12000,
        "Timeout while restoring session"
      );

      if (error) throw error;
      return data.session;
    } catch (err) {
      lastError = err;
      if (!isTransientAuthError(err) || attempt === 2) throw err;
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error("Unable to restore session");
};

const fetchRolesAndProfileWithRetry = async (userId: string) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        withTimeout(
          async () => await supabase.from("user_roles").select("role").eq("user_id", userId),
          10000,
          "Timeout while checking roles"
        ),
        withTimeout(
          async () => await supabase.from("profiles").select("full_name").eq("user_id", userId).single(),
          10000,
          "Timeout while loading profile"
        ),
      ]);

      if (rolesRes.error) throw rolesRes.error;

      const profileErrorCode = (profileRes.error as { code?: string } | null)?.code;
      if (profileRes.error && profileErrorCode !== "PGRST116") {
        throw profileRes.error;
      }

      return {
        roles: rolesRes.data || [],
        profileName: profileRes.data?.full_name || "User",
      };
    } catch (err) {
      lastError = err;
      if (!isTransientAuthError(err) || attempt === 2) throw err;
      await sleep(500 * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error("Unable to verify role access");
};

const AdminDashboardContent = () => {
  const { currentCompany, isFranchiseOwner } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; fullName: string; id: string } | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const authCheckInProgressRef = useRef(false);

  const getPathPrefix = () => {
    const pathParts = window.location.pathname.split('/');
    return (pathParts[1] === 'c' && pathParts[2]) ? `/c/${pathParts[2]}` : '';
  };

  const getRedirectPath = () => {
    const prefix = getPathPrefix();
    return window.location.pathname.includes("/franchise-admin") 
      ? `${prefix}/franchise-admin` 
      : `${prefix}/admin`;
  };

  // Load module permissions for non-admin users
  const { permissions: modulePermissions, isLoading: permissionsLoading, canView } = useModulePermissions(user?.id);

  // Switch to admin manifest for PWA
  useAdminManifest();
  
  // Subscribe to real-time payment notifications (admin only)
  const primaryRole = userRoles.includes("admin") ? "admin" : userRoles[0] || "";
  const { requestNotificationPermission, notificationPermission } = usePaymentNotifications(primaryRole);

  // Auto-request notification permission on admin load
  useEffect(() => {
    if (notificationPermission === "default") {
      // Small delay to let page load first
      const timer = setTimeout(() => {
        requestNotificationPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notificationPermission, requestNotificationPermission]);

  useEffect(() => {
    let mounted = true;

    // Initial check
    checkAuth();

    // Keep dashboard in-sync with auth state (prevents “UI looks logged in” but functions call as anon)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (!session) {
        setUser(null);
        setUserRoles([]);
        setIsLoading(false);
        navigate(getRedirectPath());
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        checkAuth();
      }
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    if (authCheckInProgressRef.current) return;
    authCheckInProgressRef.current = true;
    setAuthError(null);

    try {
      const session = await fetchSessionWithRetry();

      if (!session) {
        setUser(null);
        setUserRoles([]);
        setIsLoading(false);
        navigate(getRedirectPath());
        return;
      }

      const { roles, profileName } = await fetchRolesAndProfileWithRetry(session.user.id);

      if (!roles.length) {
        setUser(null);
        setUserRoles([]);
        setIsLoading(false);
        navigate(getRedirectPath());
        return;
      }

      setUser({
        id: session.user.id,
        email: session.user.email || "",
        fullName: profileName,
      });
      setUserRoles(roles.map((r) => r.role as AppRole));
      setIsLoading(false);
    } catch (error) {
      console.error("Admin dashboard auth check failed:", error);
      setUser(null);
      setUserRoles([]);
      setAuthError("Connection to admin backend timed out. Please retry.");
      setIsLoading(false);
    } finally {
      authCheckInProgressRef.current = false;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(getRedirectPath());
  };

  const isAdminRole = userRoles.includes("admin");
  
  const checkModuleAccess = (path: string) => {
    // Admin always has full access
    if (isAdminRole) return true;
    // If module permissions are loaded, check them
    const moduleKey = path === "" ? "dashboard" : path;
    if (modulePermissions.length > 0) {
      return canView(moduleKey);
    }
    // Fallback to role-based access
    return true;
  };

  const filterNavItem = (item: NavItem) => {
    // Franchise owners have restricted access
    if (isFranchiseOwner) {
      const franchiseAllowedPaths = ['', 'inbox', 'leads', 'telecaller', 'payments', 'verification', 'login-team', 'whatsapp', 'sms', 'reports', 'hr', 'support', 'royalty-fees'];
      return franchiseAllowedPaths.includes(item.path);
    }
    // If user has explicit module permissions (and they've loaded), use those instead of role-based filtering
    if (!isAdminRole && !permissionsLoading && modulePermissions.length > 0) {
      return canView(item.path === "" ? "dashboard" : item.path);
    }
    return item.roles.some(role => userRoles.includes(role)) && checkModuleAccess(item.path);
  };

  const filteredNavItems = navItems.filter(filterNavItem);

  const filteredNavGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(filterNavItem),
    }))
    .filter(group => group.items.length > 0);

  const currentPath = location.pathname.replace("/admin/dashboard/", "").replace("/admin/dashboard", "");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold">Admin panel connection issue</h2>
          <p className="text-sm text-muted-foreground">{authError}</p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => {
              setIsLoading(true);
              void checkAuth();
            }}>
              Retry
            </Button>
            <Button variant="outline" onClick={() => navigate(getRedirectPath())}>
              Back to login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Get mobile nav items — prioritize key items for the role
  const mobileNavItems = (() => {
    const isVerification = userRoles.includes("verification");
    const isLoginTeam = userRoles.includes("login_team");
    
    let priorityPaths: string[];
    if (isVerification) {
      priorityPaths = ["", "verification", "hr"];
    } else if (isLoginTeam) {
      priorityPaths = ["", "login-team", "hr"];
    } else {
      priorityPaths = ["", "inbox", "telecaller", "leads", "payments"];
    }
    
    const sorted = filteredNavItems
      .filter(item => priorityPaths.includes(item.path))
      .sort((a, b) => priorityPaths.indexOf(a.path) - priorityPaths.indexOf(b.path));
    return sorted.slice(0, 5);
  })();

  return (
    <div className="min-h-screen bg-muted/30 pb-16 lg:pb-0">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full bg-card border-r border-border z-50 transition-all duration-300 ${
          isSidebarOpen ? "w-64" : "w-20"
        } ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            {currentCompany?.logo_url ? (
              <img src={currentCompany.logo_url} alt={currentCompany.name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <img src={financeLogoIcon} alt="Hariox CRM" className="w-10 h-10 rounded-lg object-cover" />
            )}
            {isSidebarOpen && <span className="font-bold text-lg">{currentCompany?.name || "Hariox CRM"}</span>}
          </Link>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-muted rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)] sidebar-nav-scrollbar">
          {filteredNavGroups.map((group) => (
            <div key={group.label}>
              {isSidebarOpen && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = currentPath === item.path || (item.path === "" && currentPath === "");
                return (
                  <Link
                    key={item.path}
                    to={`/admin/dashboard/${item.path}`}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Toggle (Desktop) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden lg:flex absolute bottom-4 left-4 right-4 items-center justify-center py-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${isSidebarOpen ? "rotate-90" : "-rotate-90"}`} />
        </button>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        {/* Header */}
        <header className="sticky top-0 h-14 lg:h-16 bg-card border-b border-border z-30 flex items-center justify-between px-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg -ml-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base lg:text-lg font-semibold truncate">
              {filteredNavItems.find(item => item.path === currentPath)?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-1 lg:gap-4">
            {/* Clock In/Out Button - visible to all staff */}
            <ClockInOutButton />
            
            {/* Company Selector - visible on all screens */}
            <CompanySelector />
            
            {/* Notification Center */}
            <NotificationCenter />

            <div className="flex items-center gap-2 lg:gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium truncate max-w-36 lg:max-w-none">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {userRoles[0]?.replace(/_/g, " ")}
                </p>
                {isFranchiseOwner && (
                  <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-medium">
                    Franchise Partner
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="p-2">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 lg:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">Loading module...</p>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<ErrorBoundary fallbackTitle="Dashboard error"><DashboardOverview userRoles={userRoles} /></ErrorBoundary>} />
              <Route path="/inbox" element={<ErrorBoundary fallbackTitle="Inbox error"><UnifiedInbox /></ErrorBoundary>} />
              <Route path="/leads" element={<ErrorBoundary fallbackTitle="Leads error"><LeadsManagement /></ErrorBoundary>} />
              <Route path="/telecaller" element={<ErrorBoundary fallbackTitle="Telecaller error"><TelecallerPanel /></ErrorBoundary>} />
              <Route path="/payments" element={<ErrorBoundary fallbackTitle="Payments error"><PaymentsManagement /></ErrorBoundary>} />
              <Route path="/verification" element={<ErrorBoundary fallbackTitle="Verification error"><VerificationPanel /></ErrorBoundary>} />
              <Route path="/login-team" element={<ErrorBoundary fallbackTitle="Login Team error"><LoginTeamPanel /></ErrorBoundary>} />
              <Route path="/whatsapp" element={<ErrorBoundary fallbackTitle="WhatsApp error"><WhatsAppMarketing /></ErrorBoundary>} />
              <Route path="/sms" element={<ErrorBoundary fallbackTitle="SMS error"><SMSDashboard /></ErrorBoundary>} />
              <Route path="/support" element={<ErrorBoundary fallbackTitle="Support error"><SupportSection /></ErrorBoundary>} />
              <Route path="/reports" element={<ErrorBoundary fallbackTitle="Reports error"><ReportsSection /></ErrorBoundary>} />
              <Route path="/hr" element={<ErrorBoundary fallbackTitle="HR error"><HRModule userRoles={userRoles} /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary fallbackTitle="Settings error"><SystemSettings /></ErrorBoundary>} />
              <Route path="/workflows" element={<ErrorBoundary fallbackTitle="Workflows error"><WorkflowBuilder /></ErrorBoundary>} />
              <Route path="/finance" element={<ErrorBoundary fallbackTitle="Finance error"><AccountingModule /></ErrorBoundary>} />
              <Route path="/ads" element={<ErrorBoundary fallbackTitle="Ads error"><MetaAdsPerformance /></ErrorBoundary>} />
              <Route path="/blog" element={<ErrorBoundary fallbackTitle="Blog error"><BlogManager /></ErrorBoundary>} />
              <Route path="/agency" element={<ErrorBoundary fallbackTitle="Agency error"><AgencyPanel /></ErrorBoundary>} />
              <Route path="/franchise-onboarding" element={<ErrorBoundary fallbackTitle="Onboarding error"><FranchiseOnboarding /></ErrorBoundary>} />
              <Route path="/royalty-fees" element={<ErrorBoundary fallbackTitle="Royalty & Fees error"><FranchiseBillingPanel /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation - Minimal Design */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-3 mb-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg" style={{ marginBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-around py-1.5">
            {mobileNavItems.map((item) => {
              const isActive = currentPath === item.path || (item.path === "" && currentPath === "");
              return (
                <Link
                  key={item.path}
                  to={`/admin/dashboard/${item.path}`}
                  className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                  <item.icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  <span className={`text-[9px] font-medium transition-opacity ${isActive ? "opacity-100" : "opacity-70"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-all"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[9px] font-medium opacity-70">More</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

const AdminDashboard = () => {
  return (
    <CompanyProvider>
      <AdminDashboardContent />
    </CompanyProvider>
  );
};

export default AdminDashboard;
