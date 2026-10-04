import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface Breadcrumb {
  label: string;
  url?: string;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private sidebarCollapsedKey = 'vendoriq_sidebar_collapsed';
  private isCollapsedSubject: BehaviorSubject<boolean>;
  public isCollapsed$;

  private breadcrumbsSubject = new BehaviorSubject<Breadcrumb[]>([
    { label: 'Home', url: '/dashboard', icon: 'bi-house-door' }
  ]);
  public breadcrumbs$ = this.breadcrumbsSubject.asObservable();

  private globalSearchSubject = new BehaviorSubject<string>('');
  public globalSearch$ = this.globalSearchSubject.asObservable();

  private isSearchOpenSubject = new BehaviorSubject<boolean>(false);
  public isSearchOpen$ = this.isSearchOpenSubject.asObservable();

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    const savedState = localStorage.getItem(this.sidebarCollapsedKey);
    const initial = savedState === 'true';
    this.isCollapsedSubject = new BehaviorSubject<boolean>(initial);
    this.isCollapsed$ = this.isCollapsedSubject.asObservable();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateBreadcrumbs();
      });
  }

  toggleSidebar(): void {
    const nextState = !this.isCollapsedSubject.value;
    this.isCollapsedSubject.next(nextState);
    localStorage.setItem(this.sidebarCollapsedKey, String(nextState));
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.isCollapsedSubject.next(collapsed);
    localStorage.setItem(this.sidebarCollapsedKey, String(collapsed));
  }

  get isCollapsed(): boolean {
    return this.isCollapsedSubject.value;
  }

  setBreadcrumbs(breadcrumbs: Breadcrumb[]): void {
    this.breadcrumbsSubject.next(breadcrumbs);
  }

  setGlobalSearch(query: string): void {
    this.globalSearchSubject.next(query);
  }

  toggleSearchModal(open?: boolean): void {
    this.isSearchOpenSubject.next(open !== undefined ? open : !this.isSearchOpenSubject.value);
  }

  private updateBreadcrumbs(): void {
    const url = this.router.url.split('?')[0];
    const crumbs: Breadcrumb[] = [
      { label: 'Home', url: '/dashboard', icon: 'bi-house-door' }
    ];

    if (url.startsWith('/dashboard')) {
      if (url.includes('admin')) {
        crumbs.push({ label: 'Admin Dashboard' });
      } else if (url.includes('procurement')) {
        crumbs.push({ label: 'Procurement Dashboard' });
      } else if (url.includes('supply-chain')) {
        crumbs.push({ label: 'Supply Chain Dashboard' });
      } else if (url.includes('vendor')) {
        crumbs.push({ label: 'Vendor Portal' });
      } else if (url.includes('finance')) {
        crumbs.push({ label: 'Finance Dashboard' });
      } else if (url.includes('auditor')) {
        crumbs.push({ label: 'Auditor Dashboard' });
      } else {
        crumbs.push({ label: 'Dashboard' });
      }
    } else if (url.startsWith('/vendors')) {
      crumbs.push({ label: 'Vendors', url: '/vendors' });
      crumbs.push({ label: 'Directory' });
    } else if (url.startsWith('/vendor-details')) {
      crumbs.push({ label: 'Vendors', url: '/vendors' });
      crumbs.push({ label: 'Vendor Profile' });
    } else if (url.startsWith('/vendor-categories')) {
      crumbs.push({ label: 'Vendors', url: '/vendors' });
      crumbs.push({ label: 'Categories' });
    } else if (url.startsWith('/vendor-selection')) {
      crumbs.push({ label: 'Procurement', url: '/procurement' });
      crumbs.push({ label: 'Vendor Selection & Comparison' });
    } else if (url.startsWith('/add-vendors')) {
      crumbs.push({ label: 'Vendors', url: '/vendors' });
      crumbs.push({ label: 'Register Vendor' });
    } else if (url.startsWith('/procurement')) {
      crumbs.push({ label: 'Procurement', url: '/procurement' });
      crumbs.push({ label: 'Requirements & Invoices' });
    } else if (url.startsWith('/purchase-orders')) {
      crumbs.push({ label: 'Operations' });
      crumbs.push({ label: 'Purchase Orders & Deliveries' });
    } else if (url.startsWith('/contracts')) {
      crumbs.push({ label: 'Operations' });
      crumbs.push({ label: 'Contracts Repository' });
    } else if (url.startsWith('/vendor-reliability')) {
      crumbs.push({ label: 'Intelligence' });
      crumbs.push({ label: 'Vendor Reliability' });
    } else if (url.startsWith('/vendor-performance')) {
      crumbs.push({ label: 'Intelligence' });
      crumbs.push({ label: 'Risk & Performance' });
    } else if (url.startsWith('/analytics')) {
      crumbs.push({ label: 'Analytics' });
      crumbs.push({ label: 'Spend & Risk Analysis' });
    } else if (url.startsWith('/reports')) {
      crumbs.push({ label: 'Analytics' });
      crumbs.push({ label: 'Reports & Export' });
    } else if (url.startsWith('/communications')) {
      crumbs.push({ label: 'Governance' });
      crumbs.push({ label: 'Audit Logs & Comms' });
    } else if (url.startsWith('/notifications')) {
      crumbs.push({ label: 'Account' });
      crumbs.push({ label: 'Notifications' });
    } else if (url.startsWith('/profile')) {
      crumbs.push({ label: 'Account' });
      crumbs.push({ label: 'Profile & Settings' });
    }

    this.breadcrumbsSubject.next(crumbs);
  }
}
