import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Placeholder for the Milestone 3 screens. The routes and navigation exist so
 * the shell is complete; the analytics themselves land in the next milestone.
 */
@Component({
  selector: 'app-placeholder',
  imports: [MatIconModule],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ title() }}</h1>
          <p>{{ subtitle() }}</p>
        </div>
      </div>

      <div class="card empty-state">
        <mat-icon class="empty-icon">{{ icon() }}</mat-icon>
        <h3>Arriving in Milestone 3</h3>
        <p>{{ detail() }}</p>

        <ul class="planned-list">
          @for (item of planned(); track item) {
            <li>{{ item }}</li>
          }
        </ul>
      </div>
    </div>
  `,
  styles: `
    .planned-list {
      list-style: none;
      margin: 20px auto 0;
      padding: 0;
      max-width: 460px;
      text-align: left;

      li {
        position: relative;
        padding: 6px 0 6px 22px;
        font-size: 13.5px;
        color: var(--viq-ink-soft);

        &::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 13px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--viq-accent);
        }
      }
    }
  `,
})
export class Placeholder {
  readonly title = input('Coming soon');
  readonly subtitle = input('');
  readonly icon = input('insights');
  readonly detail = input('');
  readonly planned = input<string[]>([]);
}

@Component({
  selector: 'app-performance-placeholder',
  imports: [Placeholder],
  template: `
    <app-placeholder
      title="Vendor performance"
      subtitle="Delivery, quality, responsiveness and service ratings per vendor."
      icon="insights"
      detail="Performance records are already captured against delivered purchase
        orders. The monitoring screens are built in the next milestone."
      [planned]="[
        'Delivery performance monitoring (on-time vs delayed)',
        'Product quality evaluation and service ratings',
        'Communication response tracking',
        'Issue resolution time',
        'Performance history and vendor ranking',
      ]"
    />
  `,
})
export class PerformancePlaceholder {}

@Component({
  selector: 'app-analytics-placeholder',
  imports: [Placeholder],
  template: `
    <app-placeholder
      title="Analytics"
      subtitle="Reliability scoring, risk levels and procurement trend analysis."
      icon="monitoring"
      detail="The reliability scoring engine combines delivery history, quality,
        communication, contract compliance, purchase history and issue
        resolution into a single vendor score."
      [planned]="[
        'Vendor reliability score and supplier ranking',
        'Procurement risk level per vendor',
        'Performance trend analysis',
        'Procurement recommendations',
        'Procurement cost analysis',
      ]"
    />
  `,
})
export class AnalyticsPlaceholder {}

@Component({
  selector: 'app-reports-placeholder',
  imports: [Placeholder],
  template: `
    <app-placeholder
      title="Reports &amp; export"
      subtitle="Vendor, procurement, purchase order, compliance and contract reports."
      icon="summarize"
      detail="Report generation with PDF and Excel export is delivered in the
        next milestone. All underlying data is already available through the API."
      [planned]="[
        'Vendor performance reports',
        'Procurement and purchase order reports',
        'Compliance and contract reports',
        'PDF export',
        'Excel export',
      ]"
    />
  `,
})
export class ReportsPlaceholder {}
