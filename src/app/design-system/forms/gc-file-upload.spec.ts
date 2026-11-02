
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
 it('crops multiple inventory photos before checking their upload size',async()=>{
  const prepared=[
   new File(['a'],'first.jpg',{type:'image/jpeg'}),
   new File(['b'],'second.jpg',{type:'image/jpeg'}),
  ];
  const dialog={open:vi.fn()
   .mockReturnValueOnce({afterClosed:()=>of(prepared[0])})
   .mockReturnValueOnce({afterClosed:()=>of(prepared[1])})};
  await TestBed.configureTestingModule({
   imports:[GcFileUpload],providers:[{provide:MatDialog,useValue:dialog}]
  }).compileComponents();
  const fixture=TestBed.createComponent(GcFileUpload);
  fixture.componentRef.setInput('inputId','inventory-photos');
  fixture.componentRef.setInput('maxFiles',10);
  fixture.componentRef.setInput('maxSizeMb',10);
  fixture.componentRef.setInput('cropSquare',true);
  fixture.detectChanges();
  const selected:File[][]=[];
  fixture.componentInstance.filesSelected.subscribe(files=>selected.push([...files]));
  const originals=[
   new File(['original'],'first.jpg',{type:'image/jpeg'}),
   new File(['original'],'second.jpg',{type:'image/jpeg'})
  ];
  // Source file dimensions and raw file size are not the upload size.
  Object.defineProperty(originals[0],'size',{value:15*1024*1024});
  const input=fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:originals});
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  expect(dialog.open).toHaveBeenCalledTimes(2);
  expect(selected).toEqual([prepared]);
  expect(fixture.nativeElement.textContent).toContain('por imagen recortada');
  fixture.destroy();
 });
 it('does not upload a cropped result beyond 10 MB',async()=>{
  const cropped=new File(['image'],'huge.jpg',{type:'image/jpeg'});
  Object.defineProperty(cropped,'size',{value:11*1024*1024});
  const dialog={open:vi.fn().mockReturnValue({afterClosed:()=>of(cropped)})};
  await TestBed.configureTestingModule({
   imports:[GcFileUpload],providers:[{provide:MatDialog,useValue:dialog}]
  }).compileComponents();
  const fixture=TestBed.createComponent(GcFileUpload);
  fixture.componentRef.setInput('inputId','inventory-photos');
  fixture.componentRef.setInput('cropSquare',true);
  fixture.componentRef.setInput('maxSizeMb',10);
  fixture.detectChanges();
  const selected:File[][]=[];
  fixture.componentInstance.filesSelected.subscribe(files=>selected.push([...files]));
  const input=fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:[
   new File(['original'],'original.jpg',{type:'image/jpeg'})]});
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();fixture.detectChanges();
  expect(selected).toEqual([]);
  expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('tamaño no permitido');
  fixture.destroy();
 });

});
