import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { DBArticle } from "@/hooks/useArticles";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ShareButtons from "@/components/ShareButtons";
import { ArrowRight, Clock, Loader2, ExternalLink, User, Play, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Helmet } from "react-helmet-async";
import { decodeHtmlEntities, cleanArticleContent } from "@/lib/htmlUtils";

interface SourceInfo {
  hide_original_source?: boolean;
  alt_source_name?: string;
  alt_source_url?: string;
}

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<DBArticle | null>(null);
  const [related, setRelated] = useState<DBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      const bySlug = await getDocs(query(collection(firestore, "articles"), where("slug", "==", slug)));
      let data: any = bySlug.docs[0]?.data() ? { id: bySlug.docs[0].id, ...bySlug.docs[0].data() } : null;
      if (!data) { const byId = await getDoc(doc(firestore, "articles", slug)); data = byId.exists() ? { id: byId.id, ...byId.data() } : null; }
      setArticle(data as DBArticle | null);
      setLoading(false);
      if (data?.source_id) { const src = await getDoc(doc(firestore, "news_sources", data.source_id)); if (src.exists()) setSourceInfo(src.data() as SourceInfo); }
      if (data) {
        const relatedSnapshot = await getDocs(query(collection(firestore, "articles"), where("language", "==", data.language)));
        const relatedData = relatedSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item: any) => item.is_published !== false && item.id !== data.id).slice(0, 6);
        setRelated(relatedData as DBArticle[]);
      }
    };
    fetchArticle();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">المقال غير موجود</h1>
          <Link to="/" className="text-urgent hover:underline">العودة للرئيسية</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const isAr = article.language === "ar";
  const timeAgo = article.published_at
    ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true, locale: isAr ? ar : undefined })
    : "";

  const articleSlug = article.slug || article.id;
  const siteUrl = `${window.location.origin}/article/${articleSlug}`;
  const cleanTitle = decodeHtmlEntities(article.title);
  const cleanDesc = decodeHtmlEntities(article.description);
  const cleanContent = cleanArticleContent(article.content);

  const hideSource = sourceInfo?.hide_original_source;
  const showAltSource = hideSource && sourceInfo?.alt_source_name;
  const videoUrl = (article as any).video_url;

  // Extra media from arrays
  const extraImages: string[] = (() => {
    try {
      const imgs = (article as any).images;
      if (Array.isArray(imgs)) return imgs.filter((u: string) => u && u.trim() !== '');
      if (typeof imgs === 'string') return JSON.parse(imgs).filter((u: string) => u && u.trim() !== '');
      return [];
    } catch { return []; }
  })();

  const extraVideos: string[] = (() => {
    try {
      const vids = (article as any).videos;
      if (Array.isArray(vids)) return vids.filter((u: string) => u && u.trim() !== '');
      if (typeof vids === 'string') return JSON.parse(vids).filter((u: string) => u && u.trim() !== '');
      return [];
    } catch { return []; }
  })();

  // All images for gallery (primary + extras, deduplicated)
  const allImages = [article.image_url, ...extraImages].filter((u, i, arr) => u && u.trim() !== '' && arr.indexOf(u) === i);
  const allVideos = [videoUrl, ...extraVideos].filter((u, i, arr) => u && u.trim() !== '' && arr.indexOf(u) === i);

  const isYouTubeUrl = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');
  const getYouTubeEmbed = (url: string) => {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url;
  };

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <Helmet>
        <title>{cleanTitle} | القيادة 24</title>
        <meta name="description" content={cleanDesc || cleanTitle} />
        <meta property="og:title" content={cleanTitle} />
        <meta property="og:description" content={cleanDesc || cleanTitle} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="القيادة 24 - Alqiada 24" />
        {allImages[0] && <meta property="og:image" content={allImages[0]} />}
        {article.author && <meta property="article:author" content={article.author} />}
        <meta name="twitter:card" content={allImages[0] ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={cleanTitle} />
        <meta name="twitter:description" content={cleanDesc || cleanTitle} />
        {allImages[0] && <meta name="twitter:image" content={allImages[0]} />}
      </Helmet>

      <SiteHeader />
      <div className="container mx-auto py-6 max-w-4xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 bg-transparent border-none cursor-pointer">
          <ArrowRight className="w-4 h-4" />
          {isAr ? "العودة للسابق" : "Go Back"}
        </button>

        <article>
          <span className="text-xs font-semibold text-urgent">{article.category}</span>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight mt-2 mb-4">{cleanTitle}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            {article.author && (
              <span className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                {article.author}
              </span>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{timeAgo}</span>
          </div>

          {/* Primary Video (autoplay) */}
          {allVideos.length > 0 && (
            <div className="mb-6 space-y-3">
              {allVideos.map((vid, idx) => (
                <div key={idx} className="rounded-lg overflow-hidden bg-black">
                  {isYouTubeUrl(vid) ? (
                    <iframe
                      src={getYouTubeEmbed(vid)}
                      className="w-full aspect-video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`video-${idx}`}
                    />
                  ) : (
                    <video
                      src={vid}
                      controls
                      autoPlay={idx === 0}
                      muted={idx !== 0}
                      loop
                      playsInline
                      className="w-full max-h-[500px] bg-black"
                      preload="metadata"
                      poster={allImages[0] || undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Primary Image */}
          {allImages[0] && !allVideos.length && (
            <img
              src={allImages[0]}
              alt={cleanTitle}
              className="w-full rounded-lg mb-6 max-h-[500px] object-cover cursor-pointer"
              onClick={() => setLightboxIndex(0)}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          {/* Extra Images Gallery */}
          {allImages.length > 1 && (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-2">
              {allImages.slice(allVideos.length > 0 ? 0 : 1).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${cleanTitle} - ${idx + 2}`}
                  className="w-full h-32 md:h-40 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  loading="lazy"
                  onClick={() => setLightboxIndex(allVideos.length > 0 ? idx : idx + 1)}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ))}
            </div>
          )}

          {cleanDesc && (
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{cleanDesc}</p>
          )}

          {cleanContent && (
            <div className="prose prose-lg max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
              {cleanContent}
            </div>
          )}

          {/* Hashtags */}
          {(article as any).hashtags && ((article as any).hashtags as string[]).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {((article as any).hashtags as string[]).map((tag, i) => (
                <span key={i} className="inline-block px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-default">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Source section */}
          <div className="mt-8 pt-4 border-t border-border">
            {/* Alternative source button */}
            {showAltSource && sourceInfo?.alt_source_url && (
              <a
                href={sourceInfo.alt_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                المصدر الرسمي
              </a>
            )}

            {/* Original source (only if not hidden) */}
            {!hideSource && article.url && !article.url.startsWith("manual-") && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {isAr ? "عرض المصدر الأصلي" : "View Original Source"}
              </a>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
            <span className="text-sm text-muted-foreground">{isAr ? "مشاركة:" : "Share:"}</span>
            <ShareButtons title={cleanTitle} articleId={article.id} slug={articleSlug} author={article.author} description={cleanDesc} />
          </div>

          {/* Site branding footer */}
          {isAr && (
            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-sm font-semibold text-foreground">تابع الأخبار عبر موقع القيادة 24</p>
              <p className="text-xs text-muted-foreground mt-1">#القيادة_24</p>
            </div>
          )}
        </article>

        {/* Related Articles */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-foreground mb-6">{isAr ? "مقالات ذات صلة" : "Related Articles"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.id} to={`/article/${r.slug || r.id}`} className="news-card overflow-hidden group">
                  {r.image_url && r.image_url.trim() !== "" && (
                    <img src={r.image_url} alt="" className="w-full h-36 object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="p-3">
                    <span className="text-xs text-urgent font-semibold">{r.category}</span>
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 mt-1 group-hover:text-urgent transition-colors">
                      {decodeHtmlEntities(r.title)}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxIndex !== null && allImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + allImages.length) % allImages.length); }}
                className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % allImages.length); }}
                className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <img
            src={allImages[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {allImages.length > 1 && (
            <div className="absolute bottom-4 text-white/60 text-sm">
              {lightboxIndex + 1} / {allImages.length}
            </div>
          )}
        </div>
      )}

      <SiteFooter />
    </div>
  );
};

export default ArticlePage;
