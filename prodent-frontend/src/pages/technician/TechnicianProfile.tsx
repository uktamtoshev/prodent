import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { TechnicianLayout } from "@/components/technician/TechnicianLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/system/StatePanel";
import { useToast } from "@/hooks/use-toast";
import { lab, type LabProfile, type LabServiceItem } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";

// Exported for the focused profile validation contract.
// eslint-disable-next-line react-refresh/only-export-components
export const validateNewLabService = (value: { work_type: string }) =>
  value.work_type.trim() ? {} : { work_type: "Укажите название работы" };

type TechnicianLoadState = "loading" | "error" | "ready";

// Technician's own lab profile (how clinics see them) + price-list. Both are
// owner-scoped on the server (/api/v1/lab/profile, /services).
export default function TechnicianProfile() {
  const { toast } = useToast();

  const [profile, setProfile] = useState<LabProfile | null>(null);
  const [services, setServices] = useState<LabServiceItem[]>([]);
  const [loadState, setLoadState] = useState<TechnicianLoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // New service draft.
  const [newService, setNewService] = useState({ work_type: "", price: "", unit: "шт" });
  const [newServiceErrors, setNewServiceErrors] = useState<{ work_type?: string }>({});
  const [addingService, setAddingService] = useState(false);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");
    try {
      const [p, s] = await Promise.all([lab.getProfile(), lab.listServices()]);
      if (!p) throw new Error("Профиль лаборатории не найден.");
      setProfile(p);
      setServices(s);
      setLoadState("ready");
    } catch (error: unknown) {
      setProfile(null);
      setServices([]);
      setLoadError(getErrorMessage(error, "Проверьте интернет и попробуйте снова."));
      setLoadState("error");
      toast({ title: "Не удалось загрузить профиль", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = <K extends keyof LabProfile>(k: K, v: LabProfile[K]) =>
    setProfile((p) => (p ? { ...p, [k]: v } : p));

  const saveProfile = async () => {
    if (!profile || loadState !== "ready") return;
    setSavingProfile(true);
    try {
      const updated = await lab.updateProfile({
        display_name: profile.display_name,
        description: profile.description,
        phone: profile.phone,
        city: profile.city,
        address: profile.address,
        is_public: profile.is_public,
      });
      setProfile((p) => (p ? { ...p, ...updated } : updated));
      toast({ title: "Профиль сохранён" });
    } catch (error: unknown) {
      toast({ title: "Не удалось сохранить", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const addService = async () => {
    if (loadState !== "ready") return;
    const errors = validateNewLabService(newService);
    if (errors.work_type) {
      setNewServiceErrors(errors);
      toast({ title: "Укажите название работы", variant: "destructive" });
      return;
    }
    setNewServiceErrors({});
    setAddingService(true);
    try {
      const created = await lab.createService({
        work_type: newService.work_type.trim(),
        price: newService.price ? Number(newService.price) : null,
        unit: newService.unit.trim() || "шт",
      });
      setServices((prev) => [...prev, created].sort((a, b) => a.work_type.localeCompare(b.work_type, "ru")));
      setNewService({ work_type: "", price: "", unit: "шт" });
      toast({ title: "Услуга добавлена" });
    } catch (error: unknown) {
      toast({ title: "Не удалось добавить", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    } finally {
      setAddingService(false);
    }
  };

  const patchService = async (id: string, body: Record<string, unknown>) => {
    if (loadState !== "ready") return;
    setSavingServiceId(id);
    try {
      const updated = await lab.updateService(id, body);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    } catch (error: unknown) {
      toast({ title: "Не удалось обновить услугу", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
      await load();
    } finally {
      setSavingServiceId(null);
    }
  };

  const removeService = async (id: string) => {
    if (loadState !== "ready") return;
    setSavingServiceId(id);
    try {
      await lab.deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (error: unknown) {
      toast({ title: "Не удалось удалить", description: getErrorMessage(error, "") || undefined, variant: "destructive" });
    } finally {
      setSavingServiceId(null);
    }
  };

  return (
    <TechnicianLayout title="Профиль лаборатории" subtitle="как вас видят клиники + прайс-лист">
      <div className="mx-auto max-w-[900px] space-y-6 p-4 sm:p-6 lg:p-8">
        {loadState === "loading" ? (
          <Card className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Загрузка…
          </Card>
        ) : loadState === "error" || !profile ? (
          <ErrorState
            title="Не удалось загрузить профиль лаборатории"
            description={loadError || "Проверьте интернет и попробуйте снова."}
            actionLabel="Попробовать снова"
            onAction={load}
          />
        ) : (
          <>
            {/* Profile card */}
            <Card className="p-4 sm:p-6">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Профиль</h2>
                <p className="mt-1 text-sm text-muted-foreground">Контакты и описание для клиник</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="technician-display-name">Название лаборатории</Label>
                  <Input
                    id="technician-display-name"
                    value={profile.display_name || ""}
                    onChange={(e) => setField("display_name", e.target.value)}
                    placeholder={profile.user_full_name || "Зуботехническая лаборатория"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="technician-phone">Телефон</Label>
                  <Input
                    id="technician-phone"
                    type="tel"
                    autoComplete="tel"
                    value={profile.phone || ""}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="technician-city">Город</Label>
                  <Input
                    id="technician-city"
                    value={profile.city || ""}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="Ташкент"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="technician-address">Адрес</Label>
                  <Input
                    id="technician-address"
                    autoComplete="street-address"
                    value={profile.address || ""}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="ул. Амира Темура, 12"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="technician-description">Описание</Label>
                  <Textarea
                    id="technician-description"
                    value={profile.description || ""}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Специализация, оборудование, сроки…"
                    rows={3}
                  />
                </div>
                <div className="flex min-h-11 items-center gap-3 sm:col-span-2">
                  <Switch
                    checked={profile.is_public}
                    onCheckedChange={(v) => setField("is_public", v)}
                    id="is_public"
                    className="h-11 w-12 px-1"
                  />
                  <Label htmlFor="is_public" className="flex min-h-11 cursor-pointer items-center">
                    Показывать в каталоге техников (клиники смогут выбрать вас)
                  </Label>
                </div>
              </div>
              <div className="mt-5 flex justify-stretch sm:justify-end">
                <Button type="button" onClick={saveProfile} disabled={savingProfile} aria-busy={savingProfile} className="min-h-11 w-full sm:w-auto">
                  {savingProfile ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Сохранить профиль
                </Button>
              </div>
            </Card>

            {/* Price-list */}
            <Card className="p-4 sm:p-6">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Прайс-лист</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Цены подставятся клинике при выборе работы
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {services.length === 0 ? (
                  <div className="py-4 text-center text-[13px] text-muted-foreground" role="status">
                    Пока нет услуг. Добавьте виды работ и цены ниже.
                  </div>
                ) : (
                  services.map((s) => (
                    <div
                      key={s.id}
                      className="grid grid-cols-1 items-center gap-2 rounded-prodent-input border border-border p-3 sm:grid-cols-[minmax(0,1fr)_120px_80px_auto]"
                    >
                      <Label htmlFor={`technician-service-${s.id}-work-type`} className="sr-only">Вид работы</Label>
                      <Input
                        id={`technician-service-${s.id}-work-type`}
                        defaultValue={s.work_type}
                        onBlur={(e) =>
                          e.target.value.trim() &&
                          e.target.value !== s.work_type &&
                          patchService(s.id, { work_type: e.target.value.trim() })
                        }
                      />
                      <Label htmlFor={`technician-service-${s.id}-price`} className="sr-only">Цена</Label>
                      <Input
                        id={`technician-service-${s.id}-price`}
                        type="number"
                        defaultValue={s.price ?? ""}
                        placeholder="цена"
                        onBlur={(e) =>
                          patchService(s.id, { price: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                      <Label htmlFor={`technician-service-${s.id}-unit`} className="sr-only">Единица измерения</Label>
                      <Input
                        id={`technician-service-${s.id}-unit`}
                        defaultValue={s.unit}
                        onBlur={(e) => e.target.value !== s.unit && patchService(s.id, { unit: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="min-h-11 min-w-11 justify-self-end text-destructive sm:justify-self-auto"
                        disabled={savingServiceId === s.id}
                        aria-busy={savingServiceId === s.id}
                        aria-label={`Удалить услугу: ${s.work_type}`}
                        onClick={() => removeService(s.id)}
                      >
                        {savingServiceId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Add row */}
              <div className="mt-4 grid grid-cols-1 items-end gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_120px_80px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="technician-new-service-work-type" className="text-xs">
                    Вид работы <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="technician-new-service-work-type"
                    value={newService.work_type}
                    required
                    aria-invalid={newServiceErrors.work_type ? true : undefined}
                    aria-describedby={newServiceErrors.work_type ? "technician-new-service-work-type-error" : undefined}
                    onChange={(e) => {
                      setNewService((n) => ({ ...n, work_type: e.target.value }));
                      if (newServiceErrors.work_type) setNewServiceErrors({});
                    }}
                    placeholder="Циркониевая коронка"
                  />
                  {newServiceErrors.work_type && (
                    <p id="technician-new-service-work-type-error" className="text-xs text-destructive" role="alert">
                      {newServiceErrors.work_type}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="technician-new-service-price" className="text-xs">Цена</Label>
                  <Input
                    id="technician-new-service-price"
                    type="number"
                    value={newService.price}
                    onChange={(e) => setNewService((n) => ({ ...n, price: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="technician-new-service-unit" className="text-xs">Ед.</Label>
                  <Input
                    id="technician-new-service-unit"
                    value={newService.unit}
                    onChange={(e) => setNewService((n) => ({ ...n, unit: e.target.value }))}
                  />
                </div>
                <Button
                  type="button"
                  onClick={addService}
                  disabled={addingService}
                  aria-busy={addingService}
                  className="min-h-11 w-full sm:w-auto"
                  aria-label="Добавить услугу"
                >
                  {addingService ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </TechnicianLayout>
  );
}
