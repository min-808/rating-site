"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button 
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle Dark Mode"
      style={{
        position: 'relative',
        width: '46px', // Reduced from 60px
        height: '26px', // Reduced from 32px
        borderRadius: '999px',
        backgroundColor: isDark ? '#333333' : '#e4e4e7',
        border: '2px solid var(--btn-border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: '2px',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Background Icons */}
      <span style={{ position: 'absolute', left: '4px', fontSize: '12px', zIndex: 0 }}>☀️</span>
      <span style={{ position: 'absolute', right: '4px', fontSize: '12px', zIndex: 0 }}>🌙</span>

      {/* The Sliding Thumb */}
      <div 
        style={{
          width: '18px', // Reduced from 24px
          height: '18px', // Reduced from 24px
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transform: isDark ? 'translateX(20px)' : 'translateX(0px)', // Adjusted slide distance to fit new width
          transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
          zIndex: 1, 
        }}
      />
    </button>
  );
}