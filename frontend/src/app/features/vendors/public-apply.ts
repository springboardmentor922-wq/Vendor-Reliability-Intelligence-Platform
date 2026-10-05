import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ThemeService } from '../../core/theme.service';
import { VendorApplication } from './vendor-application';

/** Stand-alone page for suppliers applying without an account. */
@Component({
  selector: 'app-public-apply',
  imports: [MatIconModule, RouterLink, VendorApplication],
  template: `
    <div class="public">
      <header class="pub-bar">
        <a class="pub-brand" routerLink="/login"><span class="mark">V</span><span>Vendor<strong>IQ</strong></span></a>
        <span class="spacer"></span>
        <button type="button" class="pub-icon" (click)="theme.toggle()" aria-label="Toggle theme">
          <mat-icon>{{ theme.mode() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <a class="pub-link" routerLink="/login"><mat-icon>login</mat-icon>Sign in</a>
      </header>
      <app-vendor-application mode="public" />
    </div>
  `,
  styles: [
    `
      .public {
        min-height: 100vh;
        background:
          radial-gradient(900px 500px at 0% -10%, rgba(99, 102, 241, 0.18), transparent 70%),
          radial-gradient(700px 500px at 110% 10%, rgba(34, 211, 238, 0.12), transparent 70%),
          var(--viq-ground);
      }
      .pub-bar {
        position: sticky; top: 0; z-index: 5;
        display: flex; align-items: center; gap: 10px;
        height: 64px; padding: 0 24px;
        background: var(--viq-glass); backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--viq-line);
      }
      .pub-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--viq-ink); font: 700 19px 'Plus Jakarta Sans', sans-serif; }
      .pub-brand strong { background: linear-gradient(90deg, #818cf8, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .mark { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #6366f1, #22d3ee); }
      .spacer { flex: 1; }
      .pub-icon { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; border: 1px solid var(--viq-line); background: var(--viq-surface); color: var(--viq-ink-soft); cursor: pointer; }
      .pub-link { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 11px; border: 1px solid var(--viq-line); background: var(--viq-surface); color: var(--viq-ink); text-decoration: none; font: 600 13px 'Inter', sans-serif; }
    `,
  ],
})
export class PublicApply {
  readonly theme = inject(ThemeService);
}
