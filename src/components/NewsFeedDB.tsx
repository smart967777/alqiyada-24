import { motion } from "framer-motion";
import { DBArticle } from "@/hooks/useArticles";
import { Clock, User, Play } from "lucide-react";
import ShareButtons from "./ShareButtons";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { decodeHtmlEntities } from "@/lib/htmlUtils";
import { useState, useRef } from "react";

interface Props {
  articles: DBArticle[];
  language?: string;
}

const formatTime = (dateStr: string | null, lang: string) => {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: lang === "ar" ? ar : undefined,
    });
  } catch {
    return "";
  }
};

const NewsFeedDB = ({ articles, language = "ar" }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {articles.map((article, i) => (
        <NewsCard key={article.id} article={article} index={i} language={language} />
      ))}
    </div>
  );
};

function NewsCard({ article, index, language }: { article: DBArticle; index: number; language: string }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasVideo = article.video_url && article.video_url.trim() !== "";
  const hasImage = article.image_url && article.image_url.trim() !== "";
  const isYouTube = hasVideo && (article.video_url!.includes('youtube.com') || article.video_url!.includes('youtu.be'));

  const handleMouseEnter = () => {
    setHovered(true);
    if (hasVideo && !isYouTube && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (hasVideo && !isYouTube && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.article
      initial={index < 6 ? { opacity: 0, y: 8 } : undefined}
      animate={index < 6 ? { opacity: 1, y: 0 } : undefined}
      transition={index < 6 ? { delay: index * 0.03, duration: 0.3 } : undefined}
      className="news-card overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media Section */}
      <Link to={`/article/${article.slug || article.id}`} className="block relative">
        {hasVideo && !isYouTube ? (
          <div className="relative w-full h-48 bg-black">
            <video
              ref={videoRef}
              src={article.video_url!}
              className="w-full h-48 object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              poster={hasImage ? article.image_url! : undefined}
            />
            {!hovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="w-5 h-5 text-black mr-[-2px]" fill="black" />
                </div>
              </div>
            )}
          </div>
        ) : hasVideo && isYouTube ? (
          <div className="relative w-full h-48 bg-black">
            {hasImage ? (
              <img
                src={article.image_url!}
                alt={decodeHtmlEntities(article.title)}
                className="w-full h-48 object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.src = "/assets/hero-news.jpg"; e.currentTarget.onerror = null; }}
              />
            ) : (
              <div className="w-full h-48 bg-secondary" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
              </div>
            </div>
          </div>
        ) : hasImage ? (
          <img
            src={article.image_url!}
            alt={decodeHtmlEntities(article.title)}
            className="w-full h-48 object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.src = "/assets/hero-news.jpg"; e.currentTarget.onerror = null; }}
          />
        ) : null}
      </Link>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-urgent">{article.category || (language === "ar" ? "عام" : "General")}</span>
          {hasVideo && (
            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
              <Play className="w-3 h-3" fill="currentColor" />
              فيديو
            </span>
          )}
        </div>
        <Link to={`/article/${article.slug || article.id}`}>
          <h3 className="text-base font-bold text-foreground leading-snug mb-2 line-clamp-2 hover:text-urgent transition-colors">
            {decodeHtmlEntities(article.title)}
          </h3>
        </Link>
        {article.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{decodeHtmlEntities(article.description)}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {article.author && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {article.author}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(article.published_at, language)}
            </span>
          </div>
          <ShareButtons title={article.title} articleId={article.id} slug={article.slug || article.id} />
        </div>
      </div>
    </motion.article>
  );
}

export default NewsFeedDB;
