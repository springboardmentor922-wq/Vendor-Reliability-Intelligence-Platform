import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { VendorModel } from './vendor.service';

export interface SupplyDisruptionAlert {
  id: string;
  vendor_id?: number;
  vendor_name: string;
  product: string;
  category: string;
  severity: 'Critical' | 'High' | 'Medium';
  delivery_rate: number;
  status: 'Open' | 'Re-sourcing In Progress' | 'Resolved';
  reported_by: string;
  reported_at: string;
  issue_summary: string;
  preventive_action_taken?: string;
  recommended_action: string;
  alternative_vendor_id?: number;
  alternative_vendor_name?: string;
  resolved_at?: string;
}

export interface ShipmentFlow {
  id: string;
  po_number: string;
  product_name: string;
  category: string;
  vendor_name: string;
  vendor_id: number;
  quantity: number;
  destination_hub: string;
  expected_date: string;
  status: 'On Schedule' | 'In Transit' | 'Delayed' | 'Critical Delay' | 'Delivered';
  delay_days: number;
  availability_status: 'Adequate Stock' | 'Buffer Low' | 'Stockout Risk';
  reliability_score: number;
  tracking_carrier?: string;
}

export interface PreventiveActionRecord {
  id: string;
  shipment_id?: string;
  po_number?: string;
  vendor_id: number;
  vendor_name: string;
  action_type: 'Expedite Express Freight' | 'Allocate Buffer Stock' | 'Quality Inspection Quarantine' | 'Formal Supplier SLA Warning';
  notes: string;
  performed_by: string;
  timestamp: string;
}

const STORAGE_KEY_ALERTS = 'vendor_iq_sc_alerts';
const STORAGE_KEY_ACTIONS = 'vendor_iq_sc_actions';

@Injectable({
  providedIn: 'root'
})
export class SupplyChainService {
  private defaultAlerts: SupplyDisruptionAlert[] = [
    {
      id: 'SCA-2026-001',
      vendor_id: 4,
      vendor_name: 'Nova Bio-Polymers',
      product: 'Bio-Polymer Resins (Grade A)',
      category: 'Raw Material Suppliers',
      severity: 'Critical',
      delivery_rate: 65.0,
      status: 'Open',
      reported_by: 'Marcus Vance (Supply Chain Manager)',
      reported_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      issue_summary: 'Severe 3-day freight delay on regional rail corridor. Supplier delivery rate dropped to 65%. Central Depot raw material stock buffer at critical stockout risk.',
      preventive_action_taken: 'Expedite Express Freight requested & Secondary safety buffer released.',
      recommended_action: 'Procurement Manager to immediately evaluate and select qualified alternative supplier (e.g. Acme Industrial or Global Materials) to avert assembly stoppage.'
    }
  ];

