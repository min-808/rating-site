'use client';

import { useState } from 'react';

interface FallbackImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  // images load only when they are about to be seen, so a page with 50 jackets doesn't
  // download them all up front. pass "eager" for one that is always at the top of the page
  loading?: 'lazy' | 'eager';
}

// tries the blob url first, then swaps to maimai's url if it 404s
export default function FallbackImage({
  src,
  fallbackSrc,
  alt,
  className,
  width,
  height,
  loading = 'lazy',
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
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (!failed && fallbackSrc && fallbackSrc !== src) setFailed(true);
      }}
    />
  );
}