import { Component, Input } from '@angular/core';

@Component({
  selector: 'gc-page-header',
  templateUrl: './gc-page-header.html',
  styleUrl: './gc-page-header.scss',
})
export class GcPageHeader {
  @Input({ required: true }) title = '';
  @Input() eyebrow = '';
  @Input() description = '';
}
