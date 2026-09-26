import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Shows a text field whose value is returned instead of `true`. */
  promptLabel?: string;
  promptRequired?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="confirm-message">{{ data.message }}</p>

      @if (data.promptLabel) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ data.promptLabel }}</mat-label>
          <textarea matInput rows="3" [(ngModel)]="reason"></textarea>
        </mat-form-field>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>
        {{ data.cancelLabel ?? 'Cancel' }}
      </button>
      <button
        matButton="filled"
        [class.danger-button]="data.danger"
        [disabled]="blocked()"
        (click)="confirm()"
      >
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .confirm-message {
      margin: 0 0 16px;
      line-height: 1.6;
    }
    .full-width {
      width: 100%;
      min-width: 380px;
    }
  `,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialog>);

  reason = '';

  blocked(): boolean {
    return !!this.data.promptRequired && this.reason.trim().length === 0;
  }

  confirm(): void {
    this.dialogRef.close(this.data.promptLabel ? this.reason.trim() : true);
  }
}
