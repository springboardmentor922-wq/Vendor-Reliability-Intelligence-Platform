import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ActivityItem } from '../../core/dashboards.service';
import { timeAgo } from './format';

const ICONS: Record<string, string> = {
  Vendor: 'storefront',
  PurchaseOrder: 'receipt_long',
  ProcurementRequest: 'assignment',
  Contract: 'gavel',
  Invoice: 'payments',
  Thread: 'forum',
  User: 'person',
  DataImport: 'upload_file',
  Reliability: 'insights',
};

const LINKS: Record<string, string> = {
  Vendor: '/vendors',
  PurchaseOrder: '/purchase-orders',
  ProcurementRequest: '/procurement',
  Contract: '/contracts',
  Thread: '/communication',
};

/** Activity log entries, newest first; new arrivals flash as they appear. */
@Component({
  selector: 'viq-activity-feed',
  imports: [MatIconModule, RouterLink],
  template: `
    @if (items().length === 0) {
      <div class="empty-note">No activity yet.</div>
    } @else {
      <ul class="feed">
        @for (item of items(); track item.id) {
          <li [class.fresh]="isFresh(item.id)">
            <span class="feed-icon"><mat-icon>{{ icon(item.entity_type) }}</mat-icon></span>
            <div>
              @if (link(item); as href) {
                <a class="feed-title" [routerLink]="href">{{ pretty(item.entity_type) }} · {{ item.action }}</a>
              } @else {
                <div class="feed-title">{{ pretty(item.entity_type) }} · {{ item.action }}</div>
              }
              @if (item.description) {
                <div class="feed-body">{{ item.description }}</div>
              }
              <div class="feed-meta">{{ item.user_name }} · {{ ago(item.created_at) }}</div>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: [`a.feed-title { color: inherit; text-decoration: none; } a.feed-title:hover { color: var(--viq-accent); }`],
})
export class ActivityFeed {
  readonly items = input.required<ActivityItem[]>();
  readonly now = input(Date.now());

  private previous: Set<number> | null = null;

  /** Ids that were not in the previous batch - they get the flash highlight. */
  private readonly fresh = computed(() => {
    const ids = this.items().map((i) => i.id);
    const before = this.previous;
    this.previous = new Set(ids);
    return before === null ? new Set<number>() : new Set(ids.filter((id) => !before.has(id)));
  });

  isFresh(id: number): boolean {
    return this.fresh().has(id);
  }

  pretty(type: string): string {
    return type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  icon(type: string): string {
    return ICONS[type] ?? 'bolt';
  }

  link(item: ActivityItem): string[] | null {
    const base = LINKS[item.entity_type];
    return base && item.entity_id ? [base, String(item.entity_id)] : null;
  }

  ago(iso: string | null): string {
    return timeAgo(iso, this.now());
  }
}
