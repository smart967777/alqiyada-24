import { useState, useEffect, useRef } from "react";
import { Search, Globe, Rss, Code, Zap, CheckCircle, AlertCircle, Loader2, Plus, Pencil, Trash2, RefreshCw, Timer, EyeOff, Eye, Link as LinkIcon, Upload, FileUp, X, CheckSquare, Square, AlertTriangle, Languages, Clock } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, writeBatch, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface DetectionResult {
  method: string;
  methodKey: string;
  icon: typeof Rss;
  status: "success" | "warning" | "error";
  description: string;
  fetchUrl: string;
}

interface Source {
  id: string;
  name: string;
  url: string;
  fetch_method: string;
  fetch_url: string;
  language: string;
  fetch_interval_minutes: number;
  is_active: boolean;
  articles_count: number;
  last_fetched_at: string | null;
  hide_original_source?: boolean;
  alt_source_name?: string;
  alt_source_url?: string;
  assigned_category?: string;
}

// Enhanced OPML feed with validation status
interface OpmlFeed {
  name: string;
  xmlUrl: string;
  htmlUrl: string;
  selected: boolean;
  // Validation
  status: "pending" | "checking" | "valid" | "duplicate" | "error";
  statusMessage: string;
  isDuplicateOf?: string; // existing source name
  detectedLanguage?: "ar" | "en";
}

const allCategories = ["سياسة", "اقتصاد", "تكنولوجيا", "رياضة", "ثقافة", "صحة", "علوم", "منوعات", "المقالات", "فنون", "لقاءات", "تصريحات", "تمون"];

