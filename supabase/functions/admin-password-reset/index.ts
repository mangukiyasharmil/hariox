import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { action, user_id, new_password } = await req.json();

    // Verify caller is admin using their token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User client for auth validation
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: caller, error: authError } = await userClient.auth.getUser();
    if (authError || !caller?.user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: role } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.user.id)
      .eq("role", "admin")
      .single();

    if (!role) {
      return new Response(JSON.stringify({ error: "Not admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_password") {
      const targetId = user_id || caller.user.id;
      
      if (!new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.updateUserById(targetId, {
        password: new_password,
      });

      if (error) {
        console.error("Password update error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sign out all sessions for target user
      try {
        await adminClient.auth.admin.signOut(targetId, "global");
      } catch (e) {
        console.warn("Session signout failed (non-critical):", e);
      }

      console.log(`Password changed for user ${targetId} by admin ${caller.user.id}`);
      return new Response(JSON.stringify({ success: true, message: "Password changed and all sessions logged out" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "logout_all") {
      const targetId = user_id || caller.user.id;
      await adminClient.auth.admin.signOut(targetId, "global");
      
      return new Response(JSON.stringify({ success: true, message: "All sessions logged out" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
