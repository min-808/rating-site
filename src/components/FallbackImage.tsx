'use client';

import { useState } from 'react';

interface FallbackImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

// tries the blob url first, then swaps to maimai's url if it 404s
export default function FallbackImage({
  src,
  fallbackSrc,
  alt,
  className,
  width,
  height,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  const current = !failed && src ? src : fallbackSrc;
  if (!current) return null;

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      width={width}
      height={height}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!failed && fallbackSrc && fallbackSrc !== src) setFailed(true);
      }}
    />
  );
}