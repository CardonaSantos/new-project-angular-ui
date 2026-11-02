
import {Injectable,signal} from '@angular/core';
import type {UserRecord} from '../../features/users/data-access/users.models';

/** Avatar is transient, refreshed from Users; signed image URLs must not be persisted. */
@Injectable({providedIn:'root'})
export class GcCurrentAvatarStore {
 readonly url=signal<string|null>(null);
 private activeId:string|null=null;
 private generation=0;

 async loadFor(id:string,fetch:()=>Promise<UserRecord>):Promise<void>{
  const current=++this.generation;
  this.activeId=id;
  this.url.set(null);
  try{
   const user=await fetch();
   if(this.generation===current&&this.activeId===user.id)
    this.url.set(user.profile.avatar.url);
  }catch{
   if(this.generation===current)this.url.set(null);
  }
 }
 updateFrom(user:UserRecord){
  if(!this.activeId||user.id!==this.activeId)return;
  ++this.generation; // An older GET must not replace a successful update.
  this.url.set(user.profile.avatar.url);
 }
 clear(){++this.generation;this.activeId=null;this.url.set(null)}
}
