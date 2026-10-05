import { DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { extractDetail } from '../../core/auth.interceptor';
import { DataImportService, ImportHistoryRow, ImportReport, ImportSheet } from '../../core/dashboards.service';
import { LiveService } from '../../core/live.service';
import { ToastService } from '../../core/toast.service';
import { bytes } from '../../shared/viz/format';

type Stage = 'idle' | 'reading' | 'preview' | 'importing' | 'done';

const ENTITY_ICONS: Record<string, string> = {
  vendors: 'storefront',
  certifications: 'workspace_premium',
  procurement_requests: 'assignment',
  purchase_orders: 'receipt_long',
  invoices: 'payments',
  contracts: 'gavel',
  performance: 'speed',
};

/**
 * Spreadsheet import. Upload -> server-side dry run (every row validated
 * inside a rolled-back transaction) -> review -> import. After import the
 * backend rescores vendors and runs the alert sweep; the live service is
 * poked so every open dashboard refreshes straight away.
 */
@Component({
  selector: 'app-data-import',
  imports: [DatePipe, DecimalPipe, KeyValuePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, RouterLink],
  templateUrl: './data-import.html',
  styleUrl: './data-import.scss',
})
export class DataImport {
  private readonly api = inject(DataImportService);
  private readonly toast = inject(ToastService);
  private readonly live = inject(LiveService);

  readonly stage = signal<Stage>('idle');
  readonly file = signal<File | null>(null);
  readonly report = signal<ImportReport | null>(null);
  readonly result = signal<ImportReport | null>(null);
  readonly history = signal<ImportHistoryRow[]>([]);
  readonly dragging = signal(false);
  readonly error = signal<string | null>(null);
  readonly openSheet = signal<string | null>(null);
  readonly datacoOrders = signal(6000);
  readonly bytes = bytes;

  readonly steps = [
    { key: 'upload', label: 'Upload', icon: 'upload_file' },
    { key: 'validate', label: 'Validate', icon: 'rule' },
    { key: 'import', label: 'Import', icon: 'storage' },
    { key: 'refresh', label: 'Rescore & refresh', icon: 'insights' },
  ];

  readonly stepIndex = computed(() => {
    switch (this.stage()) {
      case 'idle':
        return 0;
      case 'reading':
        return 1;
      case 'preview':
        return 1;
      case 'importing':
        return 2;
      default:
        return 4;
    }
  });

  readonly importable = computed(() => {
    const r = this.report();
    if (!r) return false;
    return r.mode === 'dataco' || r.totals.created + r.totals.updated > 0;
  });

  constructor() {
    this.loadHistory();
  }

  icon(entity: string): string {
    return ENTITY_ICONS[entity] ?? 'table_chart';
  }

  loadHistory(): void {
    this.api.history().subscribe({ next: (h) => this.history.set(h), error: () => undefined });
  }

  downloadTemplate(): void {
    this.api.template().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'VendorIQ_Import_Template.xlsx';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: (e) => this.toast.fromError(e, 'Could not download the template.'),
    });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.choose(file);
  }

  onPick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.choose(file);
  }

  choose(file: File): void {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      this.toast.error('Upload an Excel workbook (.xlsx) or a CSV file.');
      return;
    }
    this.file.set(file);
    this.report.set(null);
    this.result.set(null);
    this.error.set(null);
    this.stage.set('reading');

    this.api.preview(file).subscribe({
      next: (report) => {
        this.report.set(report);
        this.stage.set('preview');
        if (report.dataco?.orders) this.datacoOrders.set(Math.min(6000, report.dataco.orders));
        this.openSheet.set(report.sheets[0]?.sheet ?? null);
      },
      error: (e) => {
        this.stage.set('idle');
        this.error.set(extractDetail(e) ?? 'The file could not be read.');
      },
    });
  }

  commit(): void {
    const r = this.report();
    if (!r?.token) return;
    this.stage.set('importing');

    this.api
      .commit(r.token, r.mode === 'dataco' ? { dataco_orders: this.datacoOrders() } : {})
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.stage.set('done');
          this.live.poke();
          this.loadHistory();
          this.toast.success(`Imported ${result.totals.created} new and ${result.totals.updated} updated records.`);
        },
        error: (e) => {
          this.stage.set('preview');
          this.error.set(extractDetail(e) ?? 'The import failed. No changes were saved.');
        },
      });
  }

  reset(): void {
    this.stage.set('idle');
    this.file.set(null);
    this.report.set(null);
    this.result.set(null);
    this.error.set(null);
  }

  sheetErrors(sheet: ImportSheet): { row: number; message: string }[] {
    return (this.report()?.errors ?? []).filter((e) => e.sheet === sheet.sheet);
  }

  sampleColumns(sheet: ImportSheet): string[] {
    return Object.keys(sheet.mapped_columns).slice(0, 8);
  }

  cell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    const text = String(value);
    return text.length > 28 ? text.slice(0, 27) + '…' : text;
  }

  postValue(key: string): unknown {
    return (this.result()?.post_processing as Record<string, unknown> | undefined)?.[key];
  }
}
