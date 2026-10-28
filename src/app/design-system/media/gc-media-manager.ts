import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { gcCheckFiles } from '../forms/gc-file-validation';

interface GcLocalMedia {
  id: number;
  file: File;
  url: string;
}

export interface GcMediaSelection {
  files: readonly File[];
  primaryIndex: number;
}

/** Local collection only: no upload, metadata persistence, or server assumption. */
@Component({
  selector: 'gc-media-manager',
  templateUrl: './gc-media-manager.html',
  styleUrl: './gc-media-manager.scss',
})
export class GcMediaManager implements OnDestroy {
  readonly inputId = input.required<string>();
  readonly label = input('Imágenes');
  readonly maxFiles = input(6);
  readonly maxSizeMb = input(5);
  readonly allowedMime = input<readonly string[]>(['image/png', 'image/jpeg', 'image/webp']);
  readonly selectionChange = output<GcMediaSelection>();
  protected readonly items = signal<readonly GcLocalMedia[]>([]);
  protected readonly primaryId = signal<number | null>(null);
  protected readonly errors = signal<readonly string[]>([]);
  private nextId = 1;

  protected addFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const candidates = Array.from(input.files ?? []);
    input.value = '';
    const existing = this.items();
    const remaining = Math.max(0, this.maxFiles() - existing.length);
    const issues: string[] = [];
    const newItems: GcLocalMedia[] = [];

    const fingerprints = new Set(existing.map(({ file }) => this.key(file)));
    for (const file of candidates) {
      if (fingerprints.has(this.key(file))) {
        issues.push(file.name + ': ya está agregado.');
        continue;
      }
      const validation = gcCheckFiles([file], {
        maxFiles: 1,
        maxBytes: this.maxSizeMb() * 1024 * 1024,
        allowedMime: this.allowedMime(),
      });
      if (validation.errors.length) {
        issues.push(...validation.errors);
        continue;
      }
      if (newItems.length >= remaining) {
        issues.push('Se permiten como máximo ' + this.maxFiles() + ' archivos.');
        break;
      }
      fingerprints.add(this.key(file));
      newItems.push({ id: this.nextId++, file, url: URL.createObjectURL(file) });
    }
    this.items.set([...existing, ...newItems]);
    if (this.primaryId() === null && this.items().length) this.primaryId.set(this.items()[0].id);
    this.errors.set(issues);
    if (newItems.length) this.emit();
  }

  protected remove(id: number): void {
    const item = this.items().find((entry) => entry.id === id);
    if (!item) return;
    URL.revokeObjectURL(item.url);
    this.items.update((current) => current.filter((entry) => entry.id !== id));
    if (this.primaryId() === id) this.primaryId.set(this.items()[0]?.id ?? null);
    this.emit();
  }

  protected setPrimary(id: number): void {
    if (!this.items().some((entry) => entry.id === id)) return;
    this.primaryId.set(id);
    this.emit();
  }

  protected move(id: number, direction: -1 | 1): void {
    const current = [...this.items()];
    const index = current.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    this.items.set(current);
    this.emit();
  }

  private emit(): void {
    const items = this.items();
    this.selectionChange.emit({
      files: items.map(({ file }) => file),
      primaryIndex: items.findIndex((item) => item.id === this.primaryId()),
    });
  }

  private key(file: File): string {
    return [file.name, file.size, file.lastModified].join(':');
  }

  ngOnDestroy(): void {
    for (const item of this.items()) URL.revokeObjectURL(item.url);
  }
}
