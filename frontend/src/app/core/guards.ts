import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { UserRole } from './models';
import { ToastService } from './toast.service';

/** Blocks a route until the visitor is signed in. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};

/** Keeps signed-in users away from the login / register screens. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/** Restricts a route to the roles listed on its `data.roles`. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const allowed = (route.data?.['roles'] ?? []) as UserRole[];

  if (allowed.length === 0 || auth.hasRole(...allowed)) {
    return true;
  }

  toast.error('You do not have permission to open that screen.');

  return router.createUrlTree(['/dashboard']);
};
