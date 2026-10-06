import {Injectable,inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {tap} from 'rxjs/operators';
import {Observable} from 'rxjs';
@Injectable({providedIn:'root'})
export class AuthService{
  private http=inject(HttpClient); private router=inject(Router);
  api='http://localhost:8000/api/v1';
  login(email:string,password:string):Observable<any>{return this.http.post<any>(`${this.api}/auth/login`,{email,password}).pipe(tap(x=>{localStorage.setItem('token',x.access_token);localStorage.setItem('role',x.role);localStorage.setItem('name',x.full_name)}))}
  logout(){localStorage.clear();this.router.navigate(['/login'])}
  token(){return localStorage.getItem('token')}
  role(){return localStorage.getItem('role')}
  logged(){return !!this.token()}
}
