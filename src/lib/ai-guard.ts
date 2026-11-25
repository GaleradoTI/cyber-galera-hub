/** Recusa chamadas de IA quando o módulo está desligado (a trava não depende da tela). */
export async function assertAiEnabled(supabase: any) {
  const { data, error } = await supabase.from("public_site_settings").select("setting_value").eq("setting_key", "modules").maybeSingle();
  if (error || !(data?.setting_value as { ai_autofill?: boolean } | null)?.ai_autofill) {
    throw new Error("O preenchimento com IA está desativado.");
  }
}
