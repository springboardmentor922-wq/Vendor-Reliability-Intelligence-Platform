import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  Communication as CommunicationRecord,
  CommunicationService
} from '../../core/services/communication';

import {
  Vendor,
  VendorService
} from '../../core/services/vendor';


interface CommunicationForm {
  vendor_id: FormControl<number | null>;
  communication_type: FormControl<string>;
  subject: FormControl<string>;
  recipient: FormControl<string>;
  status: FormControl<string>;
  message: FormControl<string>;
  attachment_name: FormControl<string>;
}


@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './communication.html',
  styleUrl: './communication.scss'
})
export class CommunicationPage implements OnInit {

  communications: CommunicationRecord[] = [];
  filteredCommunications: CommunicationRecord[] = [];

  vendors: Vendor[] = [];

  communicationForm: FormGroup<CommunicationForm>;

  loading = false;
  saving = false;

  successMessage = '';
  errorMessage = '';

  selectedFilter = 'ALL';


  communicationTypes: string[] = [
    'VENDOR_MESSAGING',
    'PROCUREMENT_DISCUSSION',
    'COMMUNICATION_HISTORY',
    'EMAIL_NOTIFICATION',
    'FILE_SHARING',
    'ACTIVITY_LOG'
  ];


  statuses: string[] = [
    'PENDING',
    'SENT',
    'RECEIVED',
    'RESOLVED'
  ];


  constructor(
    private fb: FormBuilder,
    private communicationService: CommunicationService,
    private vendorService: VendorService
  ) {

    this.communicationForm =
      this.fb.nonNullable.group({

        vendor_id:
          new FormControl<number | null>(
            null
          ),

        communication_type:
          new FormControl<string>(
            'VENDOR_MESSAGING',
            {
              nonNullable: true,
              validators: [
                Validators.required
              ]
            }
          ),

        subject:
          new FormControl<string>(
            '',
            {
              nonNullable: true,
              validators: [
                Validators.required,
                Validators.minLength(2)
              ]
            }
          ),

        recipient:
          new FormControl<string>(
            '',
            {
              nonNullable: true
            }
          ),

        status:
          new FormControl<string>(
            'PENDING',
            {
              nonNullable: true,
              validators: [
                Validators.required
              ]
            }
          ),

        message:
          new FormControl<string>(
            '',
            {
              nonNullable: true,
              validators: [
                Validators.required,
                Validators.minLength(2)
              ]
            }
          ),

        attachment_name:
          new FormControl<string>(
            '',
            {
              nonNullable: true
            }
          )
      });
  }


  ngOnInit(): void {
    this.loadCommunications();
    this.loadVendors();
  }


  // ============================================================
  // LOAD COMMUNICATIONS
  // ============================================================

  loadCommunications(): void {

    this.loading = true;
    this.clearMessages();

    this.communicationService
      .getCommunications()
      .subscribe({

        next: (data: CommunicationRecord[]) => {

          this.communications =
            Array.isArray(data)
              ? data
              : [];

          this.applyFilter();

          this.loading = false;
        },

        error: (error: HttpErrorResponse) => {

          this.loading = false;

          this.communications = [];
          this.filteredCommunications = [];

          this.handleError(
            error,
            'Failed to load communications.'
          );
        }
      });
  }


  // ============================================================
  // LOAD VENDORS
  // ============================================================

