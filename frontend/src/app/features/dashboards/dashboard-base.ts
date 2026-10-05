import { DestroyRef, Directive, effect, inject, signal, untracked } from '@angular/core';

import { LiveService } from '../../core/live.service';
import { ToastService } from '../../core/toast.service';
import { daysAgo } from '../../shared/viz/format';

export type RangeKey = '30d' | '90d' | '6m' | '12m' | 'all';

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6m', label: '6M' },
  { key: '12m', label: '12M' },
  { key: 'all', label: 'All' },
];

export function rangeFilters(key: RangeKey): { start: string | null; months: number } {
  switch (key) {
    case '30d':
      return { start: daysAgo(29), months: 3 };
    case '90d':
      return { start: daysAgo(89), months: 3 };
    case '6m':
      return { start: daysAgo(182), months: 6 };
    case '12m':
      return { start: daysAgo(364), months: 12 };
    default:
      return { start: null, months: 24 };
  }
}

/**
 * Shared loading / live-refresh behaviour for the three dashboards.
 *
 * `load(silent)` fetches the payload; the first call shows skeletons, later
 * calls (filter changes, live data changes) keep the charts on screen and
 * animate them to the new values.
 */
@Directive()
export abstract class DashboardBase<T> {
  protected readonly live = inject(LiveService);
  protected readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<T | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly updatedAt = signal<Date | null>(null);
  readonly ranges = RANGES;
  readonly range = signal<RangeKey>('6m');

  private seenVersion: string | null = null;
  private request: { unsubscribe(): void } | null = null;

  constructor() {
    effect(() => {
      const version = this.live.version();
      untracked(() => {
        if (version && this.seenVersion && version !== this.seenVersion && this.data()) {
          this.load(true);
        }
        this.seenVersion = version;
      });
    });

    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected abstract fetch(): import('rxjs').Observable<T>;

  load(silent = false): void {
    this.request?.unsubscribe();
    if (!silent || !this.data()) this.loading.set(!this.data());
    this.refreshing.set(true);

    this.request = this.fetch().subscribe({
      next: (payload) => {
        this.data.set(payload);
        this.loading.set(false);
        this.refreshing.set(false);
        this.updatedAt.set(new Date());
      },
      error: (error) => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.toast.fromError(error, 'Could not load the dashboard.');
      },
    });
  }

  setRange(key: RangeKey): void {
    if (this.range() === key) return;
    this.range.set(key);
    this.load(true);
  }

  refresh(): void {
    this.load(true);
    this.live.poke();
  }
}