  private defaultFlows: ShipmentFlow[] = [
    {
      id: 'SF-001',
      po_number: 'PO-2026-0004',
      product_name: 'Bio-Polymer Resins (Grade A)',
      category: 'Raw Material Suppliers',
      vendor_name: 'Nova Bio-Polymers',
      vendor_id: 4,
      quantity: 1200,
      destination_hub: 'Central Depot - Bay 4',
      expected_date: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: 'Critical Delay',
      delay_days: 3,
      availability_status: 'Stockout Risk',
      reliability_score: 65.0,
      tracking_carrier: 'Midwest Intermodal Rail'
    },
    {
      id: 'SF-002',
      po_number: 'PO-2026-0001',
      product_name: 'Industrial Valve Assemblies & Fasteners',
      category: 'Raw Material Suppliers',
      vendor_name: 'Acme Industrial Supplies',
      vendor_id: 1,
      quantity: 500,
      destination_hub: 'Western Logistics Center',
      expected_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      status: 'In Transit',
      delay_days: 0,
      availability_status: 'Adequate Stock',
      reliability_score: 95.5,
      tracking_carrier: 'Global Freight Express'
    },
    {
      id: 'SF-003',
      po_number: 'PO-2026-0002',
      product_name: 'High-Precision Server Racks & Blades',
      category: 'IT Vendors',
      vendor_name: 'Apex Technology Solutions',
      vendor_id: 2,
      quantity: 40,
      destination_hub: 'Metro Tech Hub Bay 1',
      expected_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      status: 'On Schedule',
      delay_days: 0,
      availability_status: 'Adequate Stock',
      reliability_score: 94.0,
      tracking_carrier: 'AirCargo Prime'
    },
    {
      id: 'SF-004',
      po_number: 'PO-2026-0003',
      product_name: 'Rotary Hydraulic Excavator Pumps',
      category: 'Equipment Vendors',
      vendor_name: 'Vortex Heavy Machinery',
      vendor_id: 3,
      quantity: 15,
      destination_hub: 'Eastern Regional Depot',
      expected_date: new Date(Date.now() - 86400000 * 1).toISOString(),
      status: 'Delayed',
      delay_days: 1,
      availability_status: 'Buffer Low',
      reliability_score: 74.5,
      tracking_carrier: 'Titan Heavy Haul'
    },
    {
      id: 'SF-005',
      po_number: 'PO-2026-0005',
      product_name: 'Temperature-Controlled Fleet Trailers',
      category: 'Logistics Partners',
      vendor_name: 'Global Cargo Logistics',
      vendor_id: 5,
      quantity: 8,
      destination_hub: 'South Fleet Depot',
      expected_date: new Date(Date.now() + 86400000 * 6).toISOString(),
      status: 'On Schedule',
      delay_days: 0,
      availability_status: 'Adequate Stock',
      reliability_score: 92.0,
      tracking_carrier: 'Internal Fleet Route'
    }
  ];

  private alertsSubject = new BehaviorSubject<SupplyDisruptionAlert[]>(this.loadAlerts());
  alerts$ = this.alertsSubject.asObservable();

  private flowsSubject = new BehaviorSubject<ShipmentFlow[]>(this.defaultFlows);
  flows$ = this.flowsSubject.asObservable();

  private actionsSubject = new BehaviorSubject<PreventiveActionRecord[]>(this.loadActions());
  actions$ = this.actionsSubject.asObservable();

  constructor() {}

