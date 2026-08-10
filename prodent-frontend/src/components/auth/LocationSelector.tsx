import { useState, useEffect, lazy, Suspense } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Region {
  id: string;
  name: string;
  country_id: string;
}

interface District {
  id: string;
  name: string;
  region_id: string;
}

interface LocationSelectorProps {
  country?: string;
  region: string;
  district: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  onCountryChange?: (value: string) => void;
  onRegionChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onLocationChange?: (lat: number, lng: number) => void;
  disabled?: boolean;
  errors?: {
    country?: string;
    region?: string;
    district?: string;
    address?: string;
    location?: string;
  };
  showAddress?: boolean;
  showMap?: boolean;
  required?: boolean;
}

const countryFlags: Record<string, string> = {
  UZ: "🇺🇿",
  KZ: "🇰🇿",
  KG: "🇰🇬",
  TJ: "🇹🇯",
  TM: "🇹🇲",
};

const MapPickerLazy = lazy(() => import("./MapPicker").then(m => ({ default: m.MapPicker })));

export function LocationSelector({
  country,
  region,
  district,
  address,
  latitude,
  longitude,
  onCountryChange,
  onRegionChange,
  onDistrictChange,
  onAddressChange,
  onLocationChange,
  disabled = false,
  errors = {},
  showAddress = true,
  showMap = true,
  required = true,
}: LocationSelectorProps) {
  const { t } = useLanguage();
  const effectiveCountry = country ?? t("auth.uzbekistan");
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [loading, setLoading] = useState({ countries: true, regions: false, districts: false });

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(prev => ({ ...prev, countries: true }));
      const { data, error } = await supabase
        .from("countries")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order");

      if (!error && data) {
        setCountries(data);
        // Find country by name or default to Uzbekistan
        const found = data.find(c => c.name === effectiveCountry) || data.find(c => c.code === "UZ");
        if (found) {
          setSelectedCountryId(found.id);
          if (onCountryChange && found.name !== effectiveCountry) {
            onCountryChange(found.name);
          }
        }
      }
      setLoading(prev => ({ ...prev, countries: false }));
    };
    fetchCountries();
  }, [effectiveCountry, onCountryChange]);

  // Fetch regions when country changes
  useEffect(() => {
    if (!selectedCountryId) {
      setRegions([]);
      return;
    }

    const fetchRegions = async () => {
      setLoading(prev => ({ ...prev, regions: true }));
      const { data, error } = await supabase
        .from("regions")
        .select("id, name, country_id")
        .eq("country_id", selectedCountryId)
        .eq("is_active", true)
        .order("sort_order");

      if (!error && data) {
        setRegions(data);
        // Try to find matching region
        const found = data.find(r => r.name === region);
        if (found) {
          setSelectedRegionId(found.id);
        } else {
          setSelectedRegionId("");
        }
      }
      setLoading(prev => ({ ...prev, regions: false }));
    };
    fetchRegions();
  }, [region, selectedCountryId]);

  // Fetch districts when region changes
  useEffect(() => {
    if (!selectedRegionId) {
      setDistricts([]);
      return;
    }

    const fetchDistricts = async () => {
      setLoading(prev => ({ ...prev, districts: true }));
      const { data, error } = await supabase
        .from("districts")
        .select("id, name, region_id")
        .eq("region_id", selectedRegionId)
        .eq("is_active", true)
        .order("sort_order");

      if (!error && data) {
        setDistricts(data);
      }
      setLoading(prev => ({ ...prev, districts: false }));
    };
    fetchDistricts();
  }, [selectedRegionId]);

  const handleCountryChange = (countryId: string) => {
    setSelectedCountryId(countryId);
    const selectedCountry = countries.find(c => c.id === countryId);
    if (selectedCountry && onCountryChange) {
      onCountryChange(selectedCountry.name);
    }
    // Reset region and district when country changes
    setSelectedRegionId("");
    onRegionChange("");
    onDistrictChange("");
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    const selectedRegion = regions.find(r => r.id === regionId);
    if (selectedRegion) {
      onRegionChange(selectedRegion.name);
    }
    // Reset district when region changes
    onDistrictChange("");
  };

  const handleDistrictChange = (districtId: string) => {
    const selectedDistrict = districts.find(d => d.id === districtId);
    if (selectedDistrict) {
      onDistrictChange(selectedDistrict.name);
    }
  };

  const getCountryFlag = (code: string) => countryFlags[code] || "🌍";

  return (
    <div className="space-y-4">
      {/* Country */}
      <div className="space-y-2">
        <Label>{t("auth.country")} {required && "*"}</Label>
        <Select
          value={selectedCountryId}
          onValueChange={handleCountryChange}
          disabled={disabled || loading.countries}
        >
          <SelectTrigger className={errors.country ? "border-destructive" : ""}>
            <SelectValue placeholder={loading.countries ? t("auth.loadingPlaceholder") : t("auth.selectCountry")}>
              {selectedCountryId && countries.find(c => c.id === selectedCountryId) && (
                <>
                  {getCountryFlag(countries.find(c => c.id === selectedCountryId)!.code)}{" "}
                  {countries.find(c => c.id === selectedCountryId)!.name}
                </>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {getCountryFlag(c.code)} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
      </div>

      {/* Region/City */}
      <div className="space-y-2">
        <Label>{t("auth.regionCity")} {required && "*"}</Label>
        <Select
          value={selectedRegionId}
          onValueChange={handleRegionChange}
          disabled={disabled || !selectedCountryId || loading.regions}
        >
          <SelectTrigger className={errors.region ? "border-destructive" : ""}>
            <SelectValue placeholder={
              loading.regions ? t("auth.loadingPlaceholder") :
              !selectedCountryId ? t("auth.selectCountryFirst") :
              t("auth.selectRegion")
            } />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.region && <p className="text-sm text-destructive">{errors.region}</p>}
      </div>

      {/* District */}
      <div className="space-y-2">
        <Label>{t("auth.district")}</Label>
        <Select
          value={districts.find(d => d.name === district)?.id || ""}
          onValueChange={handleDistrictChange}
          disabled={disabled || !selectedRegionId || loading.districts || districts.length === 0}
        >
          <SelectTrigger className={errors.district ? "border-destructive" : ""}>
            <SelectValue placeholder={
              loading.districts ? t("auth.loadingPlaceholder") :
              !selectedRegionId ? t("auth.selectRegionFirst") :
              districts.length === 0 ? t("auth.noDistricts") :
              t("auth.selectDistrict")
            } />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.district && <p className="text-sm text-destructive">{errors.district}</p>}
      </div>

      {/* Address */}
      {showAddress && (
        <div className="space-y-2">
          <Label htmlFor="address">{t("auth.address")} {required && "*"}</Label>
          <Input
            id="address"
            placeholder=""
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            disabled={disabled}
            className={errors.address ? "border-destructive" : ""}
          />
          {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
        </div>
      )}

      {/* Map Picker */}
      {showMap && onLocationChange && (
        <Suspense fallback={<div className="h-[250px] rounded-xl bg-muted animate-pulse" />}>
          <MapPickerLazy
            latitude={latitude ?? null}
            longitude={longitude ?? null}
            onLocationChange={onLocationChange}
            disabled={disabled}
            error={errors.location}
          />
        </Suspense>
      )}
    </div>
  );
}
