import { DoctorLayout } from '@/components/doctor/DoctorLayout';

export default function DoctorLaboratory() {
  return (
    <DoctorLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Лаборатория</h1>
        <p className="text-muted-foreground">Лабораторные работы и заказы</p>
      </div>
    </DoctorLayout>
  );
}
