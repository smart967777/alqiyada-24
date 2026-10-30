import { useState, useEffect, useCallback, useRef } from "react";
import { DBArticle } from "@/hooks/useArticles";
import { ChevronLeft, ChevronRight, Newspaper, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { decodeHtmlEntities } from "@/lib/htmlUtils";

interface Props {
  articles: DBArticle[];
}

const NewsSlider = ({ articles }: Props) => {
  const [current, setCurrent] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Prefer items with media (images or videos)
  const items = articles
    .filter((a) => (a.image_url && a.image_url.trim() !== "") || (a as any).video_url)
    .slice(0, 8);
  const displayItems = items.length > 0 ? items : articles.slice(0, 8);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % displayItems.length);
  }, [displayItems.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + displayItems.length) % displayItems.length);
  }, [displayItems.length]);

  useEffect(() => {
    if (displayItems.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, displayItems.length]);

  // Auto-play video when slide changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [current]);

  if (displayItems.length === 0) return null;

  const article = displayItems[current];
  const videoUrl = (article as any).video_url;
  const hasVideo = videoUrl && videoUrl.trim() !== "";
  const isYouTube = hasVideo && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'));
  const cleanTitle = decodeHtmlEntities(article.title);

  return (
    <div className="container mx-auto py-4">
      <div className="relative rounded-xl overflow-hidden h-[250px] md:h-[350px] group">
        {hasVideo && !isYouTube ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={article.image_url || undefined}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : article.image_url ? (
          <>
            <img
              src={article.image_url}
              alt={cleanTitle}
              className="w-full h-full object-cover transition-transform duration-700"
              onError={(e) => { e.currentTarget.src = "/assets/hero-news.jpg"; e.currentTarget.onerror = null; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {hasVideo && isYouTube && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                  <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <Newspaper className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute bottom-0 right-0 left-0 p-5 md:p-8">
          <Link to={`/article/${article.slug || article.id}`}>
            <h3 className="text-lg md:text-2xl font-bold text-white leading-tight line-clamp-2 hover:underline">
              {cleanTitle}
            </h3>
          </Link>
          {article.description && (
            <p className="text-sm text-white/70 mt-2 line-clamp-1 hidden md:block">{decodeHtmlEntities(article.description)}</p>
          )}
        </div>
        {displayItems.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        {/* Dots */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {displayItems.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-5" : "bg-white/40"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsSlider;
