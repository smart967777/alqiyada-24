import { useState, type ImgHTMLAttributes } from "react";

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  fallbackLabel?: string;
}

const DEFAULT_FALLBACK = "/assets/hero-news.jpg";

export default function SafeImage({ src, alt = "", fallbackSrc = DEFAULT_FALLBACK, fallbackLabel, className = "", ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative overflow-hidden bg-[#10233c] bg-cover bg-center ${className}`}
        style={{ backgroundImage: `linear-gradient(135deg, rgba(16,35,60,.9), rgba(201,148,62,.45)), url(${fallbackSrc})` }}
      >
        {fallbackLabel && <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-xs font-bold text-white drop-shadow">{fallbackLabel}</span>}
      </div>
    );
  }
  return <img {...props} src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