  loadVendors(): void {

    this.vendorService
      .getVendors()
      .subscribe({

        next: (data: Vendor[]) => {

          this.vendors =
            Array.isArray(data)
              ? data
              : [];
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Failed to load vendors:',
            error
          );

          this.vendors = [];
        }
      });
  }


  // ============================================================
  // FILTER
  // ============================================================

  setFilter(type: string): void {

    this.selectedFilter = type;

    this.applyFilter();
  }


  applyFilter(): void {

    if (this.selectedFilter === 'ALL') {

      this.filteredCommunications = [
        ...this.communications
      ];

      return;
    }

    this.filteredCommunications =
      this.communications.filter(
        communication =>
          communication.communication_type ===
          this.selectedFilter
      );
  }


  // ============================================================
  // CREATE COMMUNICATION
  // ============================================================

  submitCommunication(): void {

    if (this.communicationForm.invalid) {

      this.communicationForm.markAllAsTouched();

      return;
    }

    this.saving = true;
    this.clearMessages();

    const value =
      this.communicationForm.getRawValue();


    const payload = {

      vendor_id:
        value.vendor_id === null
          ? null
          : Number(value.vendor_id),

      communication_type:
        value.communication_type,

      subject:
        value.subject.trim(),

      recipient:
        value.recipient.trim() || null,

      status:
        value.status,

      message:
        value.message.trim(),

      attachment_name:
        value.attachment_name.trim() || null
    };


    this.communicationService
      .createCommunication(payload)
      .subscribe({

        next: () => {

          this.successMessage =
            'Communication created successfully.';

          this.resetForm();

          this.saving = false;

          this.loadCommunications();
        },

        error: (error: HttpErrorResponse) => {

          this.saving = false;

          this.handleError(
            error,
            'Failed to create communication.'
          );
        }
      });
  }


  // ============================================================
  // STATUS
  // ============================================================

  /*
   * The current CommunicationService does not expose
   * updateCommunicationStatus(), so we do not call a
   * non-existing service method here.
   *
   * Status changes are kept visually synchronized with
   * the local communication record.
   *
   * The existing backend communication API currently
   * supports create/list/get/delete operations.
   */

  updateStatus(
    communication: CommunicationRecord,
    event: Event
  ): void {

    const select =
      event.target as HTMLSelectElement;

    const newStatus =
      select.value;

    if (!newStatus) {
      return;
    }

    communication.status =
      newStatus;

    this.successMessage =
      'Communication status updated locally.';
  }


  // ============================================================
  // DELETE
  // ============================================================

  deleteCommunication(
    communication: CommunicationRecord
  ): void {

    const confirmed =
      window.confirm(
        `Delete communication "${communication.subject}"?`
      );

    if (!confirmed) {
      return;
    }

    this.clearMessages();

    this.communicationService
      .deleteCommunication(
        communication.id
      )
      .subscribe({

        next: () => {

          this.communications =
            this.communications.filter(
              item =>
                item.id !== communication.id
            );

          this.applyFilter();

          this.successMessage =
            'Communication deleted successfully.';
        },

        error: (error: HttpErrorResponse) => {

          this.handleError(
            error,
            'Failed to delete communication.'
          );
        }
      });
  }


  // ============================================================
  // RESET FORM
  // ============================================================

  resetForm(): void {

    this.communicationForm.reset({

      vendor_id: null,

      communication_type:
        'VENDOR_MESSAGING',

      subject: '',

      recipient: '',

      status:
        'PENDING',

      message: '',

      attachment_name: ''
    });

    this.communicationForm.markAsPristine();
    this.communicationForm.markAsUntouched();
  }


  // ============================================================
  // VALIDATION
  // ============================================================

  isInvalid(
    controlName: keyof CommunicationForm
  ): boolean {

    const control =
      this.communicationForm.get(
        controlName
      );

    return !!(
      control &&
      control.invalid &&
      (control.dirty || control.touched)
    );
  }


  // ============================================================
  // VENDOR NAME
  // ============================================================

  getVendorName(
    vendorId: number | null | undefined
  ): string {

    if (
      vendorId === null ||
      vendorId === undefined
    ) {
      return 'General';
    }

    const vendor =
      this.vendors.find(
        item =>
          item.id === vendorId
      );

    return vendor
      ? vendor.name
      : `Vendor #${vendorId}`;
  }


  // ============================================================
  // TYPE CSS CLASS
  // ============================================================

  getTypeClass(
    type: string
  ): string {

    switch (
      String(type)
        .trim()
        .toUpperCase()
    ) {

      case 'VENDOR_MESSAGING':
        return 'type-vendor';

      case 'PROCUREMENT_DISCUSSION':
        return 'type-procurement';

      case 'COMMUNICATION_HISTORY':
        return 'type-history';

      case 'EMAIL_NOTIFICATION':
        return 'type-email';

      case 'FILE_SHARING':
        return 'type-file';

      case 'ACTIVITY_LOG':
        return 'type-activity';

      default:
        return 'type-history';
    }
  }


  // ============================================================
  // SUMMARY COUNTS
  // ============================================================

  get totalCommunications(): number {

    return this.communications.length;
  }


  get vendorMessagingCount(): number {

    return this.countByType(
      'VENDOR_MESSAGING'
    );
  }


  get procurementDiscussionCount(): number {

    return this.countByType(
      'PROCUREMENT_DISCUSSION'
    );
  }


  get emailNotificationCount(): number {

    return this.countByType(
      'EMAIL_NOTIFICATION'
    );
  }


  get fileSharingCount(): number {

    return this.countByType(
      'FILE_SHARING'
    );
  }


  get activityLogCount(): number {

    return this.countByType(
      'ACTIVITY_LOG'
    );
  }


  private countByType(
    type: string
  ): number {

    return this.communications.filter(
      communication =>
        String(
          communication.communication_type
        ).trim().toUpperCase() === type
    ).length;
  }


  // ============================================================
  // MESSAGES
  // ============================================================

  clearMessages(): void {

    this.successMessage = '';
    this.errorMessage = '';
  }


  handleError(
    error: HttpErrorResponse,
    fallbackMessage: string
  ): void {

    console.error(
      'Communication error:',
      error
    );

    if (
      error.error &&
      typeof error.error.detail === 'string'
    ) {

      this.errorMessage =
        error.error.detail;

    } else if (
      error.error &&
      typeof error.error.message === 'string'
    ) {

      this.errorMessage =
        error.error.message;

    } else if (error.message) {

      this.errorMessage =
        error.message;

    } else {

      this.errorMessage =
        fallbackMessage;
    }
  }
}