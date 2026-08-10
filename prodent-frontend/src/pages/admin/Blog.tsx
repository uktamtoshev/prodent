import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArticleDialog } from "@/components/admin/ArticleDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

interface BlogArticle {
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
  created_at?: string | null;
}

export default function Blog() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { t, language } = useLanguage();
  const dateLocale =
    ({ ru: "ru-RU", uz: "uz-UZ", uz_cyrl: "uz-UZ", kz: "kk-KZ", kg: "ky-KG", tj: "tg-TJ" } as Record<string, string>)[
      language
    ] || "ru-RU";

  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast.success(t("adminBlog.deleted"));
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(t("adminArticleDialog.errorPrefix") + error.message);
    },
  });

  const handleEdit = (article: BlogArticle) => {
    setEditingArticle(article);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingArticle(null);
    setDialogOpen(true);
  };

  const filteredPosts = posts?.filter(
    (post) =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const subtitle = t("adminBlog.subtitleCount").replace(
    "{count}",
    String(posts?.length || 0)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("adminBlog.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {subtitle}
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="gap-2 bg-[#00C6BB] hover:bg-[#00C6BB]/90"
          >
            <Plus className="h-4 w-4" />
            {t("adminBlog.createBtn")}
          </Button>
        </div>

        <div className="flex gap-4">
          <Input
            placeholder={t("adminBlog.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t("adminBlog.colTitle")}</TableHead>
                <TableHead className="text-muted-foreground">{t("adminBlog.colSlug")}</TableHead>
                <TableHead className="text-muted-foreground">{t("adminBlog.colStatus")}</TableHead>
                <TableHead className="text-muted-foreground">{t("adminBlog.colDate")}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t("adminBlog.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("admin.loading")}
                  </TableCell>
                </TableRow>
              ) : filteredPosts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("adminBlog.notFound")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts?.map((post) => (
                  <TableRow
                    key={post.id}
                    className="border-border hover:bg-accent/50"
                  >
                    <TableCell className="text-foreground font-medium max-w-[300px] truncate">
                      {post.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm max-w-[200px] truncate">
                      {post.slug}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={post.is_published ? "default" : "secondary"}
                        className={
                          post.is_published
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : ""
                        }
                      >
                        {post.is_published ? t("adminBlog.statusPublished") : t("adminBlog.statusDraft")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString(dateLocale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/articles/${post.slug}`} target="_blank">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(post)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          onClick={() => setDeleteId(post.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editingArticle}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminBlog.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminBlog.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-500 hover:bg-red-600"
            >
              {t("admin.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
