import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const KEY = 'vendoriq.theme';

/** Dark / light switch. Charts listen to `mode` so they redraw in the new palette. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.initial());

  toggle(): void {
    this.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);

    if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* storage unavailable - the choice just won't persist */
    }
  }

  /** Reads a CSS custom property from the root, for canvas-drawn charts. */
  token(name: string, fallback = '#888'): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  private initial(): ThemeMode {
    try {
      return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
}
