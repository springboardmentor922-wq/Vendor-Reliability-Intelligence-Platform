import { Injectable, computed, inject } from '@angular/core';

import { ThemeService } from '../../core/theme.service';

/**
 * Chart colours resolved from CSS tokens for the active theme.
 *
 * Categorical slots follow the validated order and are assigned to an entity
 * by a fixed key (a status, a category), never by rank - so filtering a chart
 * never repaints the survivors.
 */
@Injectable({ providedIn: 'root' })
export class Palette {
  private readonly theme = inject(ThemeService);

  readonly colors = computed(() => {
    this.theme.mode();
    const t = (name: string, fallback: string) => this.theme.token(name, fallback);
    return {
      series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => t(`--viq-series-${i}`, '#3987e5')),
      surface: t('--viq-surface', '#0f1729'),
      ink: t('--viq-ink', '#e9edf7'),
      inkSoft: t('--viq-ink-soft', '#97a3bb'),
      grid: t('--viq-chart-grid', 'rgba(148,163,184,.12)'),
      accent: t('--viq-accent', '#7c7cf8'),
      success: '#0ca30c',
      warning: '#fab219',
      serious: '#ec835a',
      critical: '#d03b3b',
      neutral: t('--viq-neutral', '#a3adc2'),
    };
  });

  /** Fixed slot per known label so a colour always means the same thing. */
  private readonly slots: Record<string, number> = {
    // PO / procurement states
    'Pending Approval': 3, Pending: 3, Approved: 0, 'In Progress': 6, Ordered: 6,
    Delivered: 1, Completed: 2, Cancelled: 7,
    // delivery
    'Delivered On Time': 2, 'In Transit': 0, Delayed: 1,
    // categories
    'Raw Material Suppliers': 0, 'Equipment Vendors': 1, 'IT Vendors': 2,
    'Service Providers': 3, 'Logistics Partners': 4, 'Maintenance Vendors': 6,
    // contracts
    Active: 2, 'Expiring Soon': 3, Renewed: 0, Expired: 7, Draft: 6, Terminated: 1,
    // communication
    'Messages from Buyer': 0, 'Vendor Replies': 2, 'Open Queries': 3, 'Resolved Queries': 5,
    'Files Shared': 6, Notifications: 4,
    // roles
    Administrator: 6, 'Procurement Manager': 0, 'Supply Chain Manager': 2, 'Finance Officer': 3,
    Auditor: 4, Vendor: 1,
  };

  forLabel(label: string, index: number): string {
    const slot = this.slots[label] ?? index;
    return this.colors().series[slot % 8];
  }

  status(label: string): string {
    const c = this.colors();
    switch (label) {
      case 'Low':
      case 'Compliant':
        return c.success;
      case 'Medium':
      case 'Minor Issues':
        return c.warning;
      case 'High':
      case 'Major Issues':
        return c.serious;
      case 'Critical':
      case 'Non-Compliant':
        return c.critical;
      default:
        return c.neutral;
    }
  }

  /** Translucent fill for areas and radar polygons. */
  alpha(hex: string, a: number): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
}
