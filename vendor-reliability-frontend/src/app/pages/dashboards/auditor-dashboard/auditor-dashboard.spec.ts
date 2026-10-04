import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditorDashboard } from './auditor-dashboard';
import { AuditExportService } from '../../../services/audit-export.service';

describe('AuditorDashboard', () => {
  let component: AuditorDashboard;
  let fixture: ComponentFixture<AuditorDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditorDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditorDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create AuditorDashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should filter audit logs by category', () => {
    component.auditLogs = [
      { id: 1, action: 'USER_LOGIN', entity_type: 'User', created_at: '2026-03-01T10:00:00Z', details: 'Login success' },
      { id: 2, action: 'PO_CREATED', entity_type: 'PurchaseOrder', created_at: '2026-03-01T11:00:00Z', details: 'Issued PO' }
    ];
    component.auditCategoryFilter = 'PO';
    component.applyLogFilter();
    expect(component.filteredLogs.length).toBe(1);
    expect(component.filteredLogs[0].action).toBe('PO_CREATED');
  });

  it('should trigger excel export when requested', () => {
    const exportService = TestBed.inject(AuditExportService);
    const spy = vi.spyOn(exportService, 'exportToExcel').mockImplementation(() => {});
    component.exportAuditReport('excel');
    expect(spy).toHaveBeenCalled();
    expect(component.actionMessage).toContain('XLSX');
  });

  it('should trigger pdf export when requested', () => {
    const exportService = TestBed.inject(AuditExportService);
    const spy = vi.spyOn(exportService, 'exportToPdf').mockImplementation(() => {});
    component.exportAuditReport('pdf');
    expect(spy).toHaveBeenCalled();
    expect(component.actionMessage).toContain('PDF');
  });

  it('should trigger print dossier preview', () => {
    const exportService = TestBed.inject(AuditExportService);
    const spy = vi.spyOn(exportService, 'printDossier').mockImplementation(() => {});
    component.printAuditDossier();
    expect(spy).toHaveBeenCalled();
  });
});
