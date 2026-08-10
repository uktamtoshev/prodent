import { ReactNode } from 'react';
import { CRMLayout } from '@/components/crm/CRMLayout';

interface DoctorLayoutProps {
  children: ReactNode;
}

// Single unified layout for the entire app — `DoctorLayout` is now a thin
// wrapper around `CRMLayout`. Earlier the doctor cabinet shipped its own
// `DoctorSidebar`, which conflicted visually with `CRMSidebarNew` when the
// same pages were reached via the CRM menu. Now there is one menu only:
// `CRMSidebarNew` (rendered by CRMLayout). Permission checks (doctor,
// clinic-admin, etc.) live in `CRMLayout`.
export const DoctorLayout = ({ children }: DoctorLayoutProps) => (
  <CRMLayout>{children}</CRMLayout>
);
