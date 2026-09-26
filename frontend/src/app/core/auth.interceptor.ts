import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

/** Attaches the bearer token and surfaces API errors as toasts. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const token = auth.accessToken;

  const authorised = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorised).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !request.url.includes('/auth/login')) {
        toast.error('Your session has expired. Please sign in again.');
        auth.logout();
      } else if (error.status === 403) {
        toast.error(extractDetail(error) ?? 'You do not have permission to do that.');
      } else if (error.status === 0) {
        toast.error('Cannot reach the API. Is the backend running?');
      }

      return throwError(() => error);
    }),
  );
};

export function extractDetail(error: HttpErrorResponse): string | null {
  const detail = error.error?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  // FastAPI validation errors arrive as a list of {loc, msg} objects.
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: { loc?: string[]; msg?: string }) => {
        const field = item.loc?.[item.loc.length - 1];
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join('; ');
  }

  return null;
}
