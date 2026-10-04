import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, PendingUser, SystemStatistics } from '../../../services/admin.service';
import { UserService } from '../../../services/user.service';
import { VendorService, VendorModel } from '../../../services/vendor.service';
import { AuthService, User, VENDOR_CATEGORIES } from '../../../services/auth.service';
import { CommunicationService, AuditLog } from '../../../services/communication.service';
import { Router } from '@angular/router';

import { AppChartComponent } from '../../../components/charts/app-chart.component';
import { RiskDistributionChartComponent } from '../../../components/charts/risk-distribution-chart.component';
import { ProcurementOverviewChartComponent } from '../../../components/charts/procurement-overview-chart.component';
import { DashboardService } from '../../../services/dashboard.service';
import { CHART_COLORS, STATUS_COLORS } from '../../../components/charts/chart-theme';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    NgClass,
    DatePipe,
    AppChartComponent,
    RiskDistributionChartComponent,
    ProcurementOverviewChartComponent
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit, OnDestroy {
  currentUser: User | null = null;
  pendingUsers: PendingUser[] = [];
  users: User[] = [];
  filteredUsers: User[] = [];
  pendingVendors: VendorModel[] = [];
  recentAuditLogs: AuditLog[] = [];
  systemStats: SystemStatistics | null = null;
  adminSummary: any = null;
  isLoadingSummary = true;
  isApproving = false;
  lastApprovedVendorName = '';
  private pollingTimer: any = null;

  // Chart datasets & options
  userManagementChartData: any = null;
  userManagementChartOptions: any = null;
  complianceMonitoringChartData: any = null;
  complianceMonitoringChartOptions: any = null;
  registrationVerificationChartData: any = null;
  registrationVerificationChartOptions: any = null;

  userSearchQuery = '';
  userRoleFilter = 'All';
  isLoading = true;
  actionMessage = '';

  // Modals
  selectedUserForApproval: PendingUser | null = null;
  showApprovalModal = false;
  assignedRole = 'Procurement Manager';
  assignedVendorCategory = 'Raw Material Suppliers';
  approvalNotes = 'Verified organizational identity and authorized access.';

  selectedUserForRejection: PendingUser | null = null;
  showRejectionModal = false;
  rejectionReason = 'Incomplete credentials or unauthorized affiliation.';

  availableRoles = [
    'Administrator',
    'Procurement Manager',
    'Supply Chain Manager',
    'Vendor',
    'Finance Officer',
    'Auditor'
  ];

  vendorCategories = VENDOR_CATEGORIES;

  constructor(
    private adminService: AdminService,
    private userService: UserService,
    private vendorService: VendorService,
    private authService: AuthService,
    private commsService: CommunicationService,
    private dashService: DashboardService,
    private router: Router
  ) {}

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('section-highlight');
      setTimeout(() => el.classList.remove('section-highlight'), 2500);
    }
  }

  navigateTo(path: string): void {
    this.router.navigateByUrl(path);
  }

  private lastUserId: number | null = null;
  private lastUserRole: string | null = null;

  ngOnInit(): void {
    const initUser = this.authService.currentUserValue;
    if (initUser) {
      this.lastUserId = initUser.id;
      this.lastUserRole = initUser.role;
    }
    this.currentUser = initUser;
    this.isLoadingSummary = false;
    this.buildAdminCharts({}); // Render charts instantly on frame 1
    this.loadData();

    // Re-load immediately if auth state or user changes without requiring browser refresh
    this.authService.currentUser$.subscribe((u) => {
      if (u && (u.id !== this.lastUserId || u.role !== this.lastUserRole)) {
        this.lastUserId = u.id;
        this.lastUserRole = u.role;
        this.currentUser = u;
        this.loadData();
      }
    });

    // Auto-poll pending user registrations every 8 seconds so new registrations appear instantly
    this.pollingTimer = setInterval(() => {
      this.pollPendingRegistrations();
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  pollPendingRegistrations(): void {
    if (this.isApproving) return;
    this.adminService.getPendingRegistrations().subscribe({
      next: (data) => {
        if (!this.isApproving) {
          this.pendingUsers = data || [];
        }
      },
      error: () => {}
    });
  }

  refreshDataSilent(): void {
    this.adminService.getPendingRegistrations().subscribe({
      next: (data) => this.pendingUsers = data || [],
      error: () => {}
    });
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users || [];
        this.applyUserFilter();
      },
      error: () => {}
    });
    this.adminService.getSystemStatistics().subscribe({
      next: (stats) => this.systemStats = stats,
      error: () => {}
    });
    this.vendorService.getVendors({ status: 'Pending' }, true).subscribe({
      next: (vendors) => this.pendingVendors = vendors || [],
      error: () => {}
    });
    this.commsService.getAuditLogs(15).subscribe({
      next: (logs) => this.recentAuditLogs = logs || [],
      error: () => {}
    });
    this.dashService.getAdminSummary(true).subscribe({
      next: (summary) => {
        this.adminSummary = summary;
        this.buildAdminCharts(summary);
      },
      error: () => {}
    });
  }

  loadData(): void {
    this.isLoading = true;

    // 1. Pending Registrations
    this.adminService.getPendingRegistrations().subscribe({
      next: (data) => this.pendingUsers = data || [],
      error: () => this.pendingUsers = []
    });

    // 2. System Statistics
    this.adminService.getSystemStatistics().subscribe({
      next: (stats) => this.systemStats = stats,
      error: () => {}
    });

    // 3. System Users
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users || [];
        this.applyUserFilter();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    // 4. Pending Vendors
    this.vendorService.getVendors({ status: 'Pending' }, true).subscribe({
      next: (vendors) => this.pendingVendors = vendors || [],
      error: () => this.pendingVendors = []
    });

    // 5. Audit Logs
    this.commsService.getAuditLogs(15).subscribe({
      next: (logs) => this.recentAuditLogs = logs || [],
      error: () => this.recentAuditLogs = []
    });

    // 6. Admin Analytics Summary (force fresh retrieval)
    this.loadAdminAnalytics();
  }

  loadAdminAnalytics(): void {
    this.isLoadingSummary = true;
    this.dashService.getAdminSummary(true).subscribe({
      next: (summary) => {
        this.adminSummary = summary;
        this.isLoadingSummary = false;
        this.buildAdminCharts(summary);
      },
      error: (err) => {
        console.error('Failed to load admin summary', err);
        this.isLoadingSummary = false;
      }
    });
  }

  buildAdminCharts(summary: any): void {
    if (!summary) summary = {};

    // A. User Management (Donut)
    const roleLabels = summary.user_management?.labels || ['Administrator', 'Procurement Manager', 'Finance Officer', 'Supply Chain Manager', 'Vendor', 'Auditor'];
    const roleCounts = summary.user_management?.counts || [4, 6, 4, 3, 25, 2];
    const roleColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

    this.userManagementChartData = {
      labels: roleLabels,
      datasets: [
        {
          data: roleCounts,
          backgroundColor: roleColors.slice(0, roleLabels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.userManagementChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // D. Compliance Monitoring (Donut)
    const compLabels = summary.compliance_monitoring?.labels || ['Compliant', 'Minor Issues', 'Major Issues', 'Non-Compliant'];
    const compCounts = summary.compliance_monitoring?.counts || [18, 5, 2, 0];
    this.complianceMonitoringChartData = {
      labels: compLabels,
      datasets: [
        {
          data: compCounts,
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.delayed, CHART_COLORS.danger],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.complianceMonitoringChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // F. Registration Verification (Bar)
    const regLabels = summary.registration_verification?.labels || ['Approved', 'Pending', 'Rejected'];
    const regCounts = summary.registration_verification?.counts || [19, 0, 0];
    this.registrationVerificationChartData = {
      labels: regLabels,
      datasets: [
        {
          label: 'Registrations',
          data: regCounts,
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger],
          borderRadius: 4
        }
      ]
    };
    this.registrationVerificationChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine },
          ticks: { stepSize: 2 }
        }
      }
    };
  }

  applyUserFilter(): void {
    this.filteredUsers = this.users.filter(u => {
      const matchesRole = this.userRoleFilter === 'All' || u.role === this.userRoleFilter;
      const q = this.userSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }

  openApproveModal(u: PendingUser): void {
    this.selectedUserForApproval = u;
    this.assignedRole = u.role || 'Procurement Manager';
    this.assignedVendorCategory = u.vendor_category || 'Raw Material Suppliers';
    this.approvalNotes = 'Verified organizational identity and authorized access.';
    this.showApprovalModal = true;
  }

  closeApproveModal(): void {
    this.showApprovalModal = false;
    this.selectedUserForApproval = null;
  }

  confirmApproveUser(): void {
    if (!this.selectedUserForApproval || this.isApproving) return;
    const userToApprove = this.selectedUserForApproval;
    const userId = userToApprove.id;
    const userName = userToApprove.full_name;
    const userEmail = userToApprove.email;
    const categoryToPass = this.assignedRole === 'Vendor' ? this.assignedVendorCategory : undefined;

    this.isApproving = true;
    this.lastApprovedVendorName = userName;

    // 1. Immediately show approved message on top
    this.actionMessage = `Vendor "${userName}" (${userEmail}) has been approved and activated! Initial reliability score is set to 0.0%.`;

    // 2. Immediately remove from pending list so UI responds instantly
    this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);

    // 3. Close modal immediately and scroll smoothly to top
    this.closeApproveModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 4. Execute backend approval
    this.adminService.approveUser(userId, this.assignedRole, this.approvalNotes, categoryToPass).subscribe({
      next: (res) => {
        this.isApproving = false;
        if (res?.message) {
          this.actionMessage = res.message;
        }
        // Refresh directory & stats quietly in background without jarring page loader
        this.refreshDataSilent();
      },
      error: (err) => {
        this.isApproving = false;
        this.actionMessage = '';
        this.lastApprovedVendorName = '';
        this.loadData();
        alert(err.error?.detail || 'Failed to approve user.');
      }
    });
  }

  openRejectModal(u: PendingUser): void {
    this.selectedUserForRejection = u;
    this.rejectionReason = 'Incomplete credentials or unauthorized affiliation.';
    this.showRejectionModal = true;
  }

  closeRejectModal(): void {
    this.showRejectionModal = false;
    this.selectedUserForRejection = null;
  }

  confirmRejectUser(): void {
    if (!this.selectedUserForRejection || !this.rejectionReason.trim()) return;
    const userToReject = this.selectedUserForRejection;
    const userId = userToReject.id;
    const userName = userToReject.full_name;

    this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
    this.closeRejectModal();
    this.actionMessage = `Registration for "${userName}" has been rejected.`;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.adminService.rejectUser(userId, this.rejectionReason).subscribe({
      next: (res) => {
        if (res?.message) {
          this.actionMessage = res.message;
        }
        this.refreshDataSilent();
      },
      error: (err) => {
        this.loadData();
        alert(err.error?.detail || 'Failed to reject registration.');
      }
    });
  }

  toggleActive(user: User): void {
    const newStatus = !user.is_active;
    this.adminService.toggleUserStatus(user.id, newStatus).subscribe({
      next: () => {
        user.is_active = newStatus;
        this.actionMessage = `Status for ${user.full_name} updated to ${newStatus ? 'Active' : 'Inactive'}.`;
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to toggle status.');
      }
    });
  }
}
