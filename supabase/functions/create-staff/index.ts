import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  const requested = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      requested ??
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Use anon-key client with the user's auth header to validate the JWT (works with signing-keys)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData.user) {
      console.error("Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }


    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    // Check if caller is a franchise owner
    const { data: franchiseOwnerRecord } = await supabaseAdmin
      .from("franchise_owner_companies")
      .select("company_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const isFranchiseOwner = !!franchiseOwnerRecord;
    const callerCompanyId = franchiseOwnerRecord?.company_id || null;

    if (!adminRole && !isFranchiseOwner) {
      return new Response(
        JSON.stringify({ error: "Only admins or franchise owners can create staff" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { email, password, fullName, full_name, role, company_id } = await req.json();
    const staffName = fullName || full_name;

    if (!email || !password || !staffName || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Franchise owners can only create limited roles for their own company
    const adminRoles = ["admin", "manager", "telecaller", "verification", "login_team", "franchise_owner", "ads", "hariox", "gst"];
    const franchiseOwnerAllowedRoles = ["telecaller", "verification", "login_team", "manager", "ads", "hariox", "gst"];
    const validRoles = adminRole ? adminRoles : franchiseOwnerAllowedRoles;
    
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role '${role}'. Allowed: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Determine which company to assign the new staff to
    const targetCompanyId = company_id || callerCompanyId || null;
    
    // Franchise owners can only create staff for their own company
    if (isFranchiseOwner && company_id && company_id !== callerCompanyId) {
      return new Response(
        JSON.stringify({ error: "Franchise owners can only create staff for their own company" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Try to create user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: staffName },
    });

    let userId: string;

    if (createError) {
      // If user already exists, find them and assign role
      if (createError.message.includes("already been registered")) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found. Please try again." }),
            { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }

        userId = existingUser.id;

        // Check if user already has this role
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", role)
          .single();

        if (existingRole) {
          return new Response(
            JSON.stringify({ error: `User already exists with ${role} role` }),
            { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }

        // Assign role to existing user
        const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role: role,
        });

        if (roleError) {
          console.error("Role error:", roleError);
          return new Response(
            JSON.stringify({ error: "Failed to assign role to existing user" }),
            { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Role '${role}' assigned to existing user`,
            userId,
          }),
          { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      console.error("Create user error:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    userId = newUser.user.id;

    // Create profile
    await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      email: email,
      full_name: staffName,
    });

    // Assign role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: role,
    });

    if (roleError) {
      console.error("Role error:", roleError);
      return new Response(
        JSON.stringify({ error: "User created but role assignment failed. Please try again." }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Assign to company via company_users if company_id provided
    if (targetCompanyId) {
      await supabaseAdmin.from("company_users").upsert({
        user_id: userId,
        company_id: targetCompanyId,
      }, { onConflict: "user_id,company_id" });
    }

    // If role is franchise_owner, link to franchise_owner_companies
    if (role === "franchise_owner" && targetCompanyId) {
      await supabaseAdmin.from("franchise_owner_companies").upsert({
        user_id: userId,
        company_id: targetCompanyId,
      }, { onConflict: "user_id" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Staff member created successfully",
        userId,
        user_id: userId,
        company_id: targetCompanyId,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
