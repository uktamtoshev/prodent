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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string | null;
    cover_url: string | null;
    is_published: boolean | null;
    seo_title: string | null;
    seo_description: string | null;
    tags: string[] | null;
    language?: string | null;
  } | null;
}

export function ArticleDialog({ open, onOpenChange, article }: ArticleDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const isEditing = !!article;

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_url: "",
    is_published: false,
    seo_title: "",
    seo_description: "",
    tags: "",
    language: "ru",
  });

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title || "",
        slug: article.slug || "",
        excerpt: article.excerpt || "",
        content: article.content || "",
        cover_url: article.cover_url || "",
        is_published: article.is_published || false,
        seo_title: article.seo_title || "",
        seo_description: article.seo_description || "",
        tags: article.tags?.join(", ") || "",
        language: article.language || "ru",
      });
    } else {
      setFormData({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        cover_url: "",
        is_published: false,
        seo_title: "",
        seo_description: "",
        tags: "",
        language: "ru",
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
      const tags = data.tags
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const { error } = await supabase.from("blog_posts").insert({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content || null,
        cover_url: data.cover_url || null,
        is_published: data.is_published,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        tags: tags.length > 0 ? tags : null,
        language: data.language,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast.success(t("adminArticleDialog.created"));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t("adminArticleDialog.errorPrefix") + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const tags = data.tags
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
          cover_url: data.cover_url || null,
          is_published: data.is_published,
          seo_title: data.seo_title || null,
          seo_description: data.seo_description || null,
          tags: tags.length > 0 ? tags : null,
          language: data.language,
        })
        .eq("id", article!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast.success(t("adminArticleDialog.updated"));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t("adminArticleDialog.errorPrefix") + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      toast.error(t("adminArticleDialog.fillRequired"));
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
            {isEditing ? t("adminArticleDialog.titleEdit") : t("adminArticleDialog.titleCreate")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("adminArticleDialog.labelTitle")} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("adminArticleDialog.placeholderTitle")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t("adminArticleDialog.labelSlug")} *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder={t("adminArticleDialog.placeholderSlug")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">{t("adminArticleDialog.labelExcerpt")}</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, excerpt: e.target.value }))
              }
              placeholder={t("adminArticleDialog.placeholderExcerpt")}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">{t("adminArticleDialog.labelContent")}</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder={t("adminArticleDialog.placeholderContent")}
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover_image">{t("adminArticleDialog.labelCover")}</Label>
            <Input
              id="cover_image"
              value={formData.cover_url}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, cover_url: e.target.value }))
              }
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="space-y-2 max-w-xs">
            <Label htmlFor="language">{t("adminArticleDialog.labelLanguage")}</Label>
            <Select
              value={formData.language}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, language: value }))
              }
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="uz">O‘zbekcha</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-4">{t("adminArticleDialog.seoTitle")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">{t("adminArticleDialog.labelMetaTitle")}</Label>
                <Input
                  id="meta_title"
                  value={formData.seo_title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, seo_title: e.target.value }))
                  }
                  placeholder={t("adminArticleDialog.placeholderMetaTitle")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_keywords">{t("adminArticleDialog.labelKeywords")}</Label>
                <Input
                  id="meta_keywords"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tags: e.target.value }))
                  }
                  placeholder={t("adminArticleDialog.placeholderKeywords")}
                />
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label htmlFor="meta_description">{t("adminArticleDialog.labelMetaDesc")}</Label>
              <Textarea
                id="meta_description"
                value={formData.seo_description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, seo_description: e.target.value }))
                }
                placeholder={t("adminArticleDialog.placeholderMetaDesc")}
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-3">
              <Switch
                id="published"
                checked={formData.is_published}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_published: checked }))
                }
              />
              <Label htmlFor="published">{t("adminArticleDialog.labelPublish")}</Label>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("admin.cancel")}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? t("adminArticleDialog.btnSave") : t("adminArticleDialog.btnCreate")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
