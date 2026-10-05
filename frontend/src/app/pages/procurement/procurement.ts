
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';
import { Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import {
  FormsModule,
  NgForm
} from '@angular/forms';

import {
  ProcurementCreate,
  ProcurementRequest,
  ProcurementService,
  PROCUREMENT_PRIORITIES,
  PROCUREMENT_STATUSES
} from '../../core/services/procurement';

import {
  Vendor,
  VendorService
} from '../../core/services/vendor';

import {
  PurchaseOrder,
  PurchaseOrderService
} from '../../core/services/purchase-order';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseChartDirective
  ],
  templateUrl: './procurement.html',
  styleUrl: './procurement.scss'
})
export class Procurement implements OnInit {

  requests: ProcurementRequest[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  vendors: Vendor[] = [];

  priorities = [...PROCUREMENT_PRIORITIES];
  statuses = [...PROCUREMENT_STATUSES];

  loading = false;
  loadingPurchaseOrders = false;
  saving = false;

  showForm = false;
  editingId: number | null = null;

  successMessage = '';
  errorMessage = '';

  filterStatus = '';

  // Chart options
  readonly pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  readonly doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  readonly barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  // Procurement request status pie chart
  get requestStatusChartData(): ChartData<'pie', number[], string> {
    const labels = [...this.statuses];

    return {
      labels,
      datasets: [{
        data: labels.map(status =>
          this.requests.filter(request => request.status === status).length
        ),
        backgroundColor: [
          '#f59e0b',
          '#16a34a',
          '#ef4444',
          '#64748b',
          '#2563eb',
          '#0d9488',
          '#8b5cf6'
        ]
      }]
    };
  }

  // Requests by priority bar chart
  get priorityChartData(): ChartData<'bar', number[], string> {
    const labels = [...this.priorities];

    return {
      labels,
      datasets: [{
        label: 'Requests',
        data: labels.map(priority =>
          this.requests.filter(request => request.priority === priority).length
        ),
        backgroundColor: [
          '#94a3b8',
          '#3b82f6',
          '#f97316',
          '#ef4444'
        ],
        borderRadius: 6
      }]
    };
  }

  // Purchase order status doughnut chart
  get purchaseOrderStatusChartData(): ChartData<'doughnut', number[], string> {
    const labels = [
      'Pending',
      'Approved',
      'Ordered',
      'Delivered',
      'Completed',
      'Cancelled'
    ];

    return {
      labels,
      datasets: [{
        data: labels.map(status =>
          this.purchaseOrders.filter(order => order.status === status).length
        ),
        backgroundColor: [
          '#f59e0b',
          '#2563eb',
          '#8b5cf6',
          '#0d9488',
          '#16a34a',
          '#94a3b8'
        ]
      }]
    };
  }

  // Procurement value by category bar chart
  get categoryValueChartData(): ChartData<'bar', number[], string> {
    const totals = new Map<string, number>();

    for (const request of this.requests) {
      const category = request.category?.trim() || 'Uncategorized';

      totals.set(
        category,
        (totals.get(category) ?? 0) + Number(request.estimated_cost || 0)
      );
    }

    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);

    return {
      labels: entries.map(([category]) => category),
      datasets: [{
        label: 'Estimated value (₹)',
        data: entries.map(([, value]) => value),
        backgroundColor: '#0f766e',
        borderRadius: 6
      }]
    };
  }

  form: ProcurementCreate = {
    title: '',
    vendor_id: null,
    category: '',
    quantity: 1,
    estimated_cost: 0,
    priority: 'Normal'
  };

  constructor(
    private procurementService: ProcurementService,
    private vendorService: VendorService,
    private purchaseOrderService: PurchaseOrderService,
    public authService: AuthService
  ) {}

  get currentRole(): string {
    return this.authService.currentUser()?.role ?? '';
  }

  get isAdministrator(): boolean {
    return this.currentRole === 'Administrator';
  }

  get canCreateRequest(): boolean {
    return this.isAdministrator || this.currentRole === 'Procurement Manager';
  }

  canEditRequest(request: ProcurementRequest): boolean {
    return this.isAdministrator || (
      this.currentRole === 'Procurement Manager' && request.status === 'Pending'
    );
  }

  canDeleteRequest(): boolean {
    return this.isAdministrator;
  }

  getAllowedStatuses(request: ProcurementRequest): string[] {
    const role = this.currentRole;

    if (role === 'Administrator') {
      return this.statuses.filter(status => status !== request.status);
    }

    if (role === 'Procurement Manager') {
      const transitions: Record<string, string[]> = {
        Pending: ['Cancelled'],
        Approved: ['Ordered', 'Cancelled'],
        Ordered: ['Delivered']
      };

      return transitions[request.status] ?? [];
    }

    if (role === 'Supply Chain Manager') {
      const transitions: Record<string, string[]> = {
        Pending: ['Approved', 'Rejected'],
        Ordered: ['Delivered'],
        Delivered: ['Completed']
      };

      return transitions[request.status] ?? [];
    }

    return [];
  }

