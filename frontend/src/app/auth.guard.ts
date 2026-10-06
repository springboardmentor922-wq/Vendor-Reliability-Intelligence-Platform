import {CanActivateFn,Router} from '@angular/router';
import {inject} from '@angular/core';
import {AuthService} from './auth.service';
export const authGuard:CanActivateFn=()=>{const a=inject(AuthService),r=inject(Router);return a.logged()?true:r.createUrlTree(['/login'])};
