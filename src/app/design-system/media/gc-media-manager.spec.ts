import { TestBed } from '@angular/core/testing';
import { GcMediaManager, GcMediaSelection } from './gc-media-manager';

describe('GcMediaManager', () => {
  it('keeps files across selections, rejects duplicates and releases previews', async () => {
    const create = vi.fn((file: File) => 'blob:local-' + file.name);
    const revoke = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    try {
      await TestBed.configureTestingModule({ imports: [GcMediaManager] }).compileComponents();
      const fixture = TestBed.createComponent(GcMediaManager);
      fixture.componentRef.setInput('inputId', 'media-test');
      const snapshots: GcMediaSelection[] = [];
      fixture.componentInstance.selectionChange.subscribe((value) => snapshots.push(value));
      fixture.detectChanges();

      const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();
      const one = new File(['one'], 'one.png', { type: 'image/png' });
      const two = new File(['two'], 'two.png', { type: 'image/png' });
      if (!input) return;
      Object.defineProperty(input, 'files', { configurable: true, value: [one] });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      Object.defineProperty(input, 'files', { configurable: true, value: [two, one] });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(snapshots.at(-1)?.files).toEqual([one, two]);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('ya está agregado');
      const remove = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Eliminar one.png"]');
      remove?.click();
      expect(snapshots.at(-1)?.files).toEqual([two]);
      expect(revoke).toHaveBeenCalledWith('blob:local-one.png');
      fixture.destroy();
      expect(revoke).toHaveBeenCalledWith('blob:local-two.png');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
