import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableSectionProps {
  children: ReactNode;
  isOwner: boolean;
  onEdit: () => void;
  className?: string;
  editLabel?: string;
}

export function EditableSection({
  children,
  isOwner,
  onEdit,
  className,
  editLabel = 'Редактировать',
}: EditableSectionProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!isOwner) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn('relative group', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <Button
        variant="secondary"
        size="sm"
        className={cn(
          'absolute top-2 right-2 gap-1.5 transition-opacity z-10',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="w-3.5 h-3.5" />
        {editLabel}
      </Button>
    </div>
  );
}
