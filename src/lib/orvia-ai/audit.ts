import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrviaAiContext } from "./context";

export type OrviaAiAuditInput = {
  toolName: string;
  permission: string;
  prompt?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Audit logger for ORVIA AI / future MCP tool calls.
 *
 * This records AI tool usage only.
 * It must not post transactions.
 */
export async function logOrviaAiToolUsage(
  supabase: SupabaseClient,
  context: OrviaAiContext,
  input: OrviaAiAuditInput
) {
  const { error } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenantId,
    p_unit_id: context.unitId,
    p_actor_id: context.userId,
    p_actor_role: context.role,
    p_event_type: "ai_tool_used",
    p_entity_type: "orvia_ai_tool",
    p_entity_id: null,
    p_source_type: "orvia_ai",
    p_source_id: null,
    p_description:
      input.summary ?? `ORVIA AI menjalankan tool ${input.toolName}.`,
    p_metadata: {
      tool_name: input.toolName,
      permission: input.permission,
      prompt: input.prompt ?? null,
      scope: context.scope,
      tenant_id: context.tenantId,
      unit_id: context.unitId,
      ai_mode: "tenant_bound_non_posting",
      ...(input.metadata ?? {}),
    },
  });

  if (error) {
    console.error("orvia ai audit error", error);
  }
}
