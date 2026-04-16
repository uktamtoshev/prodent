import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string | null;
    cover_image: string | null;
    published: boolean | null;
    meta_title: string | null;
    meta_description: string | null;
    meta_keywords: string[] | null;
  } | null;
}

export function ArticleDialog({ open, onOpenChange, article }: ArticleDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!article;

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_image: "",
    published: false,
    meta_title: "",
    meta_description: "",
    meta_keywords: "",
  });

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title || "",
        slug: article.slug || "",
        excerpt: article.excerpt || "",
        content: article.content || "",
        cover_image: article.cover_image || "",
        published: article.published || false,
        meta_title: article.meta_title || "",
        meta_description: article.meta_description || "",
        meta_keywords: article.meta_keywords?.join(", ") || "",
      });
    } else {
      setFormData({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        cover_image: "",
        published: false,
        meta_title: "",
        meta_description: "",
        meta_keywords: "",
      });
    }
  }, [article, open]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map: Record<string, string> = {
          а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
          ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
          н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
          ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
          ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const keywords = data.meta_keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const { error } = await supabase.from("blog_posts").insert({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content || null,
        cover_image: data.cover_image || null,
        published: data.published,
        published_at: data.published ? new Date().toISOString() : null,
        meta_title: data.meta_title || null,
        meta_description: data.meta_description || null,
        meta_keywords: keywords.length > 0 ? keywords : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast.success("Статья создана");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Ошибка: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const keywords = data.meta_keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from("blog_posts")
        .update({
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt || null,
          content: data.content || null,
          cover_image: data.cover_image || null,
          published: data.published,
          published_at: data.published ? new Date().toISOString() : null,
          meta_title: data.meta_title || null,
          meta_description: data.meta_description || null,
          meta_keywords: keywords.length > 0 ? keywords : null,
        })
        .eq("id", article!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast.success("Статья обновлена");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Ошибка: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      toast.error("Заполните заголовок и slug");
      return;
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать статью" : "Создать статью"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Заголовок *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Название статьи"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="url-statyi"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Краткое описание</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, excerpt: e.target.value }))
              }
              placeholder="Краткое описание для превью"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Содержание (HTML)</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="<h2>Заголовок</h2><p>Текст статьи...</p>"
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover_image">URL обложки</Label>
            <Input
              id="cover_image"
              value={formData.cover_image}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, cover_image: e.target.value }))
              }
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-4">SEO настройки</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meta_title: e.target.value }))
                  }
                  placeholder="SEO заголовок"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_keywords">Ключевые слова</Label>
                <Input
                  id="meta_keywords"
                  value={formData.meta_keywords}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meta_keywords: e.target.value }))
                  }
                  placeholder="ключ1, ключ2, ключ3"
                />
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label htmlFor="meta_description">Meta Description</Label>
              <Textarea
                id="meta_description"
                value={formData.meta_description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, meta_description: e.target.value }))
                }
                placeholder="Описание для поисковых систем (до 160 символов)"
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-3">
              <Switch
                id="published"
                checked={formData.published}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, published: checked }))
                }
              />
              <Label htmlFor="published">Опубликовать</Label>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
