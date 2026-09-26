import { Component, computed, input } from '@angular/core';

/** Colour-coded status chip used across every list and detail screen. */
@Component({
  selector: 'app-status-pill',
  template: `<span class="pill" [class]="toneClass()">{{ status() }}</span>`,
})
export class StatusPill {
  readonly status = input.required<string>();

  private static readonly TONES: Record<string, string> = {
    // Positive / terminal-good
    Approved: 'pill-success',
    Active: 'pill-success',
    Completed: 'pill-success',
    Delivered: 'pill-success',
    Compliant: 'pill-success',
    Paid: 'pill-success',
    Valid: 'pill-success',
    Resolved: 'pill-success',
    Low: 'pill-success',

    // Awaiting action
    Pending: 'pill-warn',
    Expiring: 'pill-warn',
    Draft: 'pill-warn',
    'Under Review': 'pill-warn',
    'Awaiting Vendor': 'pill-warn',
    'Awaiting Internal': 'pill-warn',
    Overdue: 'pill-warn',
    High: 'pill-warn',
    Medium: 'pill-warn',

    // Problem states
    Rejected: 'pill-danger',
    Suspended: 'pill-danger',
    Expired: 'pill-danger',
    Terminated: 'pill-danger',
    'Non-Compliant': 'pill-danger',
    Disputed: 'pill-danger',
    Urgent: 'pill-danger',
    Critical: 'pill-danger',
    Revoked: 'pill-danger',

    // In flight
    Ordered: 'pill-info',
    Open: 'pill-info',
    Renewed: 'pill-info',
    Partial: 'pill-info',
  };

  readonly toneClass = computed(
    () => StatusPill.TONES[this.status()] ?? 'pill-neutral',
  );
}
