import { useState, useEffect } from 'react';

/**
 * useThemeTokens
 * Reads runtime theme tokens injected by the Central Theme Loader SDK
 * (https://ui-theme.pydah.edu.in/themes/theme-loader.js).
 * Updates automatically when a new theme is published in the Theme Editor.
 */
function readTokens() {
  if (typeof window === 'undefined') return {};

  let raw = {};
  if (window.ThemeLoader && typeof window.ThemeLoader.getTokens === 'function') {
    raw = window.ThemeLoader.getTokens() || {};
  }

  // Also read direct computed styles from document root as complementary source
  let compStyle = null;
  if (typeof document !== 'undefined') {
    compStyle = getComputedStyle(document.documentElement);
  }

  const getVal = (tokenName) => {
    if (raw[tokenName]) return raw[tokenName];
    if (compStyle) {
      const val = compStyle.getPropertyValue('--' + tokenName).trim();
      if (val) return val;
    }
    return '';
  };

  const primary = getVal('primary') || 'var(--primary)';
  const sidebar = getVal('sidebar') || primary;
  const sidebarText = getVal('sidebar-text') || '#FFFFFF';
  const sidebarMuted = getVal('sidebar-muted') || 'rgba(255, 255, 255, 0.7)';

  return {
    ...raw,
    primary,
    primaryHover: getVal('primary-hover') || 'var(--primary-hover)',
    primaryLight: getVal('primary-light') || 'var(--primary-light)',
    sidebar,
    sidebarText,
    sidebarMuted,
    background: getVal('background') || 'var(--background)',
    surface: getVal('surface') || 'var(--surface)',
    border: getVal('border') || 'var(--border)',
    borderStrong: getVal('border-strong') || 'var(--border-strong)',
    accent: getVal('accent') || 'var(--accent)',
    secondary: getVal('secondary') || 'var(--secondary)'
  };
}

export function useThemeTokens() {
  const [tokens, setTokens] = useState(() => readTokens());

  useEffect(() => {
    const handleUpdate = () => {
      setTokens(readTokens());
    };

    window.addEventListener('theme:updated', handleUpdate);
    window.addEventListener('pydah:theme-updated', handleUpdate);

    // Initial polling sync to catch theme-loader after hydration
    const timer1 = setTimeout(handleUpdate, 150);
    const timer2 = setTimeout(handleUpdate, 600);
    const timer3 = setTimeout(handleUpdate, 1500);

    return () => {
      window.removeEventListener('theme:updated', handleUpdate);
      window.removeEventListener('pydah:theme-updated', handleUpdate);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return tokens;
}

export default useThemeTokens;