  canChangeStatus(request: ProcurementRequest): boolean {
    return this.getAllowedStatuses(request).length > 0;
  }

  ngOnInit(): void {
    this.loadVendors();
    this.loadRequests();
    this.loadPurchaseOrders();
  }

  loadVendors(): void {
    this.vendorService.getVendors().subscribe({
      next: (vendors) => {
        this.vendors = vendors;
      },

      error: () => {
        this.vendors = [];
      }
    });
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';

    this.procurementService
      .getRequests(this.filterStatus || undefined)
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          this.loading = false;
        },

        error: (error) => {
          this.loading = false;

          if (error.status === 401) {
            this.errorMessage =
              'Your session has expired. Please log in again.';
          } else if (error.status === 403) {
            this.errorMessage =
              'You do not have permission to view procurement requests.';
          } else {
            this.errorMessage =
              'Unable to load procurement requests.';
          }
        }
      });
  }

  loadPurchaseOrders(): void {
    this.loadingPurchaseOrders = true;

    this.purchaseOrderService
      .getOrders()
      .subscribe({
        next: (orders) => {
          this.purchaseOrders = orders;
          this.loadingPurchaseOrders = false;

          console.log(
            'PURCHASE ORDERS LOADED:',
            this.purchaseOrders.length
          );
        },

        error: (error) => {
          this.loadingPurchaseOrders = false;

          console.error(
            'FAILED TO LOAD PURCHASE ORDERS:',
            error
          );

          if (!this.errorMessage) {
            if (error.status === 401) {
              this.errorMessage =
                'Your session has expired. Please log in again.';
            } else if (error.status === 403) {
              this.errorMessage =
                'You do not have permission to view purchase orders.';
            }
          }

          this.purchaseOrders = [];
        }
      });
  }

  openCreateForm(): void {
    if (!this.canCreateRequest) {
      this.errorMessage = 'Your role cannot create procurement requests.';
      return;
    }

    this.editingId = null;

    this.form = {
      title: '',
      vendor_id: null,
      category: '',
      quantity: 1,
      estimated_cost: 0,
      priority: 'Normal'
    };

    this.successMessage = '';
    this.errorMessage = '';
    this.showForm = true;
  }

  openEditForm(request: ProcurementRequest): void {
    if (!this.canEditRequest(request)) {
      this.errorMessage = 'You cannot edit this procurement request in its current state.';
      return;
    }

    this.editingId = request.id;

    this.form = {
      title: request.title,
      vendor_id: request.vendor_id,
      category: request.category,
      quantity: request.quantity,
      estimated_cost: Number(request.estimated_cost),
      priority: request.priority
    };

    this.successMessage = '';
    this.errorMessage = '';
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }

    this.showForm = false;
    this.editingId = null;
  }

  saveRequest(formRef: NgForm): void {
    if (formRef.invalid || this.saving) {
      formRef.control.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.editingId === null) {
      this.procurementService
        .createRequest(this.form)
        .subscribe({
          next: (request) => {
            this.requests = [
              request,
              ...this.requests
            ];

            this.successMessage =
              'Procurement request created successfully.';

            this.showForm = false;
            this.saving = false;
          },

          error: (error) => {
            this.saving = false;

            this.handleApiError(
              error,
              'Unable to create procurement request.'
            );
          }
        });
    } else {
      this.procurementService
        .updateRequest(
          this.editingId,
          this.form
        )
        .subscribe({
          next: (request) => {
            this.requests = this.requests.map(
              existing =>
                existing.id === request.id
                  ? request
                  : existing
            );

            this.successMessage =
              'Procurement request updated successfully.';

            this.showForm = false;
            this.editingId = null;
            this.saving = false;
          },

          error: (error) => {
            this.saving = false;

            this.handleApiError(
              error,
              'Unable to update procurement request.'
            );
          }
        });
    }
  }

  changeStatus(
    request: ProcurementRequest,
    newStatus: string
  ): void {
    if (request.status === newStatus) {
      return;
    }

    if (!this.getAllowedStatuses(request).includes(newStatus)) {
      this.errorMessage = 'This status transition is not available for your role.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.procurementService
      .updateRequestStatus(
        request.id,
        newStatus
      )
      .subscribe({
        next: (updatedRequest) => {
          this.requests = this.requests.map(
            existing =>
              existing.id === updatedRequest.id
                ? updatedRequest
                : existing
          );

          this.successMessage =
            `Request #${request.id} status changed to ${newStatus}.`;
        },

        error: (error) => {
          this.handleApiError(
            error,
            'Unable to update request status.'
          );

          this.loadRequests();
        }
      });
  }

  deleteRequest(request: ProcurementRequest): void {
    if (!this.canDeleteRequest()) {
      this.errorMessage = 'Only an Administrator can delete procurement requests.';
      return;
    }

    const confirmed = window.confirm(
      `Delete procurement request "${request.title}"?`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.procurementService
      .deleteRequest(request.id)
      .subscribe({
        next: () => {
          this.requests = this.requests.filter(
            item => item.id !== request.id
          );

          this.successMessage =
            'Procurement request deleted successfully.';
        },

        error: (error) => {
          this.handleApiError(
            error,
            'Unable to delete procurement request.'
          );
        }
      });
  }

  onStatusFilterChange(): void {
    this.loadRequests();
  }

  get totalRequests(): number {
    return this.requests.length;
  }

  get pendingRequests(): number {
    return this.requests.filter(
      request => request.status === 'Pending'
    ).length;
  }

  get approvedRequests(): number {
    return this.requests.filter(
      request => request.status === 'Approved'
    ).length;
  }

  get rejectedRequests(): number {
    return this.requests.filter(
      request => request.status === 'Rejected'
    ).length;
  }

  get completedRequests(): number {
    return this.requests.filter(
      request => request.status === 'Completed'
    ).length;
  }

  get procurementValue(): number {
    return this.requests.reduce(
      (total, request) =>
        total + Number(request.estimated_cost || 0),
      0
    );
  }

  get completionRate(): number {
    if (this.requests.length === 0) {
      return 0;
    }

    return (
      this.completedRequests /
      this.requests.length
    ) * 100;
  }

  /*
   * PURCHASE ORDER SUMMARY
   * These values come from the purchase_orders table.
   */

  get activePOs(): number {
    return this.purchaseOrders.filter(
      order =>
        order.status === 'Approved' ||
        order.status === 'Ordered'
    ).length;
  }

  get pendingPOs(): number {
    return this.purchaseOrders.filter(
      order => order.status === 'Pending'
    ).length;
  }

  get inTransitPOs(): number {
    return this.purchaseOrders.filter(
      order => order.status === 'Ordered'
    ).length;
  }

  get overduePOs(): number {
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    return this.purchaseOrders.filter(order => {
      const deliveryDate =
        new Date(order.expected_delivery_date);

      deliveryDate.setHours(
        0,
        0,
        0,
        0
      );

      const completed =
        order.status === 'Delivered' ||
        order.status === 'Completed' ||
        order.status === 'Cancelled';

      return (
        deliveryDate < today &&
        !completed
      );
    }).length;
  }

  get poValue(): number {
    return this.purchaseOrders
      .filter(
        order =>
          order.status !== 'Cancelled'
      )
      .reduce(
        (total, order) =>
          total + Number(order.total_amount || 0),
        0
      );
  }

  get assignedVendorCount(): number {
    return new Set(
      this.purchaseOrders
        .filter(
          order => order.vendor_id !== null
        )
        .map(
          order => order.vendor_id
        )
    ).size;
  }

  /*
   * DELIVERY STATUS
   * Calculated from the actual Purchase Orders.
   */

  get totalDeliveries(): number {
    return this.purchaseOrders.filter(
      order =>
        order.status === 'Delivered' ||
        order.status === 'Completed'
    ).length;
  }

  get onTimeDeliveries(): number {
    return this.purchaseOrders.filter(
      order =>
        order.status === 'Delivered' ||
        order.status === 'Completed'
    ).length;
  }

  get delayedDeliveries(): number {
    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    return this.purchaseOrders.filter(order => {
      const deliveryDate =
        new Date(order.expected_delivery_date);

      deliveryDate.setHours(
        0,
        0,
        0,
        0
      );

      const incomplete =
        order.status !== 'Delivered' &&
        order.status !== 'Completed' &&
        order.status !== 'Cancelled';

      return (
        deliveryDate < today &&
        incomplete
      );
    }).length;
  }

  get pendingDeliveries(): number {
    return this.purchaseOrders.filter(
      order =>
        order.status === 'Approved' ||
        order.status === 'Ordered'
    ).length;
  }

  get deliveryRate(): number {
    const activeDeliveryOrders =
      this.purchaseOrders.filter(
        order =>
          order.status !== 'Cancelled'
      );

    if (activeDeliveryOrders.length === 0) {
      return 0;
    }

    return (
      this.totalDeliveries /
      activeDeliveryOrders.length
    ) * 100;
  }

  getVendorName(vendorId: number | null): string {
    if (vendorId === null) {
      return 'Not assigned';
    }

    const vendor = this.vendors.find(
      vendor => vendor.id === vendorId
    );

    return vendor
      ? vendor.name
      : `Vendor #${vendorId}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }
    ).format(value);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );
  }

  handleApiError(
    error: any,
    fallbackMessage: string
  ): void {
    if (error?.status === 401) {
      this.errorMessage =
        'Your session has expired. Please log in again.';
      return;
    }

    if (error?.status === 403) {
      this.errorMessage =
        'You do not have permission to perform this action.';
      return;
    }

    if (error?.status === 404) {
      this.errorMessage =
        'The requested procurement record was not found.';
      return;
    }

    if (error?.error?.detail) {
      this.errorMessage =
        error.error.detail;
      return;
    }

    this.errorMessage =
      fallbackMessage;
  }
}