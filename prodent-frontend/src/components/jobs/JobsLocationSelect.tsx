import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

// Cascading Вилоят (region) → Район (district) selector for the Jobs module.
// Reads the shared reference tables (regions/districts, public-read) filtered to
// Uzbekistan, and stores the chosen NAMES into the existing text columns
// (listing/resume `city` = region name, `district` = district name), so the
// backend + filters stay unchanged. RU-hardcoded like the rest of the module.

interface Opt { id: string; name: string }
interface CountryRow { id: string; code?: string | null }
interface LocationRow { id: string; name: string }

// Module-level cache — the component mounts in forms AND filter rails; avoid
// refetching the region list / a region's districts every time.
let regionsCache: Opt[] | null = null;
const districtCache: Record<string, Opt[]> = {};

async function loadRegions(): Promise<Opt[]> {
  if (regionsCache) return regionsCache;
  const { data: cs } = await supabase.from("countries").select("id, code").eq("code", "UZ").limit(1);
  const uz = (cs as CountryRow[] | null)?.[0]?.id;
  let q = supabase.from("regions").select("id, name, country_id").eq("is_active", true).order("sort_order");
  if (uz) q = q.eq("country_id", uz);
  const { data } = await q;
  regionsCache = ((data as LocationRow[] | null) || []).map((r) => ({ id: r.id, name: r.name }));
  return regionsCache;
}

async function loadDistricts(regionId: string): Promise<Opt[]> {
  if (districtCache[regionId]) return districtCache[regionId];
  const { data } = await supabase
    .from("districts").select("id, name, region_id")
    .eq("region_id", regionId).eq("is_active", true).order("sort_order");
  const out = ((data as LocationRow[] | null) || []).map((d) => ({ id: d.id, name: d.name }));
  districtCache[regionId] = out;
  return out;
}

const SELECT_CLS =
  "h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none " +
  "transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60";

export function JobsLocationSelect({
  region,
  district,
  onRegionChange,
  onDistrictChange,
  variant = "form",
  regionLabel,
  districtLabel,
}: {
  region?: string;
  district?: string;
  onRegionChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  variant?: "form" | "filter";
  regionLabel?: string;
  districtLabel?: string;
}) {
  const { t } = useLanguage();
  const [regions, setRegions] = useState<Opt[]>([]);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const resolvedRegionLabel = regionLabel ?? t("jobs.location.regionLabel");
  const resolvedDistrictLabel = districtLabel ?? t("jobs.location.districtLabel");
  const anyLabel = t(variant === "filter" ? "jobs.location.all" : "jobs.location.choose");

  useEffect(() => { loadRegions().then(setRegions); }, []);

  const regionId = regions.find((r) => r.name === region)?.id;
  useEffect(() => {
    if (!regionId) { setDistricts([]); return; }
    loadDistricts(regionId).then(setDistricts);
  }, [regionId]);

  const FieldLabel = ({ children }: { children: React.ReactNode }) =>
    variant === "filter"
      ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
      : <Label className="mb-1.5 block">{children}</Label>;

  const regionSelect = (
    <div>
      <FieldLabel>{resolvedRegionLabel}</FieldLabel>
      <select
        aria-label={resolvedRegionLabel}
        className={SELECT_CLS}
        value={region || ""}
        onChange={(e) => { onRegionChange(e.target.value); onDistrictChange(""); }}
      >
        <option value="">{anyLabel}</option>
        {regions.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
      </select>
    </div>
  );

  const districtSelect = (
    <div>
      <FieldLabel>{resolvedDistrictLabel}</FieldLabel>
      <select
        aria-label={resolvedDistrictLabel}
        className={SELECT_CLS}
        value={district || ""}
        disabled={!region || districts.length === 0}
        onChange={(e) => onDistrictChange(e.target.value)}
      >
        <option value="">
          {!region ? t("jobs.location.regionFirst") : districts.length === 0 ? "—" : anyLabel}
        </option>
        {districts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
      </select>
    </div>
  );

  return variant === "filter"
    ? <div className="space-y-5">{regionSelect}{districtSelect}</div>
    : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{regionSelect}{districtSelect}</div>;
}
