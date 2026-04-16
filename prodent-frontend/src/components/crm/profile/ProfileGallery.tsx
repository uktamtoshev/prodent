import { DoctorPortfolio } from '@/components/doctor/profile/DoctorPortfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Images } from 'lucide-react';

interface ProfileGalleryProps {
  doctorId: string;
}

export function ProfileGallery({ doctorId }: ProfileGalleryProps) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Images className="w-5 h-5 text-primary" />
          Галерея работ
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DoctorPortfolio doctorId={doctorId} isOwner={true} />
      </CardContent>
    </Card>
  );
}
