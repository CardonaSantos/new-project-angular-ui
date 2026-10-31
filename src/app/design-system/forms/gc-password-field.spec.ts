import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { GcPasswordField } from './gc-password-field';

describe('GcPasswordField', () => {
  it('supports keyboard-accessible visibility toggle and error descriptions', async () => {
    await TestBed.configureTestingModule({ imports: [GcPasswordField] }).compileComponents();
    const fixture = TestBed.createComponent(GcPasswordField);
    const control = new FormControl('sample-password', { nonNullable: true });
    fixture.componentRef.setInput('inputId', 'test-password');
    fixture.componentRef.setInput('label', 'Contraseña');
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('errorText', 'Campo obligatorio.');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const toggle = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(input.type).toBe('password');
    expect(input.getAttribute('aria-describedby')).toBe('test-password-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
  });
});
