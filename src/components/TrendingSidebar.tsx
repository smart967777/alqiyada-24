import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { TrendingUp, Newspaper, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { decodeHtmlEntities } from "@/lib/htmlUtils";

interface LatestArticle {
  id: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
  category: string | null;
  slug: string | null;
}

const TrendingSidebar = () => {
  const [latest, setLatest] = useState<LatestArticle[]>([]);
  const [mostRead, setMostRead] = useState<LatestArticle[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(firestore, "articles"));
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as LatestArticle[];
        const visible = rows.filter((item: any) => item.is_published !== false).sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
        setLatest(visible.slice(0, 5)); setMostRead(visible.slice(0, 8));
      } catch (error) { console.error("Firebase sidebar error:", error); }
    };
    void fetchData();
  }, []);
  return (
    <aside className="space-y-6">
      <div className="news-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-urgent" />
          <h3 className="text-lg font-bold text-foreground">آخر المقالات</h3>
        </div>
        <div className="space-y-3">
          {latest.map((article) => (
            <Link key={article.id} to={`/article/${article.slug || article.id}`} className="flex gap-3 group">
              {article.image_url && article.image_url.trim() !== "" && (
                <img src={article.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground group-hover:text-urgent transition-colors line-clamp-2 leading-snug">
                  {decodeHtmlEntities(article.title)}
                </h4>
                <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {article.published_at ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true, locale: ar }) : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="news-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-urgent" />
          <h3 className="text-lg font-bold text-foreground">الأكثر قراءة</h3>
        </div>
        <div className="space-y-1">
          {mostRead.map((article, i) => (
            <Link key={article.id} to={`/article/${article.slug || article.id}`} className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-secondary transition-colors group">
              <span className="text-2xl font-bold text-muted-foreground/30 font-latin w-8 text-center tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground group-hover:text-urgent transition-colors line-clamp-2">
                  {decodeHtmlEntities(article.title)}
                </h4>
                {article.category && <span className="text-xs text-urgent">{article.category}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default TrendingSidebar;
