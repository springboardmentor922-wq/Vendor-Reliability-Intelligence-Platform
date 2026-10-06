import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PurchaseOrderService } from '../../core/services/purchase-order.service';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';

import {
  PurchaseOrder,
  POStatus,
  Vendor,
} from '../../core/models/models';

@Component({
  selector: 'app-vendor-order-history',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './vendor-order-history.component.html',
})
export class VendorOrderHistoryComponent
  implements OnInit {

  orders: PurchaseOrder[] = [];

  vendor: Vendor | null = null;

  loading = true;
  error = '';

  constructor(
    private purchaseOrderService: PurchaseOrderService,
    private vendorService: VendorService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadOrderHistory();
  }

  loadOrderHistory(): void {

    this.loading = true;
    this.error = '';

    const currentUser =
      this.auth.currentUser();

    if (!currentUser) {
      this.error =
        'Unable to identify the logged-in user.';
      this.loading = false;
      return;
    }

    /*
     * Find the Vendor record linked
     * to the logged-in user.
     */
    this.vendorService
      .list({})
      .subscribe({

        next: (vendors) => {

          const currentVendor =
            vendors.find(
              vendor =>
                vendor.user_id === currentUser.id
            );

          if (!currentVendor) {

            this.error =
              'Vendor profile is not linked to this account.';

            this.loading = false;
            return;
          }

          this.vendor =
            currentVendor;

          /*
           * Load only this vendor's
           * purchase orders.
           */
          this.purchaseOrderService
            .list({
              vendor_id: currentVendor.id,
            })
            .subscribe({

              next: (orders) => {

                this.orders =
                  orders || [];

                this.loading = false;

              },

              error: (error) => {

                console.error(
                  'Vendor order history error:',
                  error
                );

                this.error =
                  'Failed to load your order history.';

                this.loading = false;

              },

            });

        },

        error: (error) => {

          console.error(
            'Vendor lookup error:',
            error
          );

          this.error =
            'Failed to identify your vendor profile.';

          this.loading = false;

        },

      });
  }


  get totalOrders(): number {
    return this.orders.length;
  }


  get pendingOrders(): number {
    return this.orders.filter(
      order =>
        this.normalizeStatus(order.status) ===
        'pending'
    ).length;
  }


  get orderedOrders(): number {
    return this.orders.filter(
      order =>
        this.normalizeStatus(order.status) ===
        'ordered'
    ).length;
  }


  get deliveredOrders(): number {
    return this.orders.filter(
      order => {

        const status =
          this.normalizeStatus(order.status);

        return (
          status === 'delivered' ||
          status === 'completed'
        );

      }
    ).length;
  }


  get cancelledOrders(): number {
    return this.orders.filter(
      order =>
        this.normalizeStatus(order.status) ===
        'cancelled'
    ).length;
  }


  get totalOrderValue(): number {
    return this.orders.reduce(
      (total, order) =>
        total +
        Number(order.total_amount || 0),
      0
    );
  }


  normalizeStatus(
    status: POStatus | string
  ): string {

    return String(status || '')
      .toLowerCase()
      .replace(/_/g, '-');
  }


  statusClass(
    status: POStatus | string
  ): string {

    switch (
      this.normalizeStatus(status)
    ) {

      case 'pending':
        return 'bg-warning text-dark';

      case 'approved':
      case 'ordered':
      case 'in-transit':
        return 'bg-primary';

      case 'delivered':
      case 'completed':
        return 'bg-success';

      case 'cancelled':
      case 'rejected':
        return 'bg-danger';

      default:
        return 'bg-secondary';

    }
  }


  statusLabel(
    status: POStatus | string
  ): string {

    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(
        /\b\w/g,
        char => char.toUpperCase()
      );
  }


  trackDelivery(
    order: PurchaseOrder
  ): string {

    if (order.actual_delivery_date) {
      return 'Delivered';
    }

    if (order.expected_delivery_date) {
      return 'Expected ' +
        new Date(
          order.expected_delivery_date
        ).toLocaleDateString();
    }

    return 'Not scheduled';
  }
}
