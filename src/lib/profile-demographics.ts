export const GENDER_OPTIONS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao_binario", label: "Não binário" },
  { value: "outro", label: "Outro" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
] as const;

export const BRAZIL_STATES = [
  { uf: "AC", state: "Acre", region: "Norte" },
  { uf: "AL", state: "Alagoas", region: "Nordeste" },
  { uf: "AP", state: "Amapá", region: "Norte" },
  { uf: "AM", state: "Amazonas", region: "Norte" },
  { uf: "BA", state: "Bahia", region: "Nordeste" },
  { uf: "CE", state: "Ceará", region: "Nordeste" },
  { uf: "DF", state: "Distrito Federal", region: "Centro-Oeste" },
  { uf: "ES", state: "Espírito Santo", region: "Sudeste" },
  { uf: "GO", state: "Goiás", region: "Centro-Oeste" },
  { uf: "MA", state: "Maranhão", region: "Nordeste" },
  { uf: "MT", state: "Mato Grosso", region: "Centro-Oeste" },
  { uf: "MS", state: "Mato Grosso do Sul", region: "Centro-Oeste" },
  { uf: "MG", state: "Minas Gerais", region: "Sudeste" },
  { uf: "PA", state: "Pará", region: "Norte" },
  { uf: "PB", state: "Paraíba", region: "Nordeste" },
  { uf: "PR", state: "Paraná", region: "Sul" },
  { uf: "PE", state: "Pernambuco", region: "Nordeste" },
  { uf: "PI", state: "Piauí", region: "Nordeste" },
  { uf: "RJ", state: "Rio de Janeiro", region: "Sudeste" },
  { uf: "RN", state: "Rio Grande do Norte", region: "Nordeste" },
  { uf: "RS", state: "Rio Grande do Sul", region: "Sul" },
  { uf: "RO", state: "Rondônia", region: "Norte" },
  { uf: "RR", state: "Roraima", region: "Norte" },
  { uf: "SC", state: "Santa Catarina", region: "Sul" },
  { uf: "SP", state: "São Paulo", region: "Sudeste" },
  { uf: "SE", state: "Sergipe", region: "Nordeste" },
  { uf: "TO", state: "Tocantins", region: "Norte" },
] as const;

export const getRegionByState = (uf?: string | null) =>
  BRAZIL_STATES.find((item) => item.uf === uf)?.region ?? "";

export const getGenderLabel = (value?: string | null) =>
  GENDER_OPTIONS.find((item) => item.value === value)?.label ?? "Não informado";

export const getAgeRange = (birthDate?: string | null) => {
  if (!birthDate) return "Não informado";
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "Não informado";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age -= 1;
  if (age < 18) return "Até 17";
  if (age <= 24) return "18–24";
  if (age <= 34) return "25–34";
  if (age <= 44) return "35–44";
  if (age <= 54) return "45–54";
  return "55+";
};

export const countBy = <T,>(rows: T[], getKey: (row: T) => string | null | undefined) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row)?.trim() || "Não informado";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};