import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { VendorService, VendorModel, VendorCategory } from '../../services/vendor.service';

@Component({
  selector: 'app-add-vendors',
  imports: [FormsModule, RouterLink, NgIf, NgFor],
  templateUrl: './add-vendors.html',
  styleUrl: './add-vendors.css'
})
export class AddVendors implements OnInit {
  vendor: VendorModel = {
    name: '',
    company: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    website: '',
    product: '',
    category: 'Raw Material Suppliers',
    status: 'Pending',
    deliveryRate: 85.0,
    risk_level: 'Low',
    business_reg_number: '',
    gst_tax_id: '',
    notes: ''
  };

  categories: { name: string }[] = [
    { name: 'Raw Material Suppliers' },
    { name: 'Equipment Vendors' },
    { name: 'IT Vendors' },
    { name: 'Service Providers' },
    { name: 'Logistics Partners' },
    { name: 'Maintenance Vendors' }
  ];
  isLoading = false;
  errorMessage = '';

  constructor(
    private vendorService: VendorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.vendorService.getCategories().subscribe({
      next: (cats) => this.categories = cats,
      error: () => {}
    });
  }

  saveVendor(): void {
    this.errorMessage = '';

    if (!this.vendor.name?.trim() || !this.vendor.company?.trim() || !this.vendor.email?.trim() || !this.vendor.phone?.trim() || !this.vendor.product?.trim()) {
      this.errorMessage = 'Please complete all required fields (*).';
      return;
    }

    this.isLoading = true;
    this.vendorService.addVendor(this.vendor).subscribe({
      next: (res) => {
        this.isLoading = false;
        alert(`Vendor registered successfully! Login credentials registered for ${this.vendor.email}.`);
        this.router.navigate(['/vendor-details', res.id]);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.detail || 'Failed to submit vendor registration.';
      }
    });
  }
}