  private loadAlerts(): SupplyDisruptionAlert[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALERTS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read alerts from localStorage', e);
    }
    return this.defaultAlerts;
  }

  private saveAlerts(alerts: SupplyDisruptionAlert[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(alerts));
    } catch (e) {
      console.warn('Could not save alerts to localStorage', e);
    }
    this.alertsSubject.next(alerts);
  }

  private loadActions(): PreventiveActionRecord[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIONS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read actions from localStorage', e);
    }
    return [
      {
        id: 'PA-001',
        shipment_id: 'SF-001',
        po_number: 'PO-2026-0004',
        vendor_id: 4,
        vendor_name: 'Nova Bio-Polymers',
        action_type: 'Expedite Express Freight',
        notes: 'Instructed carrier to switch to direct expedited road transport to bypass rail bottleneck.',
        performed_by: 'Marcus Vance (Supply Chain Manager)',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        id: 'PA-002',
        shipment_id: 'SF-001',
        po_number: 'PO-2026-0004',
        vendor_id: 4,
        vendor_name: 'Nova Bio-Polymers',
        action_type: 'Allocate Buffer Stock',
        notes: 'Released 200 units of emergency safety buffer from Western Reserve.',
        performed_by: 'Marcus Vance (Supply Chain Manager)',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ];
  }

  private saveActions(actions: PreventiveActionRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(actions));
    } catch (e) {
      console.warn('Could not save actions to localStorage', e);
    }
    this.actionsSubject.next(actions);
  }

  getShipmentFlows(): Observable<ShipmentFlow[]> {
    return this.flows$;
  }

  getCoordinationAlerts(): Observable<SupplyDisruptionAlert[]> {
    return this.alerts$;
  }

  createDisruptionAlert(data: {
    vendor: VendorModel;
    product: string;
    category: string;
    severity: 'Critical' | 'High' | 'Medium';
    issue_summary: string;
    recommended_action?: string;
    preventive_action_taken?: string;
    reported_by?: string;
  }): Observable<SupplyDisruptionAlert> {
    const current = this.alertsSubject.getValue();
    const newAlert: SupplyDisruptionAlert = {
      id: `SCA-${Date.now().toString().slice(-4)}`,
      vendor_id: data.vendor.id,
      vendor_name: data.vendor.name,
      product: data.product || data.vendor.product,
      category: data.category || data.vendor.category,
      severity: data.severity,
      delivery_rate: data.vendor.deliveryRate,
      status: 'Open',
      reported_by: data.reported_by || 'Supply Chain Manager',
      reported_at: new Date().toISOString(),
      issue_summary: data.issue_summary,
      preventive_action_taken: data.preventive_action_taken || 'Preventive monitoring initiated',
      recommended_action: data.recommended_action || `Procurement to select qualified alternative vendor for ${data.category} to prevent supply disruption.`
    };

    const updated = [newAlert, ...current];
    this.saveAlerts(updated);
    return of(newAlert);
  }

  resolveDisruptionAlert(alertId: string, alternativeVendorName: string, alternativeVendorId?: number): Observable<boolean> {
    const current = this.alertsSubject.getValue();
    const updated = current.map(a => {
      if (a.id === alertId) {
        return {
          ...a,
          status: 'Resolved' as const,
          alternative_vendor_id: alternativeVendorId,
          alternative_vendor_name: alternativeVendorName,
          resolved_at: new Date().toISOString()
        };
      }
      return a;
    });
    this.saveAlerts(updated);
    return of(true);
  }

  updateAlertStatus(alertId: string, status: 'Open' | 'Re-sourcing In Progress' | 'Resolved'): Observable<boolean> {
    const current = this.alertsSubject.getValue();
    const updated = current.map(a => a.id === alertId ? { ...a, status } : a);
    this.saveAlerts(updated);
    return of(true);
  }

  recordPreventiveAction(record: {
    shipment_id?: string;
    po_number?: string;
    vendor_id: number;
    vendor_name: string;
    action_type: 'Expedite Express Freight' | 'Allocate Buffer Stock' | 'Quality Inspection Quarantine' | 'Formal Supplier SLA Warning';
    notes: string;
    performed_by?: string;
  }): Observable<PreventiveActionRecord> {
    const current = this.actionsSubject.getValue();
    const newRecord: PreventiveActionRecord = {
      id: `PA-${Date.now().toString().slice(-3)}`,
      shipment_id: record.shipment_id,
      po_number: record.po_number,
      vendor_id: record.vendor_id,
      vendor_name: record.vendor_name,
      action_type: record.action_type,
      notes: record.notes,
      performed_by: record.performed_by || 'Supply Chain Manager',
      timestamp: new Date().toISOString()
    };
    const updated = [newRecord, ...current];
    this.saveActions(updated);

    // If preventive action is taken on a shipment, adjust flow status if appropriate
    if (record.shipment_id) {
      const flows = this.flowsSubject.getValue();
      const updatedFlows = flows.map(f => {
        if (f.id === record.shipment_id) {
          if (record.action_type === 'Allocate Buffer Stock') {
            return { ...f, availability_status: 'Buffer Low' as const };
          }
          if (record.action_type === 'Expedite Express Freight') {
            return { ...f, status: 'In Transit' as const, delay_days: Math.max(0, f.delay_days - 1) };
          }
        }
        return f;
      });
      this.flowsSubject.next(updatedFlows);
    }

    return of(newRecord);
  }
}
