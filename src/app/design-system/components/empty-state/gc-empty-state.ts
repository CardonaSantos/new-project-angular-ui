import { Component, Input } from '@angular/core';

@Component({
  selector: 'gc-empty-state',
  templateUrl: './gc-empty-state.html',
  styleUrl: './gc-empty-state.scss',
})
export class GcEmptyState {
  @Input({ required: true }) title = '';
  @Input() description = '';
}
