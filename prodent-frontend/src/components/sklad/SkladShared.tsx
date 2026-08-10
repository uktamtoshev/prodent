import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatAmount } from "@/lib/localization";
import {
  sklad,
  type SkladItem,
  type SkladCategory,
  type SkladSupplier,
  type StockOpType,
} from "@/lib/sklad";

const UNITS = ["шт", "уп", "мл", "г", "л", "пара", "набор"];

// ── Item create/edit dialog ────────────────────────────────────────────────

export function ItemDialog({
  open,
  onOpenChange,
  onSaved,
  editItem,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  editItem?: SkladItem | null;
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<SkladCategory[]>([]);
  const [suppliers, setSuppliers] = useState<SkladSupplier[]>([]);
  const [form, setForm] = useState({
    name: "",
    category_id: "",
    unit: "шт",
    quantity: 0,
    min_quantity: 0,
    max_quantity: "",
    price_per_unit: "",
    supplier_id: "",
    brand: "",
    sku: "",
    location: "",
    expiry_date: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([sklad.listCategories(), sklad.listSuppliers()])
      .then(([c, s]) => {
        setCategories(c);
        setSuppliers(s);
      })
      .catch(() => {});
    if (editItem) {
      setForm({
        name: editItem.name ?? "",
        category_id: editItem.category_id ?? "",
        unit: editItem.unit ?? "шт",
        quantity: Number(editItem.quantity) || 0,
        min_quantity: Number(editItem.min_quantity) || 0,
        max_quantity: editItem.max_quantity != null ? String(editItem.max_quantity) : "",
        price_per_unit: editItem.price_per_unit != null ? String(editItem.price_per_unit) : "",
        supplier_id: editItem.supplier_id ?? "",
        brand: editItem.brand ?? "",
        sku: editItem.sku ?? "",
        location: editItem.location ?? "",
        expiry_date: editItem.expiry_date ? editItem.expiry_date.slice(0, 10) : "",
        notes: editItem.notes ?? "",
      });
    } else {
      setForm({
        name: "", category_id: "", unit: "шт", quantity: 0, min_quantity: 0,
        max_quantity: "", price_per_unit: "", supplier_id: "", brand: "", sku: "",
        location: "", expiry_date: "", notes: "",
      });
    }
  }, [open, editItem]);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("sklad.dialogs.enterItemName"));
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const sup = suppliers.find((s) => s.id === form.supplier_id);
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category_id: form.category_id || null,
        category: cat?.name ?? null,
        unit: form.unit,
        min_quantity: form.min_quantity,
        max_quantity: form.max_quantity === "" ? null : Number(form.max_quantity),
        price_per_unit: form.price_per_unit === "" ? null : Number(form.price_per_unit),
        supplier_id: form.supplier_id || null,
        supplier: sup?.name ?? null,
        brand: form.brand || null,
        sku: form.sku || null,
        location: form.location || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      };
      if (editItem) {
        await sklad.updateItem(editItem.id, payload);
        toast.success(t("sklad.dialogs.itemUpdated"));
      } else {
        // Opening balance only on create; later changes go through stock ops.
        payload.quantity = form.quantity;
        await sklad.createItem(payload);
        toast.success(t("sklad.dialogs.itemAdded"));
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(t("sklad.dialogs.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {t(editItem ? "sklad.dialogs.itemEditTitle" : "sklad.dialogs.itemNewTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("sklad.dialogs.itemName")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sklad-item-name">{t("sklad.dialogs.itemName")}</Label>
            <Input
              id="sklad-item-name"
              className="min-h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("sklad.dialogs.itemNamePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-category">{t("sklad.dialogs.category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger id="sklad-item-category" className="min-h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-supplier">{t("sklad.dialogs.supplier")}</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger id="sklad-item-supplier" className="min-h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {!editItem && (
              <div className="grid gap-2">
                <Label htmlFor="sklad-item-opening-stock">{t("sklad.dialogs.openingStock")}</Label>
                <Input
                  id="sklad-item-opening-stock"
                  className="min-h-11"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-minimum-stock">{t("sklad.dialogs.minimumStock")}</Label>
              <Input
                id="sklad-item-minimum-stock"
                className="min-h-11"
                type="number"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-unit">{t("sklad.dialogs.unit")}</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger id="sklad-item-unit" className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-price">{t("sklad.dialogs.pricePerUnit")}</Label>
              <Input
                id="sklad-item-price"
                className="min-h-11"
                type="number"
                value={form.price_per_unit}
                onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-expiry">{t("sklad.dialogs.expiryDate")}</Label>
              <Input
                id="sklad-item-expiry"
                className="min-h-11"
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-brand">{t("sklad.dialogs.brand")}</Label>
              <Input id="sklad-item-brand" className="min-h-11" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-sku">{t("sklad.dialogs.sku")}</Label>
              <Input id="sklad-item-sku" className="min-h-11" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sklad-item-location">{t("sklad.dialogs.location")}</Label>
              <Input id="sklad-item-location" className="min-h-11" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sklad-item-notes">{t("sklad.dialogs.notes")}</Label>
            <Textarea id="sklad-item-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button className="min-h-11" variant="outline" onClick={() => onOpenChange(false)}>{t("sklad.dialogs.cancel")}</Button>
          <Button className="min-h-11" onClick={save} disabled={saving}>
            {saving
              ? t("sklad.dialogs.saving")
              : t(editItem ? "sklad.dialogs.save" : "sklad.dialogs.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock movement dialog ──────────────────────────────────────────────────

export function StockDialog({
  open,
  onOpenChange,
  onDone,
  type,
  items,
  preselectedId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
  type: StockOpType;
  items: SkladItem[];
  preselectedId?: string | null;
}) {
  const { t, language } = useLanguage();
  const operationTitle = t(`sklad.${type}`);
  const [saving, setSaving] = useState(false);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [appointmentId, setAppointmentId] = useState("");

  useEffect(() => {
    if (open) {
      setItemId(preselectedId ?? "");
      setQuantity(1);
      setReason("");
      setBatchNumber("");
      setExpiryDate("");
      setAppointmentId("");
    }
  }, [open, preselectedId]);

  const selected = items.find((i) => i.id === itemId);

  const submit = async () => {
    if (!itemId) return toast.error(t("sklad.dialogs.selectItem"));
    if (type !== "adjustment" && quantity <= 0) {
      return toast.error(t("sklad.dialogs.positiveQuantity"));
    }
    if (type === "income" && !batchNumber.trim()) {
      return toast.error(t("sklad.dialogs.batchRequired"));
    }
    setSaving(true);
    try {
      const client_request_id = crypto.randomUUID();
      if (type === "income") {
        await sklad.receive(itemId, {
          quantity,
          batch_number: batchNumber.trim() || undefined,
          expiry_date: expiryDate || undefined,
          supplier_id: selected?.supplier_id || undefined,
          reason: reason.trim() || undefined,
          client_request_id,
        });
      } else {
        await sklad.stock(itemId, type, quantity, reason || undefined, {
          client_request_id,
          appointment_id:
            type === "expense" && appointmentId.trim()
              ? appointmentId.trim()
              : undefined,
        });
      }
      toast.success(t("sklad.dialogs.operationDone"));
      onDone();
      onOpenChange(false);
    } catch {
      toast.error(t("sklad.dialogs.operationError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{operationTitle}</DialogTitle>
          <DialogDescription className="sr-only">{operationTitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sklad-stock-item">{t("sklad.dialogs.item")}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger id="sklad-stock-item" className="min-h-11"><SelectValue placeholder={t("sklad.dialogs.selectItem")} /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({formatAmount(Number(i.quantity), language)} {i.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sklad-stock-quantity">
              {t(type === "adjustment" ? "sklad.dialogs.newStock" : "sklad.dialogs.quantity")}
            </Label>
            <Input
              id="sklad-stock-quantity"
              className="min-h-11"
              type="number"
              min={type === "adjustment" ? 0 : 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            {selected && (
              <p className="text-xs text-muted-foreground">
                {t("sklad.dialogs.currentStock")}:{" "}
                {formatAmount(Number(selected.quantity), language)} {selected.unit}
              </p>
            )}
          </div>
          {type === "income" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sklad-stock-batch">{t("sklad.dialogs.batchNumber")}</Label>
                <Input id="sklad-stock-batch" className="min-h-11" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="LOT-2026-001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sklad-stock-batch-expiry">{t("sklad.dialogs.batchExpiry")}</Label>
                <Input id="sklad-stock-batch-expiry" className="min-h-11" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
          )}
          {type === "expense" && (
            <div className="grid gap-2">
              <Label htmlFor="sklad-stock-appointment">{t("sklad.dialogs.appointmentOptional")}</Label>
              <Input id="sklad-stock-appointment" className="min-h-11" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} placeholder={t("sklad.dialogs.appointmentPlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("sklad.dialogs.appointmentHint")}</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="sklad-stock-reason">{t("sklad.dialogs.reason")}</Label>
            <Textarea id="sklad-stock-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="min-h-11" variant="outline" onClick={() => onOpenChange(false)}>{t("sklad.dialogs.cancel")}</Button>
          <Button className="min-h-11" onClick={submit} disabled={saving} variant={type === "expense" ? "destructive" : "default"}>
            {saving ? t("sklad.dialogs.saving") : operationTitle}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransferDialog({
  open,
  onOpenChange,
  onDone,
  items,
  preselectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  items: SkladItem[];
  preselectedId?: string | null;
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setSourceId(preselectedId ?? "");
    setDestinationId("");
    setQuantity(1);
    setReason("");
  }, [open, preselectedId]);

  const submit = async () => {
    if (!sourceId || !destinationId) {
      return toast.error(t("sklad.dialogs.selectSourceDestination"));
    }
    if (sourceId === destinationId) {
      return toast.error(t("sklad.dialogs.differentDestination"));
    }
    if (quantity <= 0) {
      return toast.error(t("sklad.dialogs.positiveQuantity"));
    }
    setSaving(true);
    try {
      await sklad.transfer(sourceId, {
        destination_inventory_id: destinationId,
        quantity,
        reason: reason.trim() || undefined,
        client_request_id: crypto.randomUUID(),
      });
      toast.success(t("sklad.dialogs.materialsTransferred"));
      onDone();
      onOpenChange(false);
    } catch {
      toast.error(t("sklad.dialogs.transferError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("sklad.transfer")}</DialogTitle>
          <DialogDescription className="sr-only">{t("sklad.transfer")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sklad-transfer-source">{t("sklad.dialogs.source")}</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger id="sklad-transfer-source" className="min-h-11"><SelectValue placeholder={t("sklad.dialogs.selectItem")} /></SelectTrigger>
              <SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.location || t("sklad.dialogs.noLocation")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sklad-transfer-destination">{t("sklad.dialogs.destination")}</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger id="sklad-transfer-destination" className="min-h-11"><SelectValue placeholder={t("sklad.dialogs.destination")} /></SelectTrigger>
              <SelectContent>{items.filter((item) => item.id !== sourceId).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.location || t("sklad.dialogs.noLocation")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sklad-transfer-quantity">{t("sklad.dialogs.quantity")}</Label>
            <Input id="sklad-transfer-quantity" className="min-h-11" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sklad-transfer-comment">{t("sklad.dialogs.comment")}</Label>
            <Textarea id="sklad-transfer-comment" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="min-h-11" variant="outline" onClick={() => onOpenChange(false)}>{t("sklad.dialogs.cancel")}</Button>
          <Button className="min-h-11" onClick={submit} disabled={saving}>
            {t(saving ? "sklad.dialogs.moving" : "sklad.dialogs.move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryCountDialog({
  open,
  onOpenChange,
  onDone,
  items,
  preselectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  items: SkladItem[];
  preselectedId?: string | null;
}) {
  const { t, language } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [itemId, setItemId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const selected = items.find((item) => item.id === preselectedId);
    setItemId(preselectedId ?? "");
    setCountedQuantity(Number(selected?.quantity) || 0);
    setNote("");
  }, [items, open, preselectedId]);

  const selectItem = (id: string) => {
    setItemId(id);
    setCountedQuantity(Number(items.find((item) => item.id === id)?.quantity) || 0);
  };

  const submit = async () => {
    if (!itemId) return toast.error(t("sklad.dialogs.selectItem"));
    if (countedQuantity < 0) {
      return toast.error(t("sklad.dialogs.nonNegativeStock"));
    }
    setSaving(true);
    try {
      await sklad.inventoryCount(itemId, {
        counted_quantity: countedQuantity,
        note: note.trim() || undefined,
        client_request_id: crypto.randomUUID(),
      });
      toast.success(t("sklad.dialogs.inventorySaved"));
      onDone();
      onOpenChange(false);
    } catch {
      toast.error(t("sklad.dialogs.inventoryError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{t("sklad.dialogs.inventoryTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("sklad.dialogs.actualStock")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sklad-inventory-item">{t("sklad.dialogs.item")}</Label>
            <Select value={itemId} onValueChange={selectItem}>
              <SelectTrigger id="sklad-inventory-item" className="min-h-11"><SelectValue placeholder={t("sklad.dialogs.selectItem")} /></SelectTrigger>
              <SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {t("sklad.dialogs.systemStock")}: {formatAmount(Number(item.quantity), language)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sklad-inventory-actual">{t("sklad.dialogs.actualStock")}</Label>
            <Input id="sklad-inventory-actual" className="min-h-11" type="number" min={0} value={countedQuantity} onChange={(e) => setCountedQuantity(Number(e.target.value))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sklad-inventory-note">{t("sklad.dialogs.note")}</Label>
            <Textarea id="sklad-inventory-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="min-h-11" variant="outline" onClick={() => onOpenChange(false)}>{t("sklad.dialogs.cancel")}</Button>
          <Button className="min-h-11" onClick={submit} disabled={saving}>
            {t(saving ? "sklad.dialogs.inventorySaving" : "sklad.dialogs.record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
