import {computed,inject,Injectable,signal} from '@angular/core';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';

export type PosView='counter'|'tables';
export type ProductLayout='visual'|'compact';
/** Only non-sensitive UI preferences are persisted. Never persist tokens. */
@Injectable({providedIn:'root'})
export class OrdersPreferences{
 private readonly session=inject(GcSessionService);
 private readonly branch=inject(GcBranchContext);
 readonly view=signal<PosView>('counter');
 readonly productLayout=signal<ProductLayout>('visual');
 readonly loadedFor=signal('');
 readonly scope=computed(()=>this.session.user()?.id+'::'+(this.branch.branchId()??'none'));
 private key(){return 'gc:pos:preferences:v1:'+this.scope()}
 load(){
  if(this.loadedFor()===this.scope())return;
  this.loadedFor.set(this.scope());this.view.set('counter');this.productLayout.set('visual');
  try{
   const saved=localStorage.getItem(this.key());
   if(saved){
    const v=JSON.parse(saved) as {view?:PosView;productLayout?:ProductLayout};
    if(v.view==='counter'||v.view==='tables')this.view.set(v.view);
    if(v.productLayout==='compact'||v.productLayout==='visual')this.productLayout.set(v.productLayout);
   }
  }catch{/* Storage is optional; POS remains usable if disabled. */}
 }
 private save(){try{localStorage.setItem(this.key(),JSON.stringify({
  view:this.view(),productLayout:this.productLayout()
 }))}catch{/* No browser storage permissions. */}}
 setView(v:PosView){this.view.set(v);this.save()}
 setLayout(v:ProductLayout){this.productLayout.set(v);this.save()}
}
