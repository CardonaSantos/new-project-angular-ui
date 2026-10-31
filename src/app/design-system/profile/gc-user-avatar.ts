
import {Component,computed,effect,input,signal} from '@angular/core';

/** Identity photo, with safe initials fallback for missing or expired private URLs. */
@Component({
 selector:'gc-user-avatar',
 template:`
 <span class="photo" [class.small]="size()==='sm'" [class.large]="size()==='lg'"
   aria-hidden="true">
   @if(url()&&!failed()){
    <img [src]="url()!" alt="" (error)="failed.set(true)" loading="lazy" referrerpolicy="no-referrer"/>
   } @else {
    <span class="initials">{{initials()}}</span>
   }
 </span>`,
 styles:[`
  :host{display:inline-flex;align-items:center;justify-content:center;flex:none}
  .photo{width:2.5rem;height:2.5rem;display:grid;place-items:center;overflow:hidden;
    border:1px solid var(--gc-outline-variant);border-radius:50%;
    background:var(--gc-primary-container);color:var(--gc-on-primary-container);font-weight:700}
  .photo.small{width:2.15rem;height:2.15rem;font-size:.78rem}
  .photo.large{width:5rem;height:5rem;font-size:1.25rem}
  img{display:block;width:100%;height:100%;object-fit:cover}
  .initials{font-size:inherit;text-transform:uppercase}
 `],
})
export class GcUserAvatar {
 readonly name=input('');
 readonly url=input<string|null>(null);
 readonly size=input<'sm'|'md'|'lg'>('md');
 protected readonly failed=signal(false);
 protected readonly initials=computed(()=>this.name().trim().split(/\\s+/).filter(Boolean)
   .slice(0,2).map(part=>part.charAt(0).toLocaleUpperCase()).join('')||'?');
 constructor(){effect(()=>{this.url();this.failed.set(false)})}
}
