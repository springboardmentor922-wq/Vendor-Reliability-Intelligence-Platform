import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  AnalyticsService,
  ReportService,
  saveBlob,
} from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  AnalyticsFilterOptions,
  GeneratedReport,
  ReportColumn,
  ReportDefinition,
} from '../../core/models-m3';
import { ToastService } from '../../core/toast.service';

/**
 * Reports & Export.
 *
 * Generate runs the query on the server and returns the dataset; the PDF and
 * Excel buttons re-run the same query and stream a file. Nothing is a
 * pre-built sample — changing a filter changes what comes out.
 */
@Component({
  selector: 'app-reports-dashboard',
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './reports-dashboard.html',
})
export class ReportsDashboard {
  private readonly reports = inject(ReportService);
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly catalogue = signal<ReportDefinition[]>([]);
  readonly options = signal<AnalyticsFilterOptions | null>(null);
  readonly report = signal<GeneratedReport | null>(null);

  readonly generating = signal(false);
  readonly exporting = signal<'pdf' | 'excel' | null>(null);

  readonly selectedKey = signal<string>('vendor-performance');

  // ---- filter state ------------------------------------------
  readonly vendorId = signal<number | null>(null);
  readonly category = signal<string | null>(null);
  readonly riskLevel = signal<string | null>(null);
  readonly status = signal<string | null>(null);
  readonly start = signal<string | null>(null);
  readonly end = signal<string | null>(null);

  readonly isVendorUser = computed(() => this.auth.hasRole('Vendor'));

  readonly selected = computed(() =>
    this.catalogue().find((r) => r.key === this.selectedKey()) ?? null,
  );

  /** Status options depend on which report is selected. */
  readonly statusOptions = computed(() => {
    const options = this.options();

    if (!options) return [];

    switch (this.selectedKey()) {
      case 'procurement':
        return options.request_statuses;
      case 'purchase-orders':
        return options.order_statuses;
      case 'contracts':
        return ['Draft', 'Active', 'Expiring', 'Expired', 'Terminated', 'Renewed'];
      default:
        return [];
    }
  });

  readonly summaryRows = computed(() =>
    Object.entries(this.report()?.summary ?? {}).map(([label, value]) => ({
      label,
      value,
    })),
  );

  constructor() {
    this.reports.catalogue().subscribe({
      next: (rows) => {
        this.catalogue.set(rows);

        if (rows.length && !rows.some((r) => r.key === this.selectedKey())) {
          this.selectedKey.set(rows[0].key);
        }

        this.generate();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not load the report catalogue.'),
    });

    this.analytics.filterOptions().subscribe({
      next: (options) => this.options.set(options),
      error: () => this.options.set(null),
    });

    const scoped = this.auth.user()?.vendor_id ?? null;

    if (scoped) {
      this.vendorId.set(scoped);
    }
  }

  private filters() {
    return {
      vendor_id: this.vendorId(),
      category: this.category(),
      risk_level: this.riskLevel(),
      status: this.status(),
      start: this.start(),
      end: this.end(),
    };
  }

  select(key: string): void {
    if (this.selectedKey() === key) {
      return;
    }

    this.selectedKey.set(key);

    // A status that only exists on the previous report would silently return
    // nothing, so it is cleared when the report changes.
    this.status.set(null);
    this.report.set(null);

    this.generate();
  }

  generate(): void {
    const key = this.selectedKey();

    if (!key) {
      return;
    }

    this.generating.set(true);

    this.reports.generate(key, { ...this.filters(), limit: 300 }).subscribe({
      next: (result) => {
        this.report.set(result);
        this.generating.set(false);
      },
      error: (error) => {
        this.generating.set(false);
        this.toast.fromError(error, 'Could not generate the report.');
      },
    });
  }

  download(format: 'pdf' | 'excel'): void {
    const key = this.selectedKey();

    if (!key) {
      return;
    }

    this.exporting.set(format);

    this.reports.download(key, format, this.filters()).subscribe({
      next: ({ blob, filename }) => {
        saveBlob(blob, filename);
        this.exporting.set(null);
        this.toast.success(`Downloaded ${filename}`);
      },
      error: (error) => {
        this.exporting.set(null);
        this.toast.fromError(error, `Could not export the ${format} file.`);
      },
    });
  }

  resetFilters(): void {
    if (!this.isVendorUser()) {
      this.vendorId.set(null);
    }

    this.category.set(null);
    this.riskLevel.set(null);
    this.status.set(null);
    this.start.set(null);
    this.end.set(null);

    this.generate();
  }

  /** Renders a cell according to its declared column type. */
  cell(row: Record<string, unknown>, column: ReportColumn): string {
    const value = row[column.key];

    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (
      column.type === 'money' ||
      column.type === 'percent' ||
      column.type === 'decimal'
    ) {
      const numeric = Number(value);

      if (Number.isNaN(numeric)) {
        return String(value);
      }

      const formatted = numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return column.type === 'percent' ? `${formatted}%` : formatted;
    }

    if (column.type === 'number') {
      const numeric = Number(value);

      return Number.isNaN(numeric) ? String(value) : numeric.toLocaleString();
    }

    return String(value);
  }

  isNumeric(column: ReportColumn): boolean {
    return column.type !== 'text';
  }
}
