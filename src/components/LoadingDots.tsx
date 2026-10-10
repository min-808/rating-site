// "checking" + dots that count up . .. ... and start over, for buttons that are waiting
// on the server. the dots keep their full width the whole time, so the button doesn't
// jiggle as they appear. with reduced motion on, it's a still "..."
// plain markup, no 'use client': works in server and client components alike

const css = `
  .ld-dots { display: inline-block; text-align: left; }
  .ld-dots span { animation: 1.2s steps(1, end) infinite; }
  .ld-dots span:nth-child(1) { animation-name: ld-dot-1; }
  .ld-dots span:nth-child(2) { animation-name: ld-dot-2; }
  .ld-dots span:nth-child(3) { animation-name: ld-dot-3; }
  /* each dot shows from its quarter of the cycle onwards, so: (none) . .. ... */
  @keyframes ld-dot-1 { 0% { visibility: hidden; } 25%, 100% { visibility: visible; } }
  @keyframes ld-dot-2 { 0% { visibility: hidden; } 50%, 100% { visibility: visible; } }
  @keyframes ld-dot-3 { 0% { visibility: hidden; } 75%, 100% { visibility: visible; } }
  @media (prefers-reduced-motion: reduce) {
    .ld-dots span { animation: none; }
  }
`;

export default function LoadingDots({ label }: { label: string }) {
  return (
    <>
      <style>{css}</style>
      {label}
      <span className="ld-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
    </>
  );
}
