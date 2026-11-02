
import {computed,effect,inject,Injectable} from '@angular/core';
import {ActivatedRoute,Router} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';

const limits=[5,10,20,25,50] as const;
export interface InventoryFilters {page:number;limit:number;search:string;estado:string;tipo:string;almacenId:string;
 articuloId:string;ubicacionId:string;loteId:string;sucursalId:string}
export function sanitizeInventoryPage(raw:string|null,defaultValue:number,max:number):number{
 const value=Number(raw);
 return raw!==null&&/^\d+$/.test(raw)&&Number.isInteger(value)&&value>0&&value<=max?value:defaultValue;
}
/** URL is the source of truth for filters. Back/forward and reload replay the exact query. */
@Injectable()
export class InventoryUrlState {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly branch=inject(GcBranchContext);
 readonly params=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 readonly filters=computed<InventoryFilters>(()=>{
  const p=this.params(),authorized=this.branch.branches();
  const requested=p.get('sucursalId');
  const branchId=requested&&authorized.some(b=>b.id===requested)?requested:
   (this.branch.branchId()??authorized[0]?.id??'');
  const rawLimit=sanitizeInventoryPage(p.get('limit'),20,50);
  return {
   page:sanitizeInventoryPage(p.get('page'),1,100000),
   limit:limits.includes(rawLimit as typeof limits[number])?rawLimit:20,
   search:(p.get('search')??'').slice(0,100),
   estado:(p.get('estado')??'').slice(0,36),
   tipo:(p.get('tipo')??'').slice(0,40),
   almacenId:p.get('almacenId')??'',articuloId:p.get('articuloId')??'',
   ubicacionId:p.get('ubicacionId')??'',loteId:p.get('loteId')??'',sucursalId:branchId,
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
