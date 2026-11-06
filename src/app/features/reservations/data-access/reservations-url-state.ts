
import {computed,effect,inject,Injectable} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';

const limits=[5,10,20,25,50] as const;
export interface ReservationFilters{
 page:number;limit:number;sucursalId:string;desde:string;hasta:string;estado:string;search:string;
}
function sanitizePage(raw:string|null,defaultValue:number,max:number):number{
 const value=Number(raw);
 return raw!==null&&/^\d+$/.test(raw)&&Number.isInteger(value)&&value>0&&value<=max?value:defaultValue;
}
/** URL is the source of truth for filters. Back/forward and reload replay the exact query. */
@Injectable()
export class ReservationsUrlState{
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly branch=inject(GcBranchContext);
 readonly params=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 readonly filters=computed<ReservationFilters>(()=>{
  const p=this.params(),authorized=this.branch.branches();
  const requested=p.get('sucursalId');
  const branchId=requested&&authorized.some(b=>b.id===requested)?requested:
   (this.branch.branchId()??authorized[0]?.id??'');
  const rawLimit=sanitizePage(p.get('limit'),20,50);
  return {
   page:sanitizePage(p.get('page'),1,100000),
   limit:limits.includes(rawLimit as typeof limits[number])?rawLimit:20,
   sucursalId:branchId,desde:p.get('desde')??'',hasta:p.get('hasta')??'',
   estado:p.get('estado')??'',search:(p.get('search')??'').slice(0,100),
  };
 });
 constructor(){
  effect(()=>{
   const desired=this.branch.branchId(),branches=this.branch.branches();
   const requested=this.params().get('sucursalId');
   const chosen=desired&&branches.some(b=>b.id===desired)?desired:branches[0]?.id;
   if(!chosen||requested&&branches.some(b=>b.id===requested))return;
   void Promise.resolve().then(()=>this.router.navigate([],{
    relativeTo:this.route,queryParams:{sucursalId:chosen},queryParamsHandling:'merge',replaceUrl:true
   }));
  });
 }
 async patch(patch:Record<string,string|number|null>):Promise<boolean>{
  const params:Record<string,string|null>={};
  for(const [key,value] of Object.entries(patch)){
   params[key]=value===null||value===''||value===1&&key==='page'?null:String(value);
  }
  return this.router.navigate([],{
   relativeTo:this.route,queryParams:params,queryParamsHandling:'merge',
   replaceUrl:false
  });
 }
}