const AdminSources = () => {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<DetectionResult[] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<"ar" | "en">("ar");
  const [fetchInterval, setFetchInterval] = useState(5);
  const [autoFetchEnabled, setAutoFetchEnabled] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Source>>({});
  const [fetching, setFetching] = useState<string | null>(null);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  // New source fields
  const [hideSource, setHideSource] = useState(false);
  const [altSourceName, setAltSourceName] = useState("");
  const [altSourceUrl, setAltSourceUrl] = useState("");
  const [assignedCategory, setAssignedCategory] = useState("");
  const [showAltSource, setShowAltSource] = useState(false);
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Source | null>(null);
  // Duplicate detection
  const [duplicateGroups, setDuplicateGroups] = useState<{ url: string; sources: Source[] }[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  // OPML import
  const [opmlFeeds, setOpmlFeeds] = useState<OpmlFeed[]>([]);
  const [opmlImporting, setOpmlImporting] = useState(false);
  const [opmlValidating, setOpmlValidating] = useState(false);
  const [showOpmlPreview, setShowOpmlPreview] = useState(false);
  const opmlInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { loadSources(); }, []);

  useEffect(() => {
    const activeSources = sources.filter((s) => s.is_active);
    if (activeSources.length === 0) return;
    const intervals = activeSources.map((source) => {
      return setInterval(() => { handleManualFetch(source.id); }, source.fetch_interval_minutes * 60 * 1000);
    });
    return () => intervals.forEach(clearInterval);
  }, [sources]);

  const loadSources = async () => {
    try {
      const snapshot = await getDocs(collection(firestore, "news_sources"));
      const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Source[];
      setSources(list);
      findDuplicates(list);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const findDuplicates = (sourceList: Source[]) => {
    const urlMap = new Map<string, Source[]>();
    sourceList.forEach((s) => {
      const key = s.fetch_url.toLowerCase().trim();
      if (!urlMap.has(key)) urlMap.set(key, []);
      urlMap.get(key)!.push(s);
    });
    const dupes = Array.from(urlMap.entries())
      .filter(([, group]) => group.length > 1)
      .map(([url, group]) => ({ url, sources: group }));
    setDuplicateGroups(dupes);
  };

  const handleAnalyze = async () => {
    if (!url) return;
    setAnalyzing(true); setResults(null); setSelectedMethod(null);
    try {
      const isRssUrl = url.includes("/rss") || url.includes("/feed") || url.includes(".xml") || url.includes("atom");
      const detections: DetectionResult[] = [
        { method: "RSS Feed", methodKey: "rss", icon: Rss, status: isRssUrl ? "success" : "warning", description: isRssUrl ? "تم العثور على RSS صالح - الأفضل" : "قد يحتوي على RSS", fetchUrl: isRssUrl ? url : `${url.replace(/\/$/, "")}/feed` },
        { method: "HTML Scraping", methodKey: "html", icon: Code, status: !isRssUrl ? "success" : "warning", description: !isRssUrl ? "بنية HTML قابلة للاستخراج" : "متاح كبديل", fetchUrl: url },
        { method: "JavaScript", methodKey: "js", icon: Globe, status: "warning", description: "محتوى ديناميكي", fetchUrl: url },
        { method: "API", methodKey: "api", icon: Zap, status: "error", description: "لم يتم العثور على API", fetchUrl: `${url.replace(/\/$/, "")}/api/news` },
      ];
      setResults(detections);
      const best = detections.find((d) => d.status === "success");
      if (best) setSelectedMethod(best.methodKey);
    } finally { setAnalyzing(false); }
  };

  const statusIcon = (status: string) => {
    if (status === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "warning") return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <AlertCircle className="w-4 h-4 text-urgent" />;
  };

  const selectedResult = results?.find((r) => r.methodKey === selectedMethod);

  const handleAddSource = async () => {
    if (!selectedResult || !sourceName) { toast({ title: "أدخل اسم المصدر", variant: "destructive" }); return; }
    try {
      const source = { name: sourceName, url, fetch_method: selectedResult.methodKey, fetch_url: selectedResult.fetchUrl,
        fetch_interval_minutes: autoFetchEnabled ? fetchInterval : 0, language: sourceLanguage, is_active: autoFetchEnabled,
        hide_original_source: hideSource, alt_source_name: altSourceName || null, alt_source_url: altSourceUrl || null,
        assigned_category: assignedCategory || null, articles_count: 0, last_fetched_at: null, created_at: new Date().toISOString() };
      const created = await addDoc(collection(firestore, "news_sources"), source);
      const saved = { id: created.id, ...source } as Source;
      toast({ title: "تمت إضافة المصدر بنجاح ✓" }); setSources((prev) => [saved, ...prev]);
      setUrl(""); setResults(null); setSelectedMethod(null); setSourceName("");
      setHideSource(false); setAltSourceName(""); setAltSourceUrl(""); setAssignedCategory(""); setShowAltSource(false);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateSource = async (id: string) => {
    try {
      await updateDoc(doc(firestore, "news_sources", id), editData);
      toast({ title: "تم التحديث ✓" }); setEditingId(null); loadSources();
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
  };

  const confirmDeleteSource = async (deleteArticles: boolean) => {
    if (!deleteTarget) return;
    try {
      if (deleteArticles) {
        // Delete all articles from this source first
        const articles = await getDocs(query(collection(firestore, "articles"), where("source_id", "==", deleteTarget.id)));
        const batch = writeBatch(firestore); articles.docs.forEach((item) => batch.delete(item.ref)); await batch.commit();
      }
      await deleteDoc(doc(firestore, "news_sources", deleteTarget.id));
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast({ title: deleteArticles ? "تم حذف المصدر وجميع أخباره ✓" : "تم حذف المصدر فقط ✓" });
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
    setDeleteTarget(null);
  };

  const handleManualFetch = async (sourceId?: string) => {
    setFetching(sourceId || "all"); setFetchResult(null);
    try {
      const ingestUrl = import.meta.env.VITE_NEWS_INGEST_URL;
      if (!ingestUrl) throw new Error("لم يتم إعداد خدمة جلب الأخبار بعد. أضف VITE_NEWS_INGEST_URL لخدمة Cloud Function.");
      const response = await fetch(ingestUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId }) });
      if (!response.ok) throw new Error("تعذر الاتصال بخدمة جلب الأخبار");
      const data = await response.json(); setFetchResult(`تم جلب ${data.fetched || 0} مقال من ${data.sources || 0} مصادر`);
      toast({ title: `تم جلب ${data.fetched || 0} مقال ✓` }); loadSources();
    } catch (e: any) { toast({ title: "خطأ في الجلب", description: e.message, variant: "destructive" }); } finally { setFetching(null); }
  };

  // Arabic detection heuristic
  const detectLanguage = (text: string): "ar" | "en" => {
    const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    return arabicChars > text.length * 0.15 ? "ar" : "en";
  };

  // OPML Parsing with enhanced validation
  const handleOpmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const xml = event.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");
        const parseError = doc.querySelector("parsererror");
        if (parseError) throw new Error("ملف OPML غير صالح");
        const outlines = doc.querySelectorAll("outline[xmlUrl]");
        if (outlines.length === 0) throw new Error("لم يتم العثور على مصادر في الملف");
        
        // Build initial feeds list (deduplicated within OPML)
        const feedsMap = new Map<string, OpmlFeed>();
        outlines.forEach((outline) => {
          const name = outline.getAttribute("title") || outline.getAttribute("text") || "بدون اسم";
          const xmlUrl = outline.getAttribute("xmlUrl") || "";
          const htmlUrl = outline.getAttribute("htmlUrl") || "";
          if (xmlUrl && !feedsMap.has(xmlUrl)) {
            feedsMap.set(xmlUrl, {
              name,
              xmlUrl,
              htmlUrl,
              selected: true,
              status: "pending",
              statusMessage: "في الانتظار...",
              detectedLanguage: detectLanguage(name + " " + htmlUrl),
            });
          }
        });

        const feeds = Array.from(feedsMap.values());
        setOpmlFeeds(feeds);
        setShowOpmlPreview(true);
        toast({ title: `تم العثور على ${feeds.length} مصدر في الملف ✓` });

        // Start validation in background
        validateFeeds(feeds);
      } catch (err: any) {
        toast({ title: "خطأ في قراءة الملف", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (opmlInputRef.current) opmlInputRef.current.value = "";
  };

  // Validate all feeds: check RSS accessibility + detect duplicates
  const validateFeeds = async (feeds: OpmlFeed[]) => {
    setOpmlValidating(true);
    const xmlUrls = feeds.map((f) => f.xmlUrl);

    // Check for duplicates against existing sources
    const existingRssUrls = new Set(sources.map((s) => s.fetch_url));
    const existingNames = new Map(sources.map((s) => [s.fetch_url, s.name]));

    // Check internal duplicates within OPML
    const internalDupes = new Map<string, number>();
    xmlUrls.forEach((url, i) => {
      if (internalDupes.has(url)) {
        internalDupes.set(url, internalDupes.get(url)! + 1);
      } else {
        internalDupes.set(url, 1);
      }
    });

    // Validate each feed (batch of 5 at a time to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < feeds.length; i += batchSize) {
      const batch = feeds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (feed, batchIdx) => {
          const idx = i + batchIdx;
          // Check duplicate
          if (existingRssUrls.has(feed.xmlUrl)) {
            const existingName = existingNames.get(feed.xmlUrl) || "مصدر موجود";
            setOpmlFeeds((prev) =>
              prev.map((f, fi) =>
                fi === idx
                  ? { ...f, status: "duplicate" as const, statusMessage: `مكرر: ${existingName}`, isDuplicateOf: existingName, selected: false }
                  : f
              )
            );
            return;
          }
          // Check internal duplicate
          if ((internalDupes.get(feed.xmlUrl) || 0) > 1 && xmlUrls.indexOf(feed.xmlUrl) !== idx) {
            setOpmlFeeds((prev) =>
              prev.map((f, fi) =>
                fi === idx
                  ? { ...f, status: "duplicate" as const, statusMessage: "مكرر داخل الملف", selected: false }
                  : f
              )
            );
            return;
          }
          // Test RSS accessibility
          try {
            setOpmlFeeds((prev) =>
              prev.map((f, fi) => (fi === idx ? { ...f, status: "checking" as const, statusMessage: "جاري الفحص..." } : f))
            );
            const response = await fetch(feed.xmlUrl, {
              method: "HEAD",
              mode: "no-cors",
              signal: AbortSignal.timeout(8000),
            });
            // no-cors returns opaque response, treat as valid
            setOpmlFeeds((prev) =>
              prev.map((f, fi) =>
                fi === idx
                  ? { ...f, status: "valid" as const, statusMessage: "متاح ✓" }
                  : f
              )
            );
          } catch (err: any) {
            // Try with proxy / direct
            try {
              const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.xmlUrl)}`;
              const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
              const text = await res.text();
              const looksLikeRss = text.includes("<rss") || text.includes("<feed") || text.includes("<channel") || text.includes("<item");
              if (looksLikeRss) {
                setOpmlFeeds((prev) =>
                  prev.map((f, fi) =>
                    fi === idx ? { ...f, status: "valid" as const, statusMessage: "متاح ✓" } : f
                  )
                );
              } else {
                setOpmlFeeds((prev) =>
                  prev.map((f, fi) =>
                    fi === idx
                      ? { ...f, status: "error" as const, statusMessage: "لا يبدو أنه RSS صالح" }
                      : f
                  )
                );
              }
            } catch {
              setOpmlFeeds((prev) =>
                prev.map((f, fi) =>
                  fi === idx
                    ? { ...f, status: "error" as const, statusMessage: `غير متاح: ${err.message || "timeout"}` }
                    : f
                )
              );
            }
          }
        })
      );
    }
    setOpmlValidating(false);
  };

  const handleBulkImport = async () => {
    const selectedFeeds = opmlFeeds.filter((f) => f.selected && f.status !== "duplicate");
    if (selectedFeeds.length === 0) { toast({ title: "اختر مصدراً واحداً على الأقل", variant: "destructive" }); return; }
    setOpmlImporting(true);
    try {
      const sourcesList = selectedFeeds.map((f) => ({
        name: f.name,
        url: f.htmlUrl || f.xmlUrl,
        fetch_url: f.xmlUrl,
        fetch_method: "rss",
        language: f.detectedLanguage || "ar",
        fetch_interval_minutes: 15,
      }));
      const batch = writeBatch(firestore);
      sourcesList.forEach((source) => batch.set(doc(collection(firestore, "news_sources")), { ...source, is_active: true, articles_count: 0, created_at: new Date().toISOString() }));
      await batch.commit();
      toast({ title: `تم استيراد ${sourcesList.length} مصدر ✓` });
      setShowOpmlPreview(false);
      setOpmlFeeds([]);
      loadSources();
      if (sourcesList.length > 0) { await loadSources(); }
    } catch (e: any) {
      toast({ title: "خطأ في الاستيراد", description: e.message, variant: "destructive" });
    } finally { setOpmlImporting(false); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "hsl(var(--admin-text))" }}>محلل المصادر الإخبارية</h1>
        <div className="flex items-center gap-2">
          <input ref={opmlInputRef} type="file" accept=".opml,.xml" onChange={handleOpmlFile} className="hidden" id="opml-upload" />
          <label htmlFor="opml-upload" className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors hover:opacity-80" style={{ background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text))" }}>
            <Upload className="w-4 h-4" /> استيراد OPML
          </label>
          <button onClick={() => handleManualFetch()} disabled={fetching === "all"} className="btn-admin-primary flex items-center gap-2 disabled:opacity-50">
            {fetching === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} جلب الأخبار الآن
          </button>
        </div>
      </div>

      {fetchResult && (
        <div className="admin-surface p-4" style={{ borderColor: "hsl(142 76% 36% / 0.3)" }}>
          <p className="text-sm text-green-400">{fetchResult}</p>
        </div>
      )}

      {/* URL Input */}
      <div className="admin-surface p-5">
        <label className="block text-sm mb-2" style={{ color: "hsl(var(--admin-text-muted))" }}>ألصق رابط المصدر الإخباري</label>
        <div className="flex gap-3">
          <input type="url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} className="admin-input flex-1" placeholder="https://example.com/news" />
          <button onClick={handleAnalyze} disabled={analyzing || !url} className="btn-admin-primary flex items-center gap-2 disabled:opacity-50">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} تحليل
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="admin-surface p-5 space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: "hsl(var(--admin-text))" }}>نتائج التحليل</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map((r) => {
              const isSelected = selectedMethod === r.methodKey;
              const isBest = r.status === "success";
              return (
                <button key={r.method} onClick={() => setSelectedMethod(r.methodKey)} className={`flex items-center gap-3 p-4 rounded-lg text-right transition-all ${isSelected ? "ring-2 ring-green-500" : ""}`} style={{ background: isBest ? "hsl(142 76% 36% / 0.1)" : "hsl(var(--admin-surface-hover))" }}>
                  <input type="radio" checked={isSelected} onChange={() => setSelectedMethod(r.methodKey)} className="w-4 h-4 accent-green-500" />
                  <r.icon className="w-5 h-5" style={{ color: isBest ? "#22c55e" : "hsl(var(--admin-text-muted))" }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: isBest ? "#22c55e" : "hsl(var(--admin-text))" }}>{r.method} {isBest && "★"}</p>
                    <p className="text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>{r.description}</p>
                  </div>
                  {statusIcon(r.status)}
                </button>
              );
            })}
          </div>

          {selectedResult && (
            <div className="space-y-3 pt-4" style={{ borderTop: "1px solid hsl(var(--admin-border))" }}>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>رابط الجلب</label>
                <input type="text" dir="ltr" readOnly value={selectedResult.fetchUrl} className="admin-input flex-1 font-latin text-sm" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>اسم المصدر</label>
                <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="admin-input" placeholder="مثال: رويترز عربي" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>القسم</label>
                <div className="flex gap-2">
                  <button onClick={() => setSourceLanguage("ar")} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${sourceLanguage === "ar" ? "btn-admin-primary" : ""}`} style={sourceLanguage !== "ar" ? { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" } : undefined}>عربي</button>
                  <button onClick={() => setSourceLanguage("en")} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${sourceLanguage === "en" ? "btn-admin-primary" : ""}`} style={sourceLanguage !== "en" ? { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" } : undefined}>Global</button>
                </div>
              </div>

              {/* Hide original source toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "hsl(var(--admin-surface-hover))" }}>
                <div className="flex items-center gap-2">
                  {hideSource ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" style={{ color: "hsl(var(--admin-text-muted))" }} />}
                  <span className="text-sm" style={{ color: "hsl(var(--admin-text))" }}>إخفاء المصدر الأصلي</span>
                </div>
                <Switch checked={hideSource} onCheckedChange={setHideSource} />
              </div>

              {/* Alternative source */}
              {!showAltSource ? (
                <button onClick={() => setShowAltSource(true)} className="text-sm flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[hsl(var(--admin-surface-hover))]" style={{ color: "hsl(var(--sidebar-ring))" }}>
                  <LinkIcon className="w-4 h-4" /> إضافة مصدر بديل (اختياري)
                </button>
              ) : (
                <div className="space-y-2 p-3 rounded-lg" style={{ background: "hsl(var(--admin-surface-hover))" }}>
                  <label className="text-xs font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>مصدر بديل</label>
                  <input type="text" value={altSourceName} onChange={(e) => setAltSourceName(e.target.value)} className="admin-input text-sm" placeholder="اسم المصدر البديل" />
                  <input type="url" dir="ltr" value={altSourceUrl} onChange={(e) => setAltSourceUrl(e.target.value)} className="admin-input text-sm" placeholder="رابط المصدر البديل" />
                </div>
              )}

              {/* Assigned category */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>تخصيص المصدر لقسم معين (اختياري)</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setAssignedCategory("")} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${!assignedCategory ? "text-white" : ""}`} style={!assignedCategory ? { background: "hsl(var(--urgent-red))" } : { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" }}>تلقائي</button>
                  {allCategories.map((cat) => (
                    <button key={cat} onClick={() => setAssignedCategory(cat)} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${assignedCategory === cat ? "text-white" : ""}`} style={assignedCategory === cat ? { background: "hsl(var(--urgent-red))" } : { background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text-muted))" }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto fetch toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={autoFetchEnabled} onChange={(e) => setAutoFetchEnabled(e.target.checked)} className="w-4 h-4 accent-green-500" />
                  <span className="text-sm" style={{ color: "hsl(var(--admin-text))" }}>تفعيل الجلب التلقائي</span>
                </label>
              </div>

              {autoFetchEnabled && (
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>
                    <Timer className="w-3.5 h-3.5 inline ml-1" /> فترة الجلب (1-10 دقائق)
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={10} value={fetchInterval} onChange={(e) => setFetchInterval(Number(e.target.value))} className="flex-1 accent-green-500" />
                    <span className="text-sm font-latin font-bold w-12 text-center" style={{ color: "hsl(var(--admin-text))" }}>{fetchInterval} د</span>
                  </div>
                </div>
              )}

              <button onClick={handleAddSource} className="btn-admin-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> نشر المصدر
              </button>
            </div>
          )}
        </div>
      )}

      {/* Duplicate detection banner */}
      {duplicateGroups.length > 0 && (
        <div className="admin-surface p-4" style={{ borderColor: "hsl(38 92% 50% / 0.3)", borderWidth: "1px" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold" style={{ color: "hsl(var(--admin-text))" }}>
                  تم اكتشاف {duplicateGroups.length} مجموعة مصادر مكررة
                </p>
                <p className="text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  {duplicateGroups.reduce((sum, g) => sum + g.sources.length, 0)} مصادر تشارك نفس رابط RSS
                </p>
              </div>
            </div>
            <button onClick={() => setShowDuplicates(!showDuplicates)} className="text-xs px-3 py-1.5 rounded transition-colors" style={{ background: "hsl(38 92% 50% / 0.1)", color: "#f59e0b" }}>
              {showDuplicates ? "إخفاء" : "عرض المكررات"}
            </button>
          </div>

          {showDuplicates && (
            <div className="mt-4 space-y-3">
              {duplicateGroups.map((group, gi) => (
                <div key={gi} className="p-3 rounded-lg" style={{ background: "hsl(var(--admin-surface-hover))" }}>
                  <p className="text-xs font-latin mb-2 truncate" dir="ltr" style={{ color: "hsl(var(--admin-text-muted))" }}>
                    {group.url}
                  </p>
                  <div className="space-y-2">
                    {group.sources.map((src) => (
                      <div key={src.id} className="flex items-center justify-between p-2 rounded" style={{ background: "hsl(var(--admin-bg))" }}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "hsl(var(--admin-text))" }}>
                            {src.name}
                            {src.language === "ar" ? " 🇸🇦" : " 🌍"}
                          </p>
                          <p className="text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>
                            {src.articles_count} مقال · {src.is_active ? "نشط" : "متوقف"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingId(src.id); setEditData({}); }} className="text-xs px-2 py-1 rounded" style={{ background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text))" }}>
                            تعديل
                          </button>
                          <button onClick={() => setDeleteTarget(src)} className="text-xs px-2 py-1 rounded text-red-400" style={{ background: "hsl(0 84% 60% / 0.1)" }}>
                            حذف
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing sources */}
      <div className="admin-surface p-5">
        <h2 className="text-lg font-semibold mb-4" style={{ color: "hsl(var(--admin-text))" }}>المصادر الحالية ({sources.length})</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(var(--admin-text-muted))" }} /></div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "hsl(var(--admin-text-muted))" }}>لا توجد مصادر بعد</p>
        ) : (
          <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.id} className="p-4 rounded-lg" style={{ background: "hsl(var(--admin-surface-hover))" }}>
                {editingId === source.id ? (
                  <div className="space-y-3">
                    <input className="admin-input text-sm" value={editData.name ?? source.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} />
                    <input className="admin-input text-sm font-latin" dir="ltr" value={editData.fetch_url ?? source.fetch_url} onChange={(e) => setEditData((d) => ({ ...d, fetch_url: e.target.value }))} />
                    <div className="flex items-center gap-3">
                      <label className="text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>الفترة:</label>
                      <input type="range" min={1} max={10} value={editData.fetch_interval_minutes ?? source.fetch_interval_minutes} onChange={(e) => setEditData((d) => ({ ...d, fetch_interval_minutes: Number(e.target.value) }))} className="flex-1 accent-green-500" />
                      <span className="text-xs font-latin" style={{ color: "hsl(var(--admin-text))" }}>{editData.fetch_interval_minutes ?? source.fetch_interval_minutes} د</span>
                    </div>

                    {/* Hide source toggle in edit */}
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "hsl(var(--admin-bg))" }}>
                      <span className="text-xs" style={{ color: "hsl(var(--admin-text))" }}>إخفاء المصدر الأصلي</span>
                      <Switch checked={editData.hide_original_source ?? source.hide_original_source ?? false} onCheckedChange={(v) => setEditData((d) => ({ ...d, hide_original_source: v }))} />
                    </div>

                    {/* Alt source in edit */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>مصدر بديل</label>
                      <input className="admin-input text-sm" value={editData.alt_source_name ?? source.alt_source_name ?? ""} onChange={(e) => setEditData((d) => ({ ...d, alt_source_name: e.target.value }))} placeholder="اسم المصدر البديل" />
                      <input className="admin-input text-sm font-latin" dir="ltr" value={editData.alt_source_url ?? source.alt_source_url ?? ""} onChange={(e) => setEditData((d) => ({ ...d, alt_source_url: e.target.value }))} placeholder="رابط المصدر البديل" />
                    </div>

                    {/* Assigned category in edit */}
                    <div>
                      <label className="text-xs font-medium" style={{ color: "hsl(var(--admin-text-muted))" }}>تخصيص القسم</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <button onClick={() => setEditData((d) => ({ ...d, assigned_category: null as any }))} className={`px-2 py-1 rounded text-[10px] font-medium ${!(editData.assigned_category ?? source.assigned_category) ? "text-white" : ""}`} style={!(editData.assigned_category ?? source.assigned_category) ? { background: "hsl(var(--urgent-red))" } : { background: "hsl(var(--admin-bg))", color: "hsl(var(--admin-text-muted))" }}>تلقائي</button>
                        {allCategories.map((cat) => (
                          <button key={cat} onClick={() => setEditData((d) => ({ ...d, assigned_category: cat }))} className={`px-2 py-1 rounded text-[10px] font-medium ${(editData.assigned_category ?? source.assigned_category) === cat ? "text-white" : ""}`} style={(editData.assigned_category ?? source.assigned_category) === cat ? { background: "hsl(var(--urgent-red))" } : { background: "hsl(var(--admin-bg))", color: "hsl(var(--admin-text-muted))" }}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateSource(source.id)} className="btn-admin-primary text-xs px-3 py-1.5">حفظ</button>
                      <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded" style={{ color: "hsl(var(--admin-text-muted))" }}>إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4" style={{ color: "hsl(var(--admin-text-muted))" }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "hsl(var(--admin-text))" }}>
                          {source.name}
                          {source.hide_original_source && <EyeOff className="w-3 h-3 inline mr-1 text-amber-400" />}
                        </p>
                        <p className="text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>
                          {source.fetch_method.toUpperCase()} · {source.language === "ar" ? "عربي" : "English"} · {source.articles_count} مقال · كل {source.fetch_interval_minutes} دقيقة
                          {source.assigned_category && ` · قسم: ${source.assigned_category}`}
                          {source.alt_source_name && ` · بديل: ${source.alt_source_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleManualFetch(source.id)} disabled={fetching === source.id} className="p-1.5 rounded hover:bg-[hsl(var(--admin-bg))] transition-colors" style={{ color: "hsl(var(--admin-text-muted))" }} title="جلب الآن">
                        {fetching === source.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => { setEditingId(source.id); setEditData({}); }} className="p-1.5 rounded hover:bg-[hsl(var(--admin-bg))] transition-colors" style={{ color: "hsl(var(--admin-text-muted))" }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(source)} className="p-1.5 rounded hover:bg-urgent/10 text-urgent">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-xs px-2 py-1 rounded ${source.is_active ? "text-green-400 bg-green-400/10" : "text-amber-400 bg-amber-400/10"}`}>
                        {source.is_active ? "نشط" : "متوقف"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OPML Import Preview */}
      {showOpmlPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="admin-surface w-full max-w-3xl max-h-[85vh] flex flex-col" style={{ margin: "1rem" }}>
            {/* Header with stats */}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid hsl(var(--admin-border))" }}>
              <div className="flex items-center gap-3">
                <FileUp className="w-5 h-5 text-green-400" />
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "hsl(var(--admin-text))" }}>
                    استيراد مصادر OPML
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>
                    <span>إجمالي: <b style={{ color: "hsl(var(--admin-text))" }}>{opmlFeeds.length}</b></span>
                    <span className="text-green-400">جديد: <b>{opmlFeeds.filter(f => f.status === "valid" && f.selected).length}</b></span>
                    <span className="text-amber-400">مكرر: <b>{opmlFeeds.filter(f => f.status === "duplicate").length}</b></span>
                    <span className="text-red-400">فاشل: <b>{opmlFeeds.filter(f => f.status === "error").length}</b></span>
                    {opmlValidating && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowOpmlPreview(false); setOpmlFeeds([]); }} className="p-1 rounded hover:bg-[hsl(var(--admin-surface-hover))]">
                <X className="w-5 h-5" style={{ color: "hsl(var(--admin-text-muted))" }} />
              </button>
            </div>

            {/* Filter & actions bar */}
            <div className="p-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: "1px solid hsl(var(--admin-border))" }}>
              <button onClick={() => setOpmlFeeds(feeds => feeds.map(f => f.status !== "duplicate" ? { ...f, selected: true } : f))} className="text-xs px-3 py-1.5 rounded transition-colors" style={{ background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text))" }}>
                تحديد الكل
              </button>
              <button onClick={() => setOpmlFeeds(feeds => feeds.map(f => ({ ...f, selected: false })))} className="text-xs px-3 py-1.5 rounded transition-colors" style={{ background: "hsl(var(--admin-surface-hover))", color: "hsl(var(--admin-text))" }}>
                إلغاء الكل
              </button>
              <button onClick={() => setOpmlFeeds(feeds => feeds.map(f => f.status === "valid" ? { ...f, selected: true } : { ...f, selected: false }))} className="text-xs px-3 py-1.5 rounded transition-colors text-green-400" style={{ background: "hsl(142 76% 36% / 0.1)" }}>
                تحديد الصالحة فقط
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>
                <Languages className="w-3.5 h-3.5" />
                <span className="text-green-400">● عربي</span>
                <span className="text-blue-400">● Global</span>
              </div>
            </div>

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {opmlFeeds.map((feed, idx) => {
                const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
                  pending: { bg: "hsl(var(--admin-surface-hover))", text: "hsl(var(--admin-text-muted))", icon: <Clock className="w-3.5 h-3.5" /> },
                  checking: { bg: "hsl(var(--admin-surface-hover))", text: "hsl(var(--admin-text-muted))", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
                  valid: { bg: "hsl(142 76% 36% / 0.1)", text: "#22c55e", icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" /> },
                  duplicate: { bg: "hsl(38 92% 50% / 0.1)", text: "#f59e0b", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> },
                  error: { bg: "hsl(0 84% 60% / 0.1)", text: "#ef4444", icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" /> },
                };
                const sc = statusColors[feed.status] || statusColors.pending;
                return (
                  <div key={idx}
                    onClick={() => feed.status !== "duplicate" && setOpmlFeeds(feeds => feeds.map((f, i) => i === idx ? { ...f, selected: !f.selected } : f))}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                    style={{ background: feed.selected && feed.status !== "duplicate" ? "hsl(142 76% 36% / 0.08)" : sc.bg, opacity: feed.status === "duplicate" ? 0.6 : 1 }}>
                    {feed.status !== "duplicate" ? (
                      feed.selected ? <CheckSquare className="w-4 h-4 text-green-400 shrink-0" /> : <Square className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--admin-text-muted))" }} />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "hsl(var(--admin-text))" }}>{feed.name}</p>
                        {feed.detectedLanguage && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${feed.detectedLanguage === "ar" ? "text-green-400 bg-green-400/10" : "text-blue-400 bg-blue-400/10"}`}>
                            {feed.detectedLanguage === "ar" ? "عربي" : "Global"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate font-latin" dir="ltr" style={{ color: "hsl(var(--admin-text-muted))" }}>{feed.xmlUrl}</p>
                      <p className="text-xs mt-0.5" style={{ color: sc.text }}>{feed.statusMessage}</p>
                    </div>
                    <div className="shrink-0">{sc.icon}</div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-5 flex items-center justify-between" style={{ borderTop: "1px solid hsl(var(--admin-border))" }}>
              <p className="text-xs" style={{ color: "hsl(var(--admin-text-muted))" }}>
                {opmlValidating ? "جاري فحص المصادر..." : `محدد: ${opmlFeeds.filter(f => f.selected && f.status !== "duplicate").length} مصدر`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setShowOpmlPreview(false); setOpmlFeeds([]); }} className="px-4 py-2 rounded-lg text-sm" style={{ color: "hsl(var(--admin-text-muted))" }}>
                  إلغاء
                </button>
                <button onClick={handleBulkImport} disabled={opmlImporting || opmlValidating || opmlFeeds.filter(f => f.selected && f.status !== "duplicate").length === 0}
                  className="btn-admin-primary flex items-center gap-2 disabled:opacity-50">
                  {opmlImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                  استيراد ({opmlFeeds.filter(f => f.selected && f.status !== "duplicate").length}) مصدر
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المصدر: {deleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف الأخبار الخاصة بهذا المصدر أيضاً؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-2">
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteSource(false)} className="bg-amber-600 hover:bg-amber-700">
              حذف المصدر فقط
            </AlertDialogAction>
            <AlertDialogAction onClick={() => confirmDeleteSource(true)} className="bg-destructive hover:bg-destructive/90">
              حذف المصدر مع كل أخباره
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSources;
