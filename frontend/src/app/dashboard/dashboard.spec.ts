import { ComponentFixture, TestBed } from '@angular/core';
import { DashboardComponent } from './dashboard';
import { VendorService } from '../vendor.service';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { PurchaseOrder, Vendor, UserRole, ProcurementRequest, Contract, PerformanceMetric, VendorReport, CommunicationLog, MicroserviceStatus } from '../vendor.model';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockVendorService: jasmine.SpyObj<VendorService> | any;

  const mockUser = { name: 'Alex Bennett', email: 'alex@company.com', role: 'Admin' as UserRole, jwtToken: 'mock-jwt-token' };
  
  const mockVendors: Vendor[] = [
    {
      id: 1,
      vendor_code: 'VND-1001',
      name: 'Apex Logistics Corp',
      category: 'Logistics',
      status: 'Active',
      reliabilityScore: 94.5,
      riskLevel: 'Low',
      vendorRank: 1,
      contact_email: 'contact@apex.com',
      onTimeDeliveryRate: 96,
      qualityComplianceRate: 98
    },
    {
      id: 2,
      vendor_code: 'VND-1002',
      name: 'Delta Components',
      category: 'Manufacturing',
      status: 'Pending',
      reliabilityScore: 72.0,
      riskLevel: 'High',
      vendorRank: 2,
      contact_email: 'info@deltacomp.com',
      onTimeDeliveryRate: 75,
      qualityComplianceRate: 80
    }
  ];

  const mockPOs: PurchaseOrder[] = [
    {
      id: 101,
      po_number: 'PO-2026-1001',
      vendor_name: 'Apex Logistics Corp',
      category: 'Logistics',
      total_amount: 15000,
      status: 'Active',
      deliveryStatus: 'On Schedule',
      invoiceStatus: 'Cleared',
      created_date: '2026-09-01'
    }
  ];

  beforeEach(async () => {
    const vendorServiceSpy = {
      currentUser: signal(mockUser),
      vendors: signal(mockVendors),
      purchaseOrders: signal(mockPOs),
      procurements: signal<ProcurementRequest[]>([]),
      contracts: signal<Contract[]>([]),
      performance: signal<PerformanceMetric[]>([]),
      reports: signal<VendorReport[]>([]),
      notifications: signal<{ title: string; time: string; message: string }[]>([]),
      communications: signal<CommunicationLog[]>([]),
      microservices: signal<MicroserviceStatus[]>([]),
      availableRoles: ['Admin', 'Manager', 'Procurement', 'Auditor'] as UserRole[],
      totalSpend: () => 15000,
      avgReliability: () => '83.3',
      highRiskCount: () => 1,
      switchUserRole: jasmine.createSpy('switchUserRole').and.callFake((role: UserRole) => {
        vendorServiceSpy.currentUser.set({ ...mockUser, role });
      }),
      createPO: jasmine.createSpy('createPO').and.callFake((po: PurchaseOrder) => {
        vendorServiceSpy.purchaseOrders.set([...vendorServiceSpy.purchaseOrders(), po]);
      }),
      createVendor: jasmine.createSpy('createVendor').and.callFake((v: Vendor) => {
        vendorServiceSpy.vendors.set([...vendorServiceSpy.vendors(), v]);
      }),
      approveVendor: jasmine.createSpy('approveVendor').and.callFake((id: number) => {
        const updated = vendorServiceSpy.vendors().map(v => v.id === id ? { ...v, status: 'Active' as const } : v);
        vendorServiceSpy.vendors.set(updated);
      }),
      approveProcurement: jasmine.createSpy('approveProcurement'),
      dispatchCommunication: jasmine.createSpy('dispatchCommunication')
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, FormsModule],
      providers: [
        { provide: VendorService, useValue: vendorServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    mockVendorService = TestBed.inject(VendorService);
    fixture.detectChanges();
  });

  it('should create the dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default active tab as dashboard', () => {
    expect(component.activeTab).toBe('dashboard');
  });

  it('should change active tab when setActiveTab is called', () => {
    component.setActiveTab('vendors');
    expect(component.activeTab).toBe('vendors');
  });

  it('should filter vendors based on search term', () => {
    component.searchTerm = 'Apex';
    expect(component.filteredVendors.length).toBe(1);
    expect(component.filteredVendors[0].name).toContain('Apex');
  });

  it('should filter purchase orders based on search term', () => {
    component.searchTerm = 'PO-2026';
    expect(component.filteredPOs.length).toBe(1);
  });

  it('should toggle PO modal state and generate PO number', () => {
    expect(component.showPOModal).toBe(false);
    component.togglePOModal();
    expect(component.showPOModal).toBe(true);
    expect(component.newPO.po_number).toMatch(/^PO-2026-\d{4}$/);
  });

  it('should toggle Vendor modal state and generate vendor code', () => {
    expect(component.showVendorModal).toBe(false);
    component.toggleVendorModal();
    expect(component.showVendorModal).toBe(true);
    expect(component.newVendor.vendor_code).toMatch(/^VND-\d{4}$/);
  });

  it('should submit a new purchase order', () => {
    component.newPO = {
      id: 0,
      po_number: 'PO-2026-9999',
      vendor_name: 'Apex Logistics Corp',
      category: 'Logistics',
      total_amount: 50000,
      status: 'Active',
      deliveryStatus: 'On Schedule',
      invoiceStatus: 'Pending Audit',
      created_date: '2026-09-14'
    };
    component.submitPO();
    expect(mockVendorService.createPO).toHaveBeenCalled();
    expect(component.showPOModal).toBe(false);
  });

  it('should submit a new vendor', () => {
    component.newVendor = {
      id: 0,
      vendor_code: 'VND-8888',
      name: 'New Test Supplier',
      category: 'General Supplier',
      status: 'Pending',
      reliabilityScore: 85,
      riskLevel: 'Low',
      vendorRank: 0,
      contact_email: 'test@supplier.com',
      onTimeDeliveryRate: 90,
      qualityComplianceRate: 95
    };
    component.submitVendor();
    expect(mockVendorService.createVendor).toHaveBeenCalled();
    expect(component.showVendorModal).toBe(false);
  });

  it('should handle role change event safely', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'Auditor';
    select.appendChild(option);
    select.value = 'Auditor';

    const mockEvent = { target: select } as unknown as Event;
    component.onRoleChange(mockEvent);

    expect(mockVendorService.switchUserRole).toHaveBeenCalledWith('Auditor');
  });

  it('should approve a pending vendor', () => {
    component.approveVendor(2);
    expect(mockVendorService.approveVendor).toHaveBeenCalledWith(2);
  });

  it('should dispatch SMS alert for vendor', () => {
    component.dispatchSMSAlert('contact@apex.com');
    expect(mockVendorService.dispatchCommunication).toHaveBeenCalledWith(
      'SMS (Twilio)',
      'contact@apex.com',
      'SLA Breach Warning Dispatched'
    );
  });
