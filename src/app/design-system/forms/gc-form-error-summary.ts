import { Component, input, output } from '@angular/core';
import { GcFormIssue } from './gc-validation';

@Component({
  selector: 'gc-form-error-summary',
  templateUrl: './gc-form-error-summary.html',
  styleUrl: './gc-form-error-summary.scss',
})
export class GcFormErrorSummary {
  readonly issues = input<readonly GcFormIssue[]>([]);
  readonly issueSelected = output<GcFormIssue>();
}
