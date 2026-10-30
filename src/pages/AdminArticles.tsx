import { useState, useEffect, useRef } from "react";
import {
  Pencil, Trash2, Loader2, X, ImagePlus, Save, Wand2, FileText, Tags,
  RotateCcw, Sparkles, Search as SearchIcon, ListOrdered, Globe, Image as ImageIcon,
  ExternalLink, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { decodeHtmlEntities } from "@/lib/htmlUtils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const allCategories = ["سياسة", "اقتصاد", "تكنولوجيا", "رياضة", "ثقافة", "صحة", "علوم", "منوعات", "المقالات", "فنون", "لقاءات", "تصريحات", "تمون"];
const enCategories = ["Politics", "Economy", "Technology", "Sports", "Culture", "Health", "Science", "Entertainment", "Articles", "Arts", "Interviews", "Statements", "Supplies"];

interface Article {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  category: string | null;
  language: string;
  published_at: string | null;
  is_published: boolean;
  url: string;
  image_url: string | null;
  author: string | null;
  hashtags: string[] | null;
}

const streamAI = async (body: any, onDelta: (text: string) => void) => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "خطأ في الاتصال");
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return;
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {}
    }
  }
};

const fetchJSON = async (body: any) => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "خطأ في الاتصال");
  }
  return resp.json();
};

