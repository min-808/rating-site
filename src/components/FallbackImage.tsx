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

// tries the blob url first, and quietly swaps to maimai's url if it 404s
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className={className}
      width={width}
      height={height}
      referrerPolicy="no-referrer"
      onError={() => {
        // only worth retrying if there's a different url to try
        if (!failed && fallbackSrc && fallbackSrc !== src) setFailed(true);
      }}
    />
  );
}