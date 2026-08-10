import { useEffect, useState } from "react";
import { Mail, Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sklad, type SkladSupplier } from "@/lib/sklad";
import { useSkladPermissions } from "@/hooks/useSkladPermissions";

const EMPTY = {
  name: "", contact_person: "", phone: "", email: "", address: "", website: "", inn: "", notes: "",
};

export default function SkladSuppliers() {
  const { canManageCatalog } = useSkladPermissions();
  const [rows, setRows] = useState<SkladSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SkladSupplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const load = () => {
    setLoading(true);
    sklad.listSuppliers().then(setRows).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setEdit(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (s: SkladSupplier) => {
    setEdit(s);
    setForm({
      name: s.name ?? "", contact_person: s.contact_person ?? "", phone: s.phone ?? "",
      email: s.email ?? "", address: s.address ?? "", website: s.website ?? "",
      inn: s.inn ?? "", notes: s.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Введите название");
    setSaving(true);
    try {
      if (edit) await sklad.updateSupplier(edit.id, form);
      else await sklad.createSupplier(form);
      toast.success("Сохранено");
      setOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? (e instanceof Error ? e.message : undefined) : undefined) || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: SkladSupplier) => {
    if (!window.confirm(`Удалить поставщика «${s.name}»?`)) return;
    try { await sklad.deleteSupplier(s.id); load(); } catch (e: unknown) { toast.error((e instanceof Error ? (e instanceof Error ? e.message : undefined) : undefined) || "Ошибка"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
            <Truck className="h-6 w-6 text-brand" /> Поставщики
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Контакты и реквизиты поставщиков</p>
        </div>
        {canManageCatalog && (
          <button
            onClick={openNew}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn bg-brand px-3.5 text-sm font-semibold text-white shadow-design-btn transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Поставщик
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="col-span-full rounded-prodent border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Поставщиков пока нет
          </div>
        ) : (
          rows.map((s) => (
            <div key={s.id} className="rounded-prodent border border-border bg-card p-4 shadow-design-card">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{s.name}</div>
                  {s.contact_person && <div className="text-xs text-muted-foreground">{s.contact_person}</div>}
                </div>
                {canManageCatalog && <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="grid h-8 w-8 place-items-center rounded-prodent-input text-muted-foreground hover:bg-muted">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(s)} className="grid h-8 w-8 place-items-center rounded-prodent-input text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>}
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {s.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {s.phone}</div>}
                {s.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {s.email}</div>}
                {s.inn && <div>ИНН: {s.inn}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {canManageCatalog && <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{edit ? "Редактировать поставщика" : "Новый поставщик"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Контактное лицо</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Телефон</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>ИНН</Label>
                <Input value={form.inn} onChange={(e) => setForm({ ...form, inn: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Адрес</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Сайт</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Заметки</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : "Сохранить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
