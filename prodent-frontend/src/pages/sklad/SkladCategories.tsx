import { useEffect, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sklad, type SkladCategory } from "@/lib/sklad";
import { useSkladPermissions } from "@/hooks/useSkladPermissions";

export default function SkladCategories() {
  const { canManageCatalog } = useSkladPermissions();
  const [rows, setRows] = useState<SkladCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SkladCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#0D9488" });

  const load = () => {
    setLoading(true);
    sklad.listCategories().then(setRows).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => {
    setEdit(null);
    setForm({ name: "", description: "", color: "#0D9488" });
    setOpen(true);
  };
  const openEdit = (c: SkladCategory) => {
    setEdit(c);
    setForm({ name: c.name, description: c.description ?? "", color: c.color ?? "#0D9488" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Введите название");
    setSaving(true);
    try {
      if (edit) await sklad.updateCategory(edit.id, form);
      else await sklad.createCategory(form);
      toast.success("Сохранено");
      setOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? (e instanceof Error ? e.message : undefined) : undefined) || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: SkladCategory) => {
    if (!window.confirm(`Удалить категорию «${c.name}»?`)) return;
    try {
      await sklad.deleteCategory(c.id);
      load();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? (e instanceof Error ? e.message : undefined) : undefined) || "Ошибка");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
            <Tags className="h-6 w-6 text-brand" /> Категории
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Группировка позиций склада</p>
        </div>
        {canManageCatalog && (
          <button
            onClick={openNew}
            className="inline-flex h-9 items-center gap-2 rounded-prodent-btn bg-brand px-3.5 text-sm font-semibold text-white shadow-design-btn transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Категория
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="col-span-full rounded-prodent border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Категорий пока нет
          </div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-prodent border border-border bg-card p-4 shadow-design-card">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-prodent-input" style={{ backgroundColor: c.color || "#0D9488" }} />
                <div>
                  <div className="font-semibold text-foreground">{c.name}</div>
                  {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                </div>
              </div>
              {canManageCatalog && <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="grid h-8 w-8 place-items-center rounded-prodent-input text-muted-foreground hover:bg-muted">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(c)} className="grid h-8 w-8 place-items-center rounded-prodent-input text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>}
            </div>
          ))
        )}
      </div>

      {canManageCatalog && <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{edit ? "Редактировать категорию" : "Новая категория"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Название *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Описание</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Цвет</Label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20 cursor-pointer rounded-prodent-input border border-border"
              />
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
