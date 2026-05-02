import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/api/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Image as ImageIcon,
  Loader2,
  Download,
  Eye,
  FolderOpen
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface PatientFile {
  id: string;
  file_url: string;
  file_type: string;
  description: string | null;
  created_at: string;
  title: string;
}

const PatientFiles = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchFiles();
    }
  }, [user?.id]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('patient_files')
        .select('id, file_url, file_type, description, created_at, title')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false }) as any;

      if (data) {
        setFiles(data);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'xray': return '📷';
      case 'ct': return '🔬';
      case 'dicom': return '🩻';
      case 'photo': return '🖼️';
      case 'photo_before': return '📸';
      case 'photo_after': return '📸';
      case 'model_3d': return '🎲';
      case 'document': return '📄';
      default: return '📁';
    }
  };

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'xray': return 'Рентген';
      case 'ct': return 'КТ снимок';
      case 'dicom': return 'DICOM';
      case 'photo': return 'Фото';
      case 'photo_before': return 'Фото (до)';
      case 'photo_after': return 'Фото (после)';
      case 'model_3d': return '3D модель';
      case 'document': return 'Документ';
      default: return 'Другое';
    }
  };

  const scans = files.filter(f => ['xray', 'ct', 'dicom'].includes(f.file_type));
  const photos = files.filter(f => ['photo', 'photo_before', 'photo_after'].includes(f.file_type));
  const documents = files.filter(f => !['xray', 'ct', 'dicom', 'photo', 'photo_before', 'photo_after'].includes(f.file_type));

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  const FileCard = ({ file }: { file: PatientFile }) => (
    <Card className="border-border/50 hover:border-primary/20 transition-all group overflow-hidden">
      <CardContent className="p-0">
        <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
          {['photo', 'before_after'].includes(file.file_type) ? (
            <img 
              src={file.file_url} 
              alt={file.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl">{getFileTypeIcon(file.file_type)}</span>
          )}
          
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" asChild>
              <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                <Eye className="w-4 h-4 mr-1" />
                Открыть
              </a>
            </Button>
          </div>
        </div>
        
        <div className="p-3 space-y-2">
          <Badge variant="outline" className="text-xs">
            {getFileTypeLabel(file.file_type)}
          </Badge>
          <p className="text-sm font-medium truncate" title={file.title}>
            {file.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(file.created_at), 'd MMM yyyy', { locale: ru })}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <Card className="border-border/50">
      <CardContent className="text-center py-12">
        <Icon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Мои файлы</h1>
          <p className="text-muted-foreground mt-1">Снимки, фото и документы</p>
        </div>

        <Tabs defaultValue="scans" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="scans">🦷 Снимки ({scans.length})</TabsTrigger>
            <TabsTrigger value="photos">📸 Фото ({photos.length})</TabsTrigger>
            <TabsTrigger value="documents">📄 Документы ({documents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scans">
            {scans.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {scans.map(file => <FileCard key={file.id} file={file} />)}
              </div>
            ) : (
              <EmptyState icon={FolderOpen} title="Нет снимков" description="Снимки появятся здесь" />
            )}
          </TabsContent>

          <TabsContent value="photos">
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map(file => <FileCard key={file.id} file={file} />)}
              </div>
            ) : (
              <EmptyState icon={ImageIcon} title="Нет фото" description="Фотографии появятся здесь" />
            )}
          </TabsContent>

          <TabsContent value="documents">
            {documents.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documents.map(file => <FileCard key={file.id} file={file} />)}
              </div>
            ) : (
              <EmptyState icon={FileText} title="Нет документов" description="Документы появятся здесь" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
};

export default PatientFiles;
