import { Component, Input } from '@angular/core';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'gc-status-badge',
  templateUrl: './gc-status-badge.html',
  styleUrl: './gc-status-badge.scss',
})
export class GcStatusBadge {
  @Input({ required: true }) label = '';
  @Input() tone: StatusTone = 'neutral';
}
