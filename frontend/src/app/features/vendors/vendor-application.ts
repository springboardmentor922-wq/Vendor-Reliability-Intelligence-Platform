import { Component, computed, inject, input, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { extractDetail } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ApplicationResult, VendorApplicationService } from '../../core/dashboards.service';
import { LiveService } from '../../core/live.service';
import { ToastService } from '../../core/toast.service';
import { bytes } from '../../shared/viz/format';

interface StepDef {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
}

const CATEGORY_META: Record<string, { icon: string; blurb: string }> = {
  'Raw Material Suppliers': { icon: 'precision_manufacturing', blurb: 'Metals, chemicals, polymers, components' },
  'Equipment Vendors': { icon: 'construction', blurb: 'Machinery, tools, rentals, spares' },
  'IT Vendors': { icon: 'computer', blurb: 'Hardware, software, cloud, licences' },
  'Service Providers': { icon: 'support_agent', blurb: 'Consulting, staffing, facilities' },
  'Logistics Partners': { icon: 'local_shipping', blurb: 'Freight, courier, warehousing' },
  'Maintenance Vendors': { icon: 'handyman', blurb: 'AMC, repairs, upkeep services' },
};

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('account_password')?.value;
  const confirm = group.get('account_confirm')?.value;
  return pw && confirm && pw !== confirm ? { mismatch: true } : null;
}

/**
 * Vendor registration application - a guided, multi-step form.
 *
 * Used in two places: the top-right "Register Vendor" button for internal
 * staff, and the public "Apply as a vendor" page, which adds a step for the
 * supplier's own portal login.
 */
