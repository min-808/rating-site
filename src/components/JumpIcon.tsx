'use client';

import { useState } from 'react';

export default function JumpIcon({ src, className }: { src: string; className?: string }) {
  const [jumping, setJumping] = useState(false);

  return (
    <img
      src={src}
      alt=""
      className={`${className ?? ''}${jumping ? ' is-jumping' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setJumping(true);
      }}
      onClick={() => setJumping(true)}
      onAnimationEnd={() => setJumping(false)}
    />
  );
}