import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

export interface DBArticle {
  id: string; title: string; description: string | null; content: string | null; url: string;
  image_url: string | null; author: string | null; category: string | null; language: string;
  published_at: string | null; source_id: string | null; is_published: boolean;
  is_ai_generated: boolean; created_at: string; slug: string | null; video_url?: string | null;
  images?: string[] | string | null; videos?: string[] | string | null; hashtags?: string[] | null;
}

const PAGE_SIZE = 30;
const articlesCollection = collection(firestore, "articles");
const asArticle = (id: string, value: Record<string, any>): DBArticle => ({
  id, title: value.title || "", description: value.description ?? null, content: value.content ?? null,
  url: value.url || "", image_url: value.image_url || value.imageUrl || null, author: value.author ?? null,
  category: value.category ?? null, language: value.language || "ar",
  published_at: value.published_at || value.publishedAt || value.created_at || null,
  source_id: value.source_id || value.sourceId || null, is_published: value.is_published !== false,
  is_ai_generated: Boolean(value.is_ai_generated), created_at: value.created_at || value.createdAt || new Date().toISOString(),
  slug: value.slug || null, video_url: value.video_url || null, images: value.images || null,
  videos: value.videos || null, hashtags: value.hashtags || null,
});
const uniqueArticles = (items: DBArticle[]) => {
  const urls = new Set<string>(); const titles = new Set<string>();
  return items.filter((a) => {
    const url = a.url.trim().toLowerCase().replace(/\/$/, "");
    const title = a.title.trim().toLowerCase().replace(/[\s\u064B-\u065F]+/g, " ");
    if ((url && urls.has(url)) || (title && titles.has(title))) return false;
    if (url) urls.add(url); if (title) titles.add(title); return true;
  });
};
const readArticles = async (language: string) => {
  const snapshot = await getDocs(query(articlesCollection, where("language", "==", language)));
  return uniqueArticles(snapshot.docs.map((d) => asArticle(d.id, d.data()))).sort((a, b) =>
    String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at)));
};

export function useArticles(language = "ar", page = 1) {
  const [articles, setArticles] = useState<DBArticle[]>([]); const [totalCount, setTotalCount] = useState(0); const [loading, setLoading] = useState(true);
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try { const all = await readArticles(language); setTotalCount(all.length); setArticles(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)); }
    catch (error) { console.error("Firebase articles error:", error); setArticles([]); setTotalCount(0); }
    finally { setLoading(false); }
  }, [language, page]);
  useEffect(() => { void fetchArticles(); }, [fetchArticles]);
  useEffect(() => onSnapshot(query(articlesCollection, where("language", "==", language)), () => void fetchArticles(), (e) => console.error("Firebase realtime error:", e)), [fetchArticles, language]);
  return { articles, totalCount, loading, totalPages: Math.ceil(totalCount / PAGE_SIZE), refetch: fetchArticles };
}

export function useBreakingNews(language = "ar") {
  const [articles, setArticles] = useState<DBArticle[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => { try { const all = await readArticles(language); if (!cancelled) setArticles(all.slice(0, 10)); } catch (e) { console.error("Firebase breaking news error:", e); } };
    void load(); const unsubscribe = onSnapshot(query(articlesCollection, where("language", "==", language)), () => void load());
    return () => { cancelled = true; unsubscribe(); };
  }, [language]);
  return articles;
}
