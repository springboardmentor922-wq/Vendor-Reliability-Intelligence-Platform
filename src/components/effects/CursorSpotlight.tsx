import React, { useEffect, useRef } from 'react';

/**
 * Ultra-high-speed cursor reactive spotlight effect.
 * Uses requestAnimationFrame and directly sets CSS custom properties on documentElement
 * to avoid triggering any React reconciliation or re-renders during mouse movements.
 */
export const CursorSpotlight: React.FC = () => {
  const isMovingRef = useRef(false);
  const posRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    let animId: number;

    const updatePosition = () => {
      document.documentElement.style.setProperty('--cursor-x', `${posRef.current.x}px`);
      document.documentElement.style.setProperty('--cursor-y', `${posRef.current.y}px`);
      isMovingRef.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!isMovingRef.current) {
        isMovingRef.current = true;
        animId = requestAnimationFrame(updatePosition);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      {/* Ambient Radial Spotlight following cursor */}
      <div 
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300 opacity-70"
        style={{
          background: `radial-gradient(650px circle at var(--cursor-x, -500px) var(--cursor-y, -500px), rgba(14, 165, 233, 0.08), transparent 80%)`,
        }}
      />
      {/* Secondary subtle high-tech tint */}
      <div 
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-500 opacity-40"
        style={{
          background: `radial-gradient(280px circle at var(--cursor-x, -500px) var(--cursor-y, -500px), rgba(99, 102, 241, 0.12), transparent 70%)`,
        }}
      />
    </>
  );
};
