import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { extractDetail } from './auth.interceptor';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      panelClass: ['toast-success'],
    });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 6000,
      panelClass: ['toast-error'],
    });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 4000 });
  }

  /** Shows the API's `detail` message when present, otherwise a fallback. */
  fromError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse) {
      // 401/403/network failures are already reported by the interceptor.
      if (error.status === 401 || error.status === 403 || error.status === 0) {
        return;
      }

      this.error(extractDetail(error) ?? fallback);
      return;
    }

    this.error(fallback);
  }
}
