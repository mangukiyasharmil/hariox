import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAdminManifest } from "@/hooks/useAdminManifest";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";
import financeLogoIcon from "@/assets/finance-logo-icon.jpg";

type ViewMode = "login" | "forgot-password" | "reset-sent";

const getFriendlyAuthErrorMessage = (err: any) => {
  const message = String(err?.message || err || "");
  const lower = message.toLowerCase();

  // Network connectivity issues (common on mobile / flaky connections)
  if (lower.includes("abort") || lower.includes("signal is aborted")) {
    return "Network request was interrupted. Please check your internet and retry.";
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network error") || lower.includes("load failed") || lower.includes("timeout")) {
    return "Network error – please check your internet connection and try again.";
  }

  if (lower.includes("non-2xx") || lower.includes("edge function")) {
    return "Server is temporarily unavailable. Please try again in a minute.";
  }

  if (lower.includes("invalid login") || lower.includes("invalid") || lower.includes("credentials")) {
    return "Invalid email or password.";
  }

  return message || "Something went wrong. Please try again.";
};

const isTransientNetworkError = (err: any) => {
  const message = String(err?.message || err || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("abort") ||
    message.includes("timeout") ||
    message.includes("load failed")
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T,>(operation: () => Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
};

const fetchUserRolesWithRetry = async (userId: string) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data: roles, error } = await withTimeout(
        async () => await supabase.from("user_roles").select("role").eq("user_id", userId),
        10000,
        "Timeout while checking user permissions"
      );

      if (error) throw error;
      return roles || [];
    } catch (err) {
      lastError = err;
      if (!isTransientNetworkError(err) || attempt === 2) throw err;
      await wait(500 * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error("Unable to verify user permissions");
};

const AdminLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const { company } = usePublicCompany();
  const companyName = company?.name ? `${company.name} Admin` : "Credit Hariox Admin";
  const logoUrl = company?.logo_url || financeLogoIcon;
  const primaryColor = company?.primary_color || undefined;

  // Switch to admin manifest for PWA - critical for Add to Home Screen
  useAdminManifest();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserRole(session.user.id);
      }
    });
  }, []);

  const getPathPrefix = () => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'c' && pathParts[2]) {
      return `/c/${pathParts[2]}`;
    }
    if (pathParts[2] === 'admin' || pathParts[2] === 'franchise-admin') {
      return `/${pathParts[1]}`;
    }
    return '';
  };

  const checkUserRole = async (userId: string) => {
    try {
      const roles = await fetchUserRolesWithRetry(userId);
      if (roles.length > 0) {
        navigate(`${getPathPrefix()}/admin/dashboard`);
      }
    } catch (err) {
      console.error("Role check during session restore failed:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let data, authError;

      // Retry with exponential backoff for transient connectivity issues
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const result = await Promise.race([
            supabase.auth.signInWithPassword({
              email: formData.email.trim().toLowerCase(),
              password: formData.password,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Network timeout during sign in")), 12000)
            ),
          ]);

          data = result.data;
          authError = result.error;

          if (!authError) break;
          if (!isTransientNetworkError(authError) || attempt === 3) throw authError;
        } catch (attemptError) {
          if (!isTransientNetworkError(attemptError) || attempt === 3) throw attemptError;
          await wait(600 * Math.pow(2, attempt));
        }
      }

      if (authError) throw authError;

      if (data.user) {
        // Fire-and-forget: never block login on admin bootstrap helper
        void supabase.functions
          .invoke("admin-setup", { body: {} })
          .then((setupRes) => {
            if (setupRes.error) {
              console.warn("admin-setup failed:", setupRes.error);
            }
          })
          .catch((setupErr) => {
            console.warn("admin-setup call failed:", setupErr);
          });

        const roles = await fetchUserRolesWithRetry(data.user.id);

        if (roles.length > 0) {
          navigate(`${getPathPrefix()}/admin/dashboard`);
        } else {
          setError("You don't have permission to access the admin panel.");
          await supabase.auth.signOut();
        }
      }
    } catch (err: any) {
      console.error("Admin login error:", err);
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        formData.email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/admin` }
      );

      if (resetError) throw resetError;
      
      setViewMode("reset-sent");
      setSuccessMessage(`Password reset link sent to ${formData.email}`);
    } catch (err: any) {
      console.error("Admin forgot-password error:", err);
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    if (viewMode === "reset-sent") {
      return (
        <div className="p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
            <Mail className="w-8 h-8 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
            <p className="text-muted-foreground">{successMessage}</p>
          </div>
          <Button variant="outline" onClick={() => { setViewMode("login"); setSuccessMessage(null); }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      );
    }

    if (viewMode === "forgot-password") {
      return (
        <form onSubmit={handleForgotPassword} className="p-8 space-y-6">
          <button type="button" onClick={() => setViewMode("login")} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to login
          </button>
          
          {error && <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <Button variant="hero" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending...</> : "Send Reset Link"}
          </Button>
        </form>
      );
    }

    return (
      <form onSubmit={handleLogin} className="p-8 space-y-6">
        {error && <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm">{error}</div>}

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="pl-10"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {viewMode === "login" && (
              <button type="button" onClick={() => setViewMode("forgot-password")} className="text-sm text-primary hover:underline">
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="pl-10 pr-10"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button variant="hero" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Signing In...</>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-card border border-border overflow-hidden">
          <div className="gradient-brand p-8 text-center" style={primaryColor ? { background: `linear-gradient(135deg, ${primaryColor} 0%, ${company?.secondary_color || '#8b5cf6'} 100%)` } : undefined}>
            <img src={logoUrl} alt={companyName} className="w-16 h-16 rounded-xl mx-auto mb-4 object-contain bg-white p-1" />
            <h1 className="text-2xl font-bold text-primary-foreground">{companyName}</h1>
            <p className="text-primary-foreground/80 mt-1">
              {viewMode === "forgot-password" ? "Reset your password" : "Sign in to continue"}
            </p>
          </div>
          {renderForm()}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          <a href="/" className="hover:underline">← Back to Website</a>
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
