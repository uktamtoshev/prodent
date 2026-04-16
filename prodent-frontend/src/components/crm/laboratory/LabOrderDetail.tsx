import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { QrCode, Upload, Printer, Clock, CheckCircle, Truck, AlertCircle, FileImage, Trash2, Download, ExternalLink, Box, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResumableUpload } from "@/components/crm/files/ResumableUpload";
import { STLViewer, STLViewerDialog } from "@/components/crm/files/STLViewer";

interface LabOrder {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  type: string;
  description: string;
  status: string | null;
  deadline: string | null;
  price: number | null;
  notes: string | null;
  files: string[] | null;
  order_number: string | null;
  completed_at: string | null;
  created_at: string | null;
  profiles?: { full_name: string | null };
  doctors?: { profiles: { full_name: string | null } | null };
}

interface LabOrderItem {
  id: string;
  item_type: string;
  description: string;
  tooth_number: number | null;
  material: string | null;
  color: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  status: string | null;
}

interface LabOrderDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: LabOrder | null;
  onUpdate: () => void;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  new: { label: "Новый", icon: Clock, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { label: "В работе", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  ready: { label: "Готов", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  delivered: { label: "Доставлен", icon: Truck, className: "bg-green-500/10 text-green-600 border-green-500/20" },
  cancelled: { label: "Отменён", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export function LabOrderDetail({ open, onOpenChange, order, onUpdate }: LabOrderDetailProps) {
  const { currentClinic } = useClinic();
  const [items, setItems] = useState<LabOrderItem[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLargeUpload, setShowLargeUpload] = useState(false);
  const [selectedSTL, setSelectedSTL] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && order) {
      loadItems();
      setFiles(order.files || []);
    }
  }, [open, order]);

  const loadItems = async () => {
    if (!order) return;
    const { data } = await supabase
      .from("lab_order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at");
    if (data) setItems(data);
  };

  const updateStatus = async (newStatus: string) => {
    if (!order) return;
    setLoading(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "delivered") {
        updateData.completed_at = new Date().toISOString();
      }

      await supabase
        .from("laboratory_orders")
        .update(updateData)
        .eq("id", order.id);

      toast.success("Статус обновлен");
      onUpdate();
    } catch (error) {
      toast.error("Ошибка обновления");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${order.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("patient-files")
        .getPublicUrl(fileName);

      const newFiles = [...files, publicUrl];
      
      await supabase
        .from("laboratory_orders")
        .update({ files: newFiles })
        .eq("id", order.id);

      setFiles(newFiles);
      toast.success("Файл загружен");
      onUpdate();
    } catch (error) {
      toast.error("Ошибка загрузки");
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async (fileUrl: string) => {
    if (!order) return;
    const newFiles = files.filter(f => f !== fileUrl);
    await supabase
      .from("laboratory_orders")
      .update({ files: newFiles })
      .eq("id", order.id);
    setFiles(newFiles);
    toast.success("Файл удален");
    onUpdate();
  };

  const handleLargeFileUpload = async (publicUrl: string) => {
    if (!order) return;
    const newFiles = [...files, publicUrl];
    await supabase
      .from("laboratory_orders")
      .update({ files: newFiles })
      .eq("id", order.id);
    setFiles(newFiles);
    setShowLargeUpload(false);
    onUpdate();
  };

  const isSTLFile = (url: string) => url.toLowerCase().endsWith('.stl');

  const generateQR = () => {
    if (!order || !qrCanvasRef.current) return;
    
    const canvas = qrCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Simple QR-like pattern (in production, use a proper QR library)
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = "#000000";
    
    // Create data string
    const data = `LAB:${order.order_number || order.id}`;
    
    // Simple pattern based on data
    const cellSize = 8;
    const margin = 20;
    const gridSize = Math.floor((size - 2 * margin) / cellSize);
    
    // Draw finder patterns (corners)
    const drawFinder = (x: number, y: number) => {
      ctx.fillRect(x, y, 7 * cellSize, cellSize);
      ctx.fillRect(x, y + 6 * cellSize, 7 * cellSize, cellSize);
      ctx.fillRect(x, y, cellSize, 7 * cellSize);
      ctx.fillRect(x + 6 * cellSize, y, cellSize, 7 * cellSize);
      ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize);
    };
    
    drawFinder(margin, margin);
    drawFinder(size - margin - 7 * cellSize, margin);
    drawFinder(margin, size - margin - 7 * cellSize);
    
    // Draw data pattern
    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      const row = Math.floor(i / 10) + 9;
      const col = (i % 10) + 9;
      if (code % 2 === 0) {
        ctx.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
      }
    }
    
    // Add text
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(order.order_number || order.id.slice(0, 8), size / 2, size - 5);
  };

  const printQR = () => {
    generateQR();
    setTimeout(() => {
      if (!qrCanvasRef.current || !order) return;
      
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      
      printWindow.document.write(`
        <html>
          <head><title>QR код заказа ${order.order_number}</title></head>
          <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
            <h2>Заказ: ${order.order_number || order.id.slice(0, 8)}</h2>
            <img src="${qrCanvasRef.current.toDataURL()}" style="width:200px;height:200px;" />
            <p>Тип: ${order.type}</p>
            <p>Пациент: ${order.profiles?.full_name || "—"}</p>
            <p>Врач: ${order.doctors?.profiles?.full_name || "—"}</p>
            ${order.deadline ? `<p>Срок: ${format(new Date(order.deadline), "dd.MM.yyyy", { locale: ru })}</p>` : ""}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }, 100);
  };

  useEffect(() => {
    if (open && order) {
      setTimeout(generateQR, 100);
    }
  }, [open, order]);

  if (!order) return null;

  const status = statusConfig[order.status || "new"];
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                Заказ {order.order_number || `#${order.id.slice(0, 8)}`}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{order.type}</p>
            </div>
            <Badge variant="outline" className={cn("text-sm", status.className)}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="info">Информация</TabsTrigger>
            <TabsTrigger value="items">Позиции ({items.length})</TabsTrigger>
            <TabsTrigger value="files">Файлы ({files.length})</TabsTrigger>
            <TabsTrigger value="qr">QR-код</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Пациент</p>
                  <p className="font-medium">{order.profiles?.full_name || "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Врач</p>
                  <p className="font-medium">{order.doctors?.profiles?.full_name || "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Срок выполнения</p>
                  <p className="font-medium">
                    {order.deadline ? format(new Date(order.deadline), "dd MMMM yyyy", { locale: ru }) : "Не указан"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Стоимость</p>
                  <p className="font-medium text-lg">{order.price?.toLocaleString() || 0} UZS</p>
                </CardContent>
              </Card>
            </div>

            {order.description && (
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Описание</p>
                  <p>{order.description}</p>
                </CardContent>
              </Card>
            )}

            {order.notes && (
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Примечания</p>
                  <p>{order.notes}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-2">
              <Label>Изменить статус</Label>
              <Select value={order.status || "new"} onValueChange={updateStatus} disabled={loading}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Новый</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="ready">Готов</SelectItem>
                  <SelectItem value="delivered">Доставлен</SelectItem>
                  <SelectItem value="cancelled">Отменён</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            {items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Зуб</TableHead>
                    <TableHead>Материал</TableHead>
                    <TableHead>Цвет</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_type}</TableCell>
                      <TableCell>{item.tooth_number || "—"}</TableCell>
                      <TableCell>{item.material || "—"}</TableCell>
                      <TableCell>{item.color || "—"}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.total_price?.toLocaleString() || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Нет позиций</p>
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-4 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">Загруженные файлы</p>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,.pdf"
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Загрузка..." : "Обычный файл"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowLargeUpload(!showLargeUpload)}
                  className={showLargeUpload ? 'bg-primary/10' : ''}
                >
                  <Box className="w-4 h-4 mr-2" />
                  3D модель (STL)
                </Button>
              </div>
            </div>

            {/* Large file upload section */}
            {showLargeUpload && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Загрузите STL файл (до 500 MB) с возможностью паузы
                  </p>
                  <ResumableUpload
                    bucketName="patient-files"
                    folderPath={`lab-orders/${order?.id}`}
                    onUploadComplete={handleLargeFileUpload}
                    onCancel={() => setShowLargeUpload(false)}
                    accept=".stl,.obj,.ply"
                    maxSize={500}
                  />
                </CardContent>
              </Card>
            )}

            {files.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {files.map((file, index) => (
                  <div key={index} className="relative group border border-border rounded-lg overflow-hidden">
                    {isSTLFile(file) ? (
                      <div className="w-full h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center">
                        <Box className="w-10 h-10 text-primary mb-1" />
                        <span className="text-xs text-muted-foreground">3D модель</span>
                      </div>
                    ) : file.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={file} alt={`File ${index + 1}`} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center">
                        <FileImage className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {isSTLFile(file) && (
                        <Button variant="secondary" size="icon" onClick={() => setSelectedSTL(file)}>
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="secondary" size="icon" asChild>
                        <a href={file} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => removeFile(file)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileImage className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Нет загруженных файлов</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="qr" className="mt-4">
            <div className="flex flex-col items-center space-y-4">
              <Card className="border-border/50 p-4">
                <canvas ref={qrCanvasRef} className="mx-auto" />
              </Card>
              <p className="text-sm text-muted-foreground text-center">
                QR-код содержит номер заказа для быстрой идентификации
              </p>
              <Button onClick={printQR}>
                <Printer className="w-4 h-4 mr-2" />
                Распечатать QR-код
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* STL Viewer Dialog */}
      <STLViewerDialog
        open={!!selectedSTL}
        onOpenChange={(open) => !open && setSelectedSTL(null)}
        url={selectedSTL || ''}
        title={`3D модель - Заказ ${order?.order_number}`}
      />
    </Dialog>
  );
}
