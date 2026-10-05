import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface LiveActivity {
  id: number;
  user_name: string;
  entity_type: string;
  entity_id: number | null;
  action: string;
  description: string | null;
  created_at: string | null;
}

export interface LivePulse {
  server_time: string;
  version: string;
  unread_notifications: number;
  latest_notification: {
    id: number;
    title: string;
    message: string;
    type: string;
    priority: string;
    link: string | null;
    created_at: string | null;
  } | null;
  activity: LiveActivity[];
}

const POLL_MS = 5000;

/**
 * Live monitoring heartbeat.
 *
 * Polls `/dashboards/live` every few seconds. The response carries a
 * fingerprint of the data behind every dashboard; when it changes, `version`
 * changes and any screen watching it re-fetches. New notifications pop up as
 * a toast. Polling pauses while the tab is hidden.
 */
@Injectable({ providedIn: 'root' })
export class LiveService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly enabled = signal(true);
  readonly connected = signal(false);
  readonly version = signal<string | null>(null);
  readonly lastBeat = signal<Date | null>(null);
  readonly lastChange = signal<Date | null>(null);
  readonly unread = signal(0);
  readonly activity = signal<LiveActivity[]>([]);
  readonly now = signal(Date.now());

  readonly secondsSinceBeat = computed(() => {
    const beat = this.lastBeat();
    return beat ? Math.max(0, Math.round((this.now() - beat.getTime()) / 1000)) : null;
  });

  private timer: ReturnType<typeof setInterval> | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private lastNotificationId: number | null = null;
  private inFlight = false;

  start(): void {
    if (this.timer) return;
    this.beat();
    this.timer = setInterval(() => this.beat(), POLL_MS);
    this.clock = setInterval(() => this.now.set(Date.now()), 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.clock) clearInterval(this.clock);
    this.timer = null;
    this.clock = null;
    this.connected.set(false);
    this.version.set(null);
    this.lastNotificationId = null;
  }

  toggle(): void {
    this.enabled.update((on) => !on);
    if (this.enabled()) this.beat();
  }

  /** Force an immediate check - used right after the user changes data. */
  poke(): void {
    this.beat(true);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private beat(force = false): void {
    if (!this.auth.isAuthenticated() || this.inFlight) return;
    if (!force && (!this.enabled() || document.visibilityState === 'hidden')) return;

    this.inFlight = true;

    this.http.get<LivePulse>(`${environment.apiUrl}/dashboards/live`).subscribe({
      next: (pulse) => {
        this.inFlight = false;
        this.connected.set(true);
        this.lastBeat.set(new Date());
        this.unread.set(pulse.unread_notifications);
        this.activity.set(pulse.activity);

        if (this.version() !== pulse.version) {
          if (this.version() !== null) this.lastChange.set(new Date());
          this.version.set(pulse.version);
        }

        const latest = pulse.latest_notification;
        if (latest) {
          if (this.lastNotificationId !== null && latest.id > this.lastNotificationId) {
            const ref = this.snack.open(`🔔 ${latest.title}`, latest.link ? 'Open' : 'Dismiss', {
              duration: 6000,
              panelClass: ['toast-live'],
              horizontalPosition: 'right',
              verticalPosition: 'top',
            });
            if (latest.link) {
              ref.onAction().subscribe(() => void this.router.navigateByUrl(latest.link!));
            }
          }
          this.lastNotificationId = latest.id;
        }
      },
      error: () => {
        this.inFlight = false;
        this.connected.set(false);
      },
    });
  }
}
