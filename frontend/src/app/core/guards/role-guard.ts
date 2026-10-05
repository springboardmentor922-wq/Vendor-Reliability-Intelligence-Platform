import { inject } from '@angular/core';

import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router
} from '@angular/router';

import { catchError, map, of, take } from 'rxjs';

import { AuthService } from '../services/auth';


export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {

  const authService = inject(AuthService);
  const router = inject(Router);

  /*
   * User must have a valid login token.
   */
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }


  /*
   * Get the roles allowed for this route.
   */
  const allowedRoles =
    route.data['roles'] as string[] | undefined;


  /*
   * If the route has no role restriction,
   * allow any authenticated user.
   */
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }


  /*
   * If the current user is already loaded,
   * check the role immediately.
   */
  const currentUser = authService.currentUser();

  if (currentUser) {

    if (allowedRoles.includes(currentUser.role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  }


  /*
   * The user is logged in, but /users/me has not
   * finished loading yet.
   *
   * Load the real user from the backend before
   * deciding whether the route is allowed.
   */
  return authService.loadCurrentUser().pipe(

    take(1),

    map(user => {

      /*
       * Check the actual role returned by FastAPI.
       */
      if (allowedRoles.includes(user.role)) {
        return true;
      }

      /*
       * Logged in, but role is not allowed.
       */
      return router.createUrlTree(['/dashboard']);
    }),

    catchError(error => {

      console.error(
        'ROLE GUARD USER LOAD ERROR:',
        error
      );

      /*
       * Invalid/expired authentication token.
       */
      if (error?.status === 401) {

        authService.logout();

        return of(
          router.createUrlTree(['/login'])
        );
      }

      /*
       * Other user-loading errors.
       */
      return of(
        router.createUrlTree(['/dashboard'])
      );
    })
  );
};