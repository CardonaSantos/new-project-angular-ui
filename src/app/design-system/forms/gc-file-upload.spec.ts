
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {of} from 'rxjs';
import {vi} from 'vitest';
import {GcFileUpload} from './gc-file-upload';

describe('GcFileUpload photo policy',()=>{
 it('only advertises JPEG/PNG in the native picker and disables multi-select',async()=>{
  await TestBed.configureTestingModule({
   imports:[GcFileUpload],
   providers:[{provide:MatDialog,useValue:{open:vi.fn()}}]
  }).compileComponents();
  const fixture=TestBed.createComponent(GcFileUpload);
  fixture.componentRef.setInput('inputId','avatar-input');
  fixture.componentRef.setInput('acceptedMime',['image/jpeg','image/png']);
  fixture.componentRef.setInput('maxFiles',1);
  fixture.componentRef.setInput('maxSizeMb',10);
  fixture.detectChanges();
  const input=fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
  expect(input.getAttribute('accept')).toBe('.jpg,.jpeg,.png');
  expect(input.multiple).toBe(false);
  expect(fixture.nativeElement.textContent).toContain('JPG, PNG');
  fixture.destroy();
 });
 it('rejects unsupported images without opening the cropper or emitting a file',async()=>{
  const dialog={open:vi.fn()};
  await TestBed.configureTestingModule({
   imports:[GcFileUpload],
   providers:[{provide:MatDialog,useValue:dialog}]
  }).compileComponents();
  const fixture=TestBed.createComponent(GcFileUpload);
  fixture.componentRef.setInput('inputId','avatar-input');
  fixture.componentRef.setInput('acceptedMime',['image/jpeg','image/png']);
  fixture.componentRef.setInput('cropSquare',true);
  fixture.detectChanges();
  const emitted:File[][]=[];
  fixture.componentInstance.filesSelected.subscribe(x=>emitted.push([...x]));
  const input=fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:[new File(['x'],'bad.webp',{type:'image/webp'})]});
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();fixture.detectChanges();
  expect(dialog.open).not.toHaveBeenCalled();
  expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('formato no permitido');
  expect(emitted).toEqual([]);
  fixture.destroy();
 });
 it('does not select an original image when cropping is canceled',async()=>{
  const dialog={open:vi.fn().mockReturnValue({afterClosed:()=>of(undefined)})};
  await TestBed.configureTestingModule({
   imports:[GcFileUpload],providers:[{provide:MatDialog,useValue:dialog}]
  }).compileComponents();
  const fixture=TestBed.createComponent(GcFileUpload);
  fixture.componentRef.setInput('inputId','avatar-input');
  fixture.componentRef.setInput('cropSquare',true);
  fixture.componentRef.setInput('acceptedMime',['image/jpeg','image/png']);
  fixture.detectChanges();
  const emitted:File[][]=[];
  fixture.componentInstance.filesSelected.subscribe(x=>emitted.push([...x]));
  const input=fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:[new File(['x'],'original.jpg',{type:'image/jpeg'})]});
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  expect(dialog.open).toHaveBeenCalledTimes(1);
  expect(emitted).toEqual([]);
  fixture.destroy();
 });
});