const AdminArticles = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Article>>({});
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [seoResult, setSeoResult] = useState("");
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [detailsResult, setDetailsResult] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("articles")
      .select("id, title, description, content, category, language, published_at, is_published, url, image_url, author, hashtags")
      .order("published_at", { ascending: false })
      .limit(100);
    setArticles((data as Article[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await supabase.from("articles").delete().eq("id", id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "تم الحذف ✓" });
  };

  const startEditing = (article: Article) => {
    setEditingId(article.id);
    setEditData({
      title: decodeHtmlEntities(article.title),
      description: decodeHtmlEntities(article.description),
      content: decodeHtmlEntities(article.content),
      category: article.category,
      language: article.language,
      author: article.author,
      image_url: article.image_url,
      url: article.url,
      hashtags: article.hashtags || [],
    });
    setNewImages([]);
    setNewImagePreviews([]);
    setSeoResult("");
    setFetchedImages([]);
    setShowImagePicker(false);
    setDetailsResult("");
    setShowDetails(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setNewImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("article-images").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("article-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const updates = { ...editData };
      delete (updates as any).url;
      if (newImages.length > 0) {
        const url = await uploadImage(newImages[0]);
        if (url) updates.image_url = url;
      }
      await supabase.from("articles").update(updates).eq("id", id);
      toast({ title: "تم التحديث ✓" });
      setEditingId(null);
      load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // AI streaming helper
  const runAI = async (action: string, field: "title" | "content" | "description", extraBody: any = {}) => {
    setAiLoading(action);
    try {
      let text = "";
      await streamAI(
        { action, ...extraBody },
        (delta) => { text += delta; setEditData((d) => ({ ...d, [field]: text })); }
      );
    } catch (e: any) {
      toast({ title: "خطأ AI", description: e.message, variant: "destructive" });
    } finally { setAiLoading(null); }
  };

  // SEO generator - shows in separate box
  const runSEO = async () => {
    setAiLoading("generate_seo");
    setSeoResult("");
    try {
      let text = "";
      await streamAI(
        { action: "generate_seo", content: editData.content, title: editData.title },
        (delta) => { text += delta; setSeoResult(text); }
      );
      // Parse hashtags from result
      const tags = text.split("\n").map(t => t.trim()).filter(t => t.startsWith("#"));
      if (tags.length > 0) {
        setEditData((d) => ({ ...d, hashtags: tags }));
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setAiLoading(null); }
  };

  // Fetch original content from URL
  const fetchOriginalContent = async () => {
    if (!editData.url) {
      toast({ title: "لا يوجد رابط مصدر", variant: "destructive" });
      return;
    }
    setAiLoading("fetch_original_content");
    try {
      let text = "";
      await streamAI(
        { action: "fetch_original_content", url: editData.url },
        (delta) => { text += delta; setEditData((d) => ({ ...d, content: text })); }
      );
    } catch (e: any) {
      toast({ title: "خطأ في جلب المحتوى", description: e.message, variant: "destructive" });
    } finally { setAiLoading(null); }
  };

  // Fetch original image from source
  const fetchOriginalImage = async () => {
    if (!editData.url) {
      toast({ title: "لا يوجد رابط مصدر", variant: "destructive" });
      return;
    }
    setAiLoading("fetch_original_image");
    setShowImagePicker(false);
    try {
      const data = await fetchJSON({ action: "fetch_original_image", url: editData.url });
      if (data.images?.length > 0) {
        setFetchedImages(data.images);
        setShowImagePicker(true);
      } else {
        toast({ title: "لم يتم العثور على صور" });
      }
    } catch (e: any) {
      toast({ title: "خطأ في جلب الصور", description: e.message, variant: "destructive" });
    } finally { setAiLoading(null); }
  };

  // Fetch related details
  const fetchDetails = async () => {
    setAiLoading("fetch_details");
    setDetailsResult("");
    setShowDetails(true);
    try {
      let text = "";
      await streamAI(
        { action: "fetch_details", title: editData.title, content: editData.content, url: editData.url },
        (delta) => { text += delta; setDetailsResult(text); }
      );
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setAiLoading(null); }
  };

  // Open Google Images search
  const searchImages = () => {
    const query = encodeURIComponent(editData.title || "news");
    window.open(`https://www.google.com/search?q=${query}&tbm=isch`, "_blank");
  };

  const categories = editData.language === "en" ? enCategories : allCategories;

  const filtered = articles.filter((a) =>
    !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const AiBtn = ({ action, label, icon: Icon, onClick, loading: isLoading }: {
    action: string; label: string; icon: any; onClick: () => void; loading?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={!!aiLoading}
      className="text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all hover:bg-[hsl(var(--admin-surface-hover))] border border-transparent hover:border-[hsl(var(--admin-border))]"
      style={{ color: "hsl(var(--sidebar-ring))" }}
      title={label}
    >
      {(isLoading ?? aiLoading === action) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "hsl(var(--admin-text))" }}>إدارة المقالات</h1>
        <div className="relative w-64">
          <SearchIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--admin-text-muted))" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في المقالات..."
            className="admin-input text-sm pr-9 py-2"
          />
        </div>
      </div>

      {/* Full Edit Panel */}
      {editingId && (
        <div className="admin-surface p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "hsl(var(--admin-text))" }}>تحرير المقال</h2>
            <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-[hsl(var(--admin-surface-hover))]"><X className="w-5 h-5" style={{ color: "hsl(var(--admin-text-muted))" }} /></button>
          </div>

          {/* Title + AI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>العنوان *</label>
              <AiBtn action="improve_headline" label="تحسين العنوان" icon={Wand2}
                onClick={() => runAI("improve_headline", "title", { content: editData.title })} />
            </div>
            <input type="text" value={editData.title ?? ""} onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))} className="admin-input" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>وصف مختصر</label>
            <textarea value={editData.description ?? ""} onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))} className="admin-input min-h-[80px] resize-y" />
          </div>

          {/* Content + AI toolbar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>المحتوى</label>
            </div>
            <div className="flex items-center gap-1 flex-wrap mb-2 p-2 rounded-lg" style={{ background: "hsl(var(--admin-surface-hover))" }}>
              <AiBtn action="rewrite_content" label="إعادة صياغة" icon={RotateCcw}
                onClick={() => runAI("rewrite_content", "content", { content: editData.content, title: editData.title })} />
              <AiBtn action="enhance_style" label="تحسين المحتوى" icon={Sparkles}
                onClick={() => runAI("enhance_style", "content", { content: editData.content, title: editData.title })} />
              <AiBtn action="professional_rewrite" label="كتابة احترافية" icon={FileText}
                onClick={() => runAI("professional_rewrite", "content", { content: editData.content, title: editData.title })} />
              <AiBtn action="summarize" label="تلخيص" icon={Tags}
                onClick={() => runAI("summarize", "content", { content: editData.content })} />
              <AiBtn action="summarize_bullets" label="تلخيص نقاط" icon={ListOrdered}
                onClick={() => runAI("summarize_bullets", "content", { content: editData.content })} />
            </div>
            <textarea value={editData.content ?? ""} onChange={(e) => setEditData((d) => ({ ...d, content: e.target.value }))} className="admin-input min-h-[200px] resize-y" />
          </div>

          {/* Source URL (read-only display) */}
          {editData.url && !editData.url.startsWith("manual-") && (
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>رابط المصدر</label>
              <div className="flex items-center gap-2">
                <input type="text" value={editData.url} readOnly className="admin-input flex-1 text-xs opacity-70" />
                <a href={editData.url} target="_blank" rel="noopener" className="p-2 rounded hover:bg-[hsl(var(--admin-surface-hover))]">
                  <ExternalLink className="w-4 h-4" style={{ color: "hsl(var(--admin-text-muted))" }} />
                </a>
              </div>
            </div>
          )}

          {/* Advanced AI Tools */}
          <div className="p-3 rounded-lg space-y-3" style={{ background: "hsl(var(--admin-bg))", border: "1px solid hsl(var(--admin-border))" }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "hsl(var(--admin-text))" }}>
              <Sparkles className="w-4 h-4 text-urgent" /> أدوات متقدمة
            </h3>
            <div className="flex flex-wrap gap-2">
              <AiBtn action="generate_seo" label="استخراج SEO" icon={Tags} onClick={runSEO} />
              <AiBtn action="fetch_original_content" label="جلب الخبر الأصلي" icon={Globe} onClick={fetchOriginalContent} />
              <AiBtn action="fetch_original_image" label="جلب الصورة الأصلية" icon={ImageIcon} onClick={fetchOriginalImage} />
              <AiBtn action="search_images" label="بحث عن صورة" icon={SearchIcon} onClick={searchImages} />
              <AiBtn action="fetch_details" label="جلب تفاصيل" icon={Info} onClick={fetchDetails} />
            </div>
          </div>

          {/* Hashtags Editor */}
          {(editData.hashtags && editData.hashtags.length > 0) && (
            <div className="p-4 rounded-lg" style={{ background: "hsl(var(--admin-bg))", border: "1px solid hsl(var(--admin-border))" }}>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "hsl(var(--sidebar-ring))" }}>
                <Tags className="w-4 h-4" /> الهاشتاقات
              </h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {editData.hashtags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: "hsl(var(--urgent-red) / 0.15)", color: "hsl(var(--urgent-red))" }}>
                    {tag}
                    <button onClick={() => setEditData((d) => ({ ...d, hashtags: (d.hashtags || []).filter((_, j) => j !== i) }))} className="hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="أضف هاشتاق جديد..."
                  className="admin-input flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      let val = (e.target as HTMLInputElement).value.trim();
                      if (!val) return;
                      if (!val.startsWith("#")) val = "#" + val;
                      setEditData((d) => ({ ...d, hashtags: [...(d.hashtags || []), val] }));
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Fetched Images Picker */}
          {showImagePicker && fetchedImages.length > 0 && (
            <div className="p-4 rounded-lg" style={{ background: "hsl(var(--admin-bg))", border: "1px solid hsl(var(--admin-border))" }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: "hsl(var(--admin-text))" }}>
                <ImageIcon className="w-4 h-4 inline ml-1" /> اختر صورة من المصدر
              </h4>
              <div className="flex flex-wrap gap-3">
                {fetchedImages.map((img, i) => (
                  <button key={i} onClick={() => { setEditData((d) => ({ ...d, image_url: img })); setShowImagePicker(false); toast({ title: "تم اختيار الصورة ✓" }); }}
                    className="relative w-28 h-20 rounded-lg overflow-hidden border-2 transition-all hover:border-urgent"
                    style={{ borderColor: editData.image_url === img ? "hsl(var(--urgent-red))" : "hsl(var(--admin-border))" }}>
                    <img src={img} alt="" className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = "/assets/hero-news.jpg"; e.currentTarget.onerror = null; }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fetched Details Box */}
          {showDetails && detailsResult && (
            <div className="p-4 rounded-lg whitespace-pre-wrap text-sm leading-relaxed" style={{ background: "hsl(var(--admin-bg))", border: "1px solid hsl(var(--admin-border))", color: "hsl(var(--admin-text))" }}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: "hsl(var(--sidebar-ring))" }}>
                  <Info className="w-4 h-4" /> تفاصيل إضافية
                </h4>
                <button onClick={() => setShowDetails(false)} className="p-1 rounded hover:bg-[hsl(var(--admin-surface-hover))]"><X className="w-4 h-4" style={{ color: "hsl(var(--admin-text-muted))" }} /></button>
              </div>
              {detailsResult}
            </div>
          )}

          {/* Author */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>اسم الكاتب</label>
            <input type="text" value={editData.author ?? ""} onChange={(e) => setEditData((d) => ({ ...d, author: e.target.value }))} className="admin-input" />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>صورة المقال</label>
            <div className="flex flex-wrap gap-3 items-start">
              {editData.image_url && newImages.length === 0 && (
                <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border">
                  <img src={editData.image_url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setEditData((d) => ({ ...d, image_url: null }))} className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white"><X className="w-3 h-3" /></button>
                </div>
              )}
              {newImagePreviews.map((src, i) => (
                <div key={i} className="relative w-32 h-24 rounded-lg overflow-hidden border border-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => { setNewImages((p) => p.filter((_, j) => j !== i)); setNewImagePreviews((p) => p.filter((_, j) => j !== i)); }} className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} className="w-32 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1" style={{ borderColor: "hsl(var(--admin-border))", color: "hsl(var(--admin-text-muted))" }}>
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px]">إضافة صورة</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpg,image/jpeg,image/png,image/webp,image/gif" onChange={handleImageSelect} className="hidden" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>التصنيف</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setEditData((d) => ({ ...d, category: cat }))} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${editData.category === cat ? "text-white" : ""}`} style={editData.category === cat ? { background: "hsl(var(--urgent-red))" } : { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>القسم</label>
            <div className="flex gap-2">
              <button onClick={() => setEditData((d) => ({ ...d, language: "ar" }))} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${editData.language === "ar" ? "btn-admin-primary" : ""}`} style={editData.language !== "ar" ? { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" } : undefined}>عربي</button>
              <button onClick={() => setEditData((d) => ({ ...d, language: "en" }))} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${editData.language === "en" ? "btn-admin-primary" : ""}`} style={editData.language !== "en" ? { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" } : undefined}>English</button>
            </div>
          </div>

          <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid hsl(var(--admin-border))" }}>
            <button onClick={() => handleSave(editingId)} disabled={saving} className="btn-admin-primary flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ التعديلات
            </button>
            <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded text-sm" style={{ color: "hsl(var(--admin-text-muted))" }}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="admin-surface overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(var(--admin-text-muted))" }} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "hsl(var(--admin-text-muted))" }}>لا توجد مقالات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--admin-border))" }}>
                  {["العنوان", "القسم", "اللغة", "الحالة", "إجراءات"].map((h) => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-semibold" style={{ color: "hsl(var(--admin-text-muted))" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((article) => (
                  <tr key={article.id} style={{ borderBottom: "1px solid hsl(var(--admin-border))" }} className={`hover:bg-[hsl(var(--admin-surface-hover))] ${editingId === article.id ? "bg-[hsl(var(--admin-surface-hover))]" : ""}`}>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="truncate font-medium" style={{ color: "hsl(var(--admin-text))" }}>{decodeHtmlEntities(article.title)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded bg-urgent/10 text-urgent">{article.category || "عام"}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "hsl(var(--admin-text-muted))" }}>{article.language === "ar" ? "عربي" : "English"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${article.is_published ? "text-green-400 bg-green-400/10" : "text-amber-400 bg-amber-400/10"}`}>
                        {article.is_published ? "منشور" : "مسودة"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditing(article)} className="p-1.5 rounded hover:bg-[hsl(var(--admin-surface-hover))]" style={{ color: "hsl(var(--admin-text-muted))" }}><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(article.id)} className="p-1.5 rounded hover:bg-urgent/10 text-urgent"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminArticles;
