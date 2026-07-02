import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { usePublicCompany } from '@/contexts/PublicCompanyContext';
import { Building2, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

const FranchiseAdminLogin = () => {
  const navigate = useNavigate();
  const { company } = usePublicCompany();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const primaryColor = company?.primary_color || '#1e3a5f';
  const secondaryColor = company?.secondary_color || '#f59e0b';
  const companyName = company?.name || 'Hariox Franchise';
  const logoUrl = company?.logo_url;

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

  // Check if already logged in as franchise owner
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: ownerRecord } = await supabase
          .from('franchise_owner_companies')
          .select('company_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (ownerRecord) {
          navigate(`${getPathPrefix()}/franchise-admin/dashboard`);
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (!data.user) throw new Error('Login failed');

      // Check franchise owner record
      const { data: ownerRecord } = await supabase
        .from('franchise_owner_companies')
        .select('company_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      // Also check user_roles for franchise_owner or regular staff roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id);

      const hasAccess = ownerRecord || roles?.some(r => ['admin', 'manager', 'telecaller', 'verification', 'login_team', 'franchise_owner'].includes(r.role));

      if (!hasAccess) {
        await supabase.auth.signOut();
        toast.error('Access denied. This portal is for franchise partners only.');
        return;
      }

      toast.success('Welcome back!');
      navigate(`${getPathPrefix()}/franchise-admin/dashboard`);
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 40%, ${secondaryColor}33 100%)`,
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10" style={{ background: secondaryColor }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: secondaryColor }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5" style={{ background: 'white' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-2xl" />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl"
              style={{ background: secondaryColor }}
            >
              <Building2 className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-1">{companyName}</h1>
          <p className="text-white/70 text-sm">Franchise Partner Portal</p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="franchise-email"
                  type="email"
                  placeholder="partner@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="franchise-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              id="franchise-login-btn"
              type="submit"
              disabled={isLoading}
              className="w-full h-12 font-semibold text-base mt-2 group"
              style={{ background: secondaryColor, color: 'white', border: 'none' }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-white/50 text-xs mt-6">
            This portal is exclusively for authorized franchise partners.
            <br />Contact your franchisor for access.
          </p>
        </div>

        {/* Master admin link */}
        <p className="text-center mt-4">
          <a href="/admin" className="text-white/50 text-xs hover:text-white/80 transition-colors">
            Master Admin Login →
          </a>
        </p>
      </div>
    </div>
  );
};

export default FranchiseAdminLogin;
