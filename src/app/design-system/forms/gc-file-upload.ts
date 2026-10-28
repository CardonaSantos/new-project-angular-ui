import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { gcCheckFiles } from './gc-file-validation';

export interface GcFilePreview {
  name: string;
  url: string;
}

@Component({
  selector: 'gc-file-upload',
  templateUrl: './gc-file-upload.html',
  styleUrl: './gc-file-upload.scss',
})
export class GcFileUpload implements OnDestroy {
  readonly inputId = input.required<string>();
  readonly label = input('Adjuntar imágenes');
  readonly maxFiles = input(3);
  readonly maxSizeMb = input(2);
  readonly acceptedMime = input<readonly string[]>(['image/png', 'image/jpeg', 'image/webp']);
  readonly filesSelected = output<readonly File[]>();
  readonly errors = signal<readonly string[]>([]);
  readonly previews = signal<readonly GcFilePreview[]>([]);
  private objectUrls: string[] = [];

  protected onFiles(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    const checked = gcCheckFiles(files, {
      maxFiles: this.maxFiles(),
      maxBytes: this.maxSizeMb() * 1024 * 1024,
      allowedMime: this.acceptedMime(),
    });
    this.clearPreviews();
    this.errors.set(checked.errors);
    const previews = checked.accepted.map((file) => {
      const url = URL.createObjectURL(file);
      this.objectUrls.push(url);
      return { name: file.name, url };
    });
    this.previews.set(previews);
    this.filesSelected.emit(checked.accepted);
    // Allow selecting the same file again.
    target.value = '';
  }

  protected clear(): void {
    this.clearPreviews();
    this.errors.set([]);
    this.filesSelected.emit([]);
  }

  private clearPreviews(): void {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
    this.previews.set([]);
  }

  ngOnDestroy(): void { this.clearPreviews(); }
}
