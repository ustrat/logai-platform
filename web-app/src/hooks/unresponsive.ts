import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsTablet(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isTablet;
}

/**
 * Responsive grid columns helper
 * Usage: cols={responsive(4, 2, 1)} → 4 on desktop, 2 on tablet, 1 on mobile
 */
export function responsiveCols(desktop: number, tablet?: number, mobile?: number) {
  const isMob = window.innerWidth < 768;
  const isTab = window.innerWidth < 1024;
  if (isMob && mobile !== undefined) return `repeat(${mobile}, 1fr)`;
  if (isTab && tablet !== undefined) return `repeat(${tablet}, 1fr)`;
  return `repeat(${desktop}, 1fr)`;
}

/**
 * Page padding — smaller on mobile
 */
export function pagePadding(isMobile: boolean) {
  return isMobile ? '16px' : '28px 32px';
}