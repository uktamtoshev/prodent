import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/contexts/ClinicContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PatientTagsProps {
  patientId: string;
  tags?: { id: string; tag: string }[];
  compact?: boolean;
}

const AVAILABLE_TAGS = ["VIP", "Дети", "Аллергия", "Долг", "Постоянный", "Новый"];

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  Дети: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Аллергия: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  Долг: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  Постоянный: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  Новый: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

export function PatientTags({ patientId, tags, compact }: PatientTagsProps) {
  const queryClient = useQueryClient();
  const { currentClinic } = useClinic();

  const getTagColor = (tag: string) => {
    return TAG_COLORS[tag] || "bg-muted text-muted-foreground border-border";
  };

  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap">
        {tags?.slice(0, 2).map((tagObj) => (
          <Badge
            key={tagObj.id}
            variant="outline"
            className={`text-xs ${getTagColor(tagObj.tag)}`}
          >
            {tagObj.tag}
          </Badge>
        ))}
        {tags && tags.length > 2 && (
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
            +{tags.length - 2}
          </Badge>
        )}
      </div>
    );
  }

  const handleAddTag = async (tag: string) => {
    const { error } = await supabase.from("patient_tags").insert({
      patient_id: patientId,
      tag,
      clinic_id: currentClinic?.id,
    });

    if (error) {
      toast.error("Не удалось добавить тег");
    } else {
      toast.success(`Тег "${tag}" добавлен`);
      queryClient.invalidateQueries({ queryKey: ["patient-detail", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase.from("patient_tags").delete().eq("id", tagId);

    if (error) {
      toast.error("Не удалось удалить тег");
    } else {
      toast.success("Тег удален");
      queryClient.invalidateQueries({ queryKey: ["patient-detail", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    }
  };

  const currentTags = tags?.map(t => t.tag) || [];
  const availableTags = AVAILABLE_TAGS.filter(t => !currentTags.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags?.map((tagObj) => (
        <Badge
          key={tagObj.id}
          variant="outline"
          className={`${getTagColor(tagObj.tag)} group pr-1`}
        >
          {tagObj.tag}
          <button
            onClick={() => handleRemoveTag(tagObj.id)}
            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      {availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Plus className="w-3 h-3 mr-1" />
              Тег
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover border-border">
            {availableTags.map((tag) => (
              <DropdownMenuItem
                key={tag}
                onClick={() => handleAddTag(tag)}
                className="text-popover-foreground hover:bg-muted"
              >
                {tag}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
