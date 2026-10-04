import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data?.['roles'] as string[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const isStrict = !!route.data?.['strictRole'];
  const hasPermission = isStrict
    ? authService.hasStrictRole(allowedRoles)
    : authService.hasRole(allowedRoles);

  if (hasPermission) {
    return true;
  }

  // Gracefully redirect to the user's designated dashboard route with query param so dashboard can show an alert banner
  const userRole = authService.currentUserValue?.role;
  const targetDashboard = authService.getDashboardRoute(userRole);
  router.navigate([targetDashboard], { queryParams: { accessDenied: 'true', resource: route.routeConfig?.path } });
  return false;
};