@Component({
  selector: 'app-vendor-application',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './vendor-application.html',
  styleUrl: './vendor-application.scss',
})
export class VendorApplication {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(VendorApplicationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly live = inject(LiveService);

  /** `public` adds the portal-account step and the stand-alone page chrome. */
  readonly mode = input<'internal' | 'public'>('internal');

  readonly categories = signal<string[]>(Object.keys(CATEGORY_META));
  readonly companyTypes = signal<string[]>([
    'Private Limited', 'Public Limited', 'Limited Liability Partnership', 'Partnership', 'Sole Proprietorship', 'Government / PSU', 'Other',
  ]);
  readonly documentTypes = signal<string[]>([
    'Certificate of Incorporation', 'Tax Registration Certificate', 'Company Profile', 'Quality Certification', 'Cancelled Cheque / Bank Letter', 'Other',
  ]);
  readonly employeeBands = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
  readonly turnoverBands = ['Under ₹1 Cr', '₹1-10 Cr', '₹10-50 Cr', '₹50-250 Cr', '₹250 Cr+'];
  readonly categoryMeta = CATEGORY_META;

  readonly step = signal(0);
  readonly direction = signal<'fwd' | 'back'>('fwd');
  readonly submitting = signal(false);
  readonly result = signal<ApplicationResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly documents = signal<{ file: File; type: string }[]>([]);
  readonly dragging = signal(false);
  readonly bytes = bytes;

  readonly steps = computed<StepDef[]>(() => {
    const base: StepDef[] = [
      { key: 'company', title: 'Company', subtitle: 'Legal identity', icon: 'apartment' },
      { key: 'business', title: 'Business', subtitle: 'Category & offering', icon: 'category' },
      { key: 'contact', title: 'Contacts', subtitle: 'Address & people', icon: 'contacts' },
      { key: 'compliance', title: 'Compliance', subtitle: 'Certificates & documents', icon: 'verified' },
    ];
    if (this.mode() === 'public') base.push({ key: 'account', title: 'Portal Access', subtitle: 'Your login', icon: 'key' });
    base.push({ key: 'review', title: 'Review', subtitle: 'Confirm & submit', icon: 'task_alt' });
    return base;
  });

  readonly current = computed(() => this.steps()[this.step()]);
  readonly progress = computed(() => (100 * this.step()) / (this.steps().length - 1));

  readonly form = this.fb.group({
    company: this.fb.group({
      vendor_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      company_type: ['Private Limited'],
      registration_number: ['', Validators.maxLength(60)],
      tax_id: ['', Validators.maxLength(60)],
      year_established: [null as number | null, [Validators.min(1800), Validators.max(new Date().getFullYear())]],
      employee_count: [''],
      annual_turnover: [''],
      website: ['', Validators.maxLength(255)],
    }),
    business: this.fb.group({
      category: ['', Validators.required],
      products_services: ['', [Validators.required, Validators.minLength(3)]],
      notes: [''],
    }),
    contact: this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(5)]],
      address: ['', Validators.required],
      city: ['', Validators.required],
      state: [''],
      postal_code: [''],
      country: ['India', Validators.required],
      primary: [0],
      contacts: this.fb.array([this.contactGroup()]),
    }),
    compliance: this.fb.group({
      certifications: this.fb.array<any>([]),
    }),
    account: this.fb.group(
      {
        account_name: [''],
        account_email: ['', Validators.email],
        account_password: ['', Validators.minLength(8)],
        account_confirm: [''],
      },
      { validators: passwordsMatch },
    ),
    declaration: [false, Validators.requiredTrue],
  });

  constructor() {
    this.api.options().subscribe({
      next: (o) => {
        this.categories.set(o.categories);
        this.companyTypes.set(o.company_types);
        this.documentTypes.set(o.document_types);
      },
    });
  }

  get contacts(): FormArray {
    return this.form.get('contact.contacts') as FormArray;
  }

  get certifications(): FormArray {
    return this.form.get('compliance.certifications') as FormArray;
  }

  contactGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      designation: [''],
      department: [''],
      email: ['', Validators.email],
      phone: [''],
    });
  }

  certGroup() {
    return this.fb.group({
      certification_name: ['', Validators.required],
      issuing_authority: [''],
      certificate_number: [''],
      issue_date: [''],
      expiry_date: [''],
    });
  }

  addContact(): void {
    this.contacts.push(this.contactGroup());
  }

  removeContact(i: number): void {
    if (this.contacts.length === 1) return;
    this.contacts.removeAt(i);
    const primary = this.form.get('contact.primary');
    if ((primary?.value ?? 0) >= this.contacts.length) primary?.setValue(0);
  }

  addCert(): void {
    this.certifications.push(this.certGroup());
  }

  removeCert(i: number): void {
    this.certifications.removeAt(i);
  }

  pickCategory(category: string): void {
    this.form.get('business.category')?.setValue(category);
  }

  // ---------------------------------------------------------------- documents

  onFiles(list: FileList | null): void {
    if (!list) return;
    const allowed = /\.(pdf|png|jpe?g|docx?|xlsx?|csv|txt)$/i;
    const incoming = Array.from(list).filter((f) => {
      if (!allowed.test(f.name)) {
        this.toast.error(`${f.name}: use PDF, image, Word, Excel or text files.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        this.toast.error(`${f.name} is larger than 10 MB.`);
        return false;
      }
      return true;
    });
    this.documents.update((docs) => [...docs, ...incoming.map((file) => ({ file, type: this.guessType(file.name) }))]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.onFiles(event.dataTransfer?.files ?? null);
  }

  setDocType(index: number, type: string): void {
    this.documents.update((docs) => docs.map((d, i) => (i === index ? { ...d, type } : d)));
  }

  removeDoc(index: number): void {
    this.documents.update((docs) => docs.filter((_, i) => i !== index));
  }

  private guessType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('incorp') || n.includes('coi')) return 'Certificate of Incorporation';
    if (n.includes('gst') || n.includes('tax') || n.includes('pan')) return 'Tax Registration Certificate';
    if (n.includes('iso') || n.includes('cert')) return 'Quality Certification';
    if (n.includes('cheque') || n.includes('bank')) return 'Cancelled Cheque / Bank Letter';
    if (n.includes('profile') || n.includes('brochure')) return 'Company Profile';
    return 'Other';
  }

  // ---------------------------------------------------------------- navigation

  private groupFor(key: string): AbstractControl | null {
    return key === 'review' ? this.form.get('declaration') : this.form.get(key);
  }

  stepValid(index: number): boolean {
    const key = this.steps()[index]?.key;
    if (key === 'account') return this.accountValid();
    const group = this.groupFor(key);
    return !group || group.valid;
  }

  private accountValid(): boolean {
    const g = this.form.get('account')!;
    const v = g.value as { account_email?: string; account_password?: string };
    if (!v.account_email && !v.account_password) return true; // optional
    return g.valid && !!v.account_email && !!v.account_password;
  }

  next(): void {
    const key = this.current().key;
    const group = this.groupFor(key);
    if (!this.stepValid(this.step())) {
      group?.markAllAsTouched();
      this.toast.error(key === 'account' ? 'Enter a login email and matching passwords (or leave all blank).' : 'Please complete the required fields on this step.');
      return;
    }
    this.direction.set('fwd');
    this.step.update((s) => Math.min(s + 1, this.steps().length - 1));
  }

  back(): void {
    this.direction.set('back');
    this.step.update((s) => Math.max(s - 1, 0));
  }

  goTo(index: number): void {
    // Jumping ahead is only allowed over valid steps.
    for (let i = 0; i < index; i++) {
      if (!this.stepValid(i)) return;
    }
    this.direction.set(index > this.step() ? 'fwd' : 'back');
    this.step.set(index);
  }

  // ---------------------------------------------------------------- submit

  submit(): void {
    for (let i = 0; i < this.steps().length; i++) {
      if (!this.stepValid(i)) {
        this.goTo(i);
        this.groupFor(this.steps()[i].key)?.markAllAsTouched();
        this.toast.error(`Please complete the "${this.steps()[i].title}" step.`);
        return;
      }
    }

    const v = this.form.getRawValue();
    const primary = v.contact.primary ?? 0;
    const payload = {
      ...v.company,
      year_established: v.company.year_established || null,
      category: v.business.category,
      products_services: v.business.products_services,
      notes: v.business.notes || null,
      email: v.contact.email,
      phone: v.contact.phone,
      address: v.contact.address,
      city: v.contact.city,
      state: v.contact.state || null,
      postal_code: v.contact.postal_code || null,
      country: v.contact.country,
      contacts: (v.contact.contacts as any[]).map((c, i) => ({ ...c, email: c.email || null, is_primary: i === primary })),
      certifications: (v.compliance.certifications as any[]).map((c) => ({
        ...c,
        issue_date: c.issue_date || null,
        expiry_date: c.expiry_date || null,
      })),
      account_name: this.mode() === 'public' ? v.account.account_name || null : null,
      account_email: this.mode() === 'public' ? v.account.account_email || null : null,
      account_password: this.mode() === 'public' ? v.account.account_password || null : null,
      declaration_accepted: v.declaration,
    };

    // Empty strings would fail server-side max-length/format checks.
    for (const key of ['registration_number', 'tax_id', 'website', 'employee_count', 'annual_turnover']) {
      if (!(payload as any)[key]) (payload as any)[key] = null;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.api.submit(payload, this.documents()).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.result.set(result);
        this.live.poke();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(extractDetail(err) ?? 'The application could not be submitted. Please try again.');
      },
    });
  }

  openPortal(): void {
    const r = this.result();
    if (r?.access_token && r.refresh_token) {
      this.auth.adoptTokens(r.access_token, r.refresh_token).subscribe({
        next: () => void this.router.navigateByUrl('/dashboards/vendor'),
        error: () => void this.router.navigateByUrl('/login'),
      });
    } else {
      void this.router.navigateByUrl('/login');
    }
  }

  startAnother(): void {
    this.result.set(null);
    this.documents.set([]);
    this.form.reset({ company: { company_type: 'Private Limited' }, contact: { country: 'India', primary: 0 }, declaration: false });
    this.contacts.clear();
    this.contacts.push(this.contactGroup());
    this.certifications.clear();
    this.step.set(0);
  }

  value(path: string): string {
    const v = this.form.get(path)?.value;
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }
}
