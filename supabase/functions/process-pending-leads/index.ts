import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load assignment weights from system_settings (configurable via admin UI)
    const { data: weightSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "lead_assignment_weights")
      .single();

    // Parse weights: { "user_id": percentage, ... } — must sum to 100
    let assignmentWeights: Record<string, number> = {};
    try {
      assignmentWeights = weightSetting ? JSON.parse(weightSetting.value) : {};
    } catch {
      console.error("Invalid lead_assignment_weights JSON, falling back to equal distribution");
    }

    const weightedUserIds = Object.keys(assignmentWeights);
    const totalWeight = Object.values(assignmentWeights).reduce((s, w) => s + w, 0);

    // Find leads that are unpaid, unassigned, created >2 minutes ago
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: pendingLeads, error: fetchError } = await supabase
      .from("leads")
      .select("id, full_name, company_id")
      .eq("status", "unpaid")
      .is("assigned_to", null)
      .lt("created_at", twoMinutesAgo);

    if (fetchError) {
      console.error("Error fetching pending leads:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending leads to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingLeads.length} pending leads with weights:`, assignmentWeights);

    // Get current 24h assignment counts for weighted users
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const currentCounts: Record<string, number> = {};
    
    if (weightedUserIds.length > 0) {
      const countPromises = weightedUserIds.map(async (userId) => {
        const { count } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", userId)
          .gte("created_at", dayAgo);
        currentCounts[userId] = count || 0;
      });
      await Promise.all(countPromises);
    }

    const totalAssigned = Object.values(currentCounts).reduce((s, c) => s + c, 0);
    console.log(`Current 24h distribution:`, currentCounts);

    let processedCount = 0;
    const assignmentLog: Record<string, number> = {};

    for (const lead of pendingLeads) {
      try {
        // Get available telecallers (company-linked first, then all)
        let telecallerIds: string[] = [];

        if (lead.company_id) {
          const { data: companyTelecallers } = await supabase
            .from("company_users")
            .select("user_id")
            .eq("company_id", lead.company_id);

          if (companyTelecallers && companyTelecallers.length > 0) {
            const userIds = companyTelecallers.map((c) => c.user_id);
            const { data: telecallerRoles } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("role", "telecaller")
              .in("user_id", userIds);

            if (telecallerRoles && telecallerRoles.length > 0) {
              telecallerIds = telecallerRoles.map((t) => t.user_id);
            }
          }
        }

        if (telecallerIds.length === 0) {
          const { data: allTelecallers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "telecaller");

          if (allTelecallers && allTelecallers.length > 0) {
            telecallerIds = allTelecallers.map((t) => t.user_id);
          }
        }

        if (telecallerIds.length === 0) continue;

        let telecallerId: string | undefined;

        // Check which weighted users are available
        const availableWeighted = weightedUserIds.filter(id => telecallerIds.includes(id));

        if (availableWeighted.length >= 2 && totalWeight > 0) {
          // Use weighted distribution — assign to whoever is furthest below their target ratio
          const projectedTotal = totalAssigned + processedCount + 1;
          let bestUserId = availableWeighted[0];
          let maxDeficit = -Infinity;

          for (const userId of availableWeighted) {
            const targetRatio = (assignmentWeights[userId] || 0) / totalWeight;
            const currentCount = (currentCounts[userId] || 0) + (assignmentLog[userId] || 0);
            const currentRatio = projectedTotal > 0 ? currentCount / projectedTotal : 0;
            const deficit = targetRatio - currentRatio;
            
            if (deficit > maxDeficit) {
              maxDeficit = deficit;
              bestUserId = userId;
            }
          }

          telecallerId = bestUserId;
        } else if (availableWeighted.length === 1) {
          telecallerId = availableWeighted[0];
        } else {
          // Fallback: round-robin among all available telecallers
          const assignmentCounts = await Promise.all(
            telecallerIds.map(async (userId) => {
              const { count } = await supabase
                .from("leads")
                .select("*", { count: "exact", head: true })
                .eq("assigned_to", userId)
                .eq("status", "unpaid");
              return { user_id: userId, count: count || 0 };
            })
          );
          const minAssignments = Math.min(...assignmentCounts.map((a) => a.count));
          telecallerId = assignmentCounts.find((a) => a.count === minAssignments)?.user_id;
        }

        if (telecallerId) {
          const { error: updateError } = await supabase
            .from("leads")
            .update({ assigned_to: telecallerId })
            .eq("id", lead.id);

          if (!updateError) {
            assignmentLog[telecallerId] = (assignmentLog[telecallerId] || 0) + 1;
            processedCount++;

            await supabase.from("activity_logs").insert({
              lead_id: lead.id,
              action: "lead_auto_assigned_after_delay",
              details: { 
                assigned_to: telecallerId,
                reason: "2-minute unpaid lead assignment",
                weight: assignmentWeights[telecallerId] || "round-robin"
              },
            });
          } else {
            console.error(`Error assigning lead ${lead.id}:`, updateError);
          }
        }
      } catch (leadError) {
        console.error(`Error processing lead ${lead.id}:`, leadError);
      }
    }

    const finalMessage = `Processed ${processedCount} leads. Distribution: ${JSON.stringify(assignmentLog)}`;
    console.log(finalMessage);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: finalMessage,
        processed: processedCount,
        total: pendingLeads.length,
        distribution: assignmentLog,
        weights: assignmentWeights
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-pending-leads:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
