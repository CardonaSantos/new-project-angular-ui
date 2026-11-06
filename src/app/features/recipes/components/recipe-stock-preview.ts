import {Component,computed,input} from '@angular/core';
import {formatDecimal,formatCurrency} from '../../../shared/formatting';
import type {RecipeStockPreview} from '../data-access/recipes.models';

/**
 * Shared "ingredientes necesarios" result table. Both /recipes/check and the
 * production-run form were computing and rendering this same shape
 * (RecipeStockPreview) with two separate, drifting copies of the markup;
 * this component is the single source of truth for both.
 */
@Component({
 selector:'gc-recipe-stock-preview',
 imports:[],
 template:`
 <div class="rec-top"><h2>{{title()}}</h2><strong>{{statusText()}}</strong></div>
 @if(result().insuficientes?.length){
  <div class="rec-table-wrap"><table class="rec-table">
   <thead><tr><th>Ingrediente</th><th>Necesario</th><th>Disponible</th><th>Faltante</th></tr></thead>
   <tbody>
    @for(x of result().insuficientes??[];track x.articuloId){
     <tr><td>{{x.articulo?.nombre??'Ingrediente'}}</td>
      <td>{{qty(x.requerido,x.articulo?.unidadBase?.codigo)}}</td>
      <td>{{qty(x.disponible,x.articulo?.unidadBase?.codigo)}}</td>
      <td>{{qty(x.faltante,x.articulo?.unidadBase?.codigo)}}</td></tr>
    }
   </tbody>
  </table></div>
 }
 <div class="rec-table-wrap"><table class="rec-table">
  <thead><tr><th>Ingrediente</th><th>Cantidad {{showLots()?'prevista':'necesaria'}}</th><th>Ubicación</th>
   @if(showLots()){<th>Lote</th>}
   @if(showCosts();as show){@if(show){<th>Costo estimado</th>}}
  </tr></thead>
  <tbody>
   @for(x of result().consumos??[];track $index){
    <tr><td>{{x.articulo?.nombre??'Ingrediente'}}</td>
     <td>{{qty(x.cantidad,x.articulo?.unidadBase?.codigo)}}</td>
     <td>{{x.ubicacion?.nombre??(showLots()?'Por determinar':'—')}}</td>
     @if(showLots()){<td>{{x.lote?.codigoLote??'Sin lote'}}</td>}
     @if(showCosts()){<td>{{x.costoTotal!==null&&x.costoTotal!==undefined?money(x.costoTotal):'—'}}</td>}
    </tr>
   } @empty {<tr><td [attr.colspan]="emptyColspan()">No hay consumos calculados para mostrar.</td></tr>}
  </tbody>
 </table></div>
 @if(result().costoEstimado!==null&&result().costoEstimado!==undefined&&canSeeCosts()){
  <p><strong>Costo estimado: {{money(result().costoEstimado!)}}</strong></p>
 }
 <p class="rec-note">{{note()}}</p>
 `,
 styleUrl:'../recipes.scss'
})
export class GcRecipeStockPreview {
 readonly result=input.required<RecipeStockPreview>();
 /** Whether the caller's permissions allow showing cost figures at all. */
 readonly canSeeCosts=input(false);
 /** Production runs show a destination lot per line and use "cantidad prevista";
  *  the plain /recipes/check simulation shows neither. */
 readonly showLots=input(false);
 readonly title=input('Resultado de la comprobación');
 readonly note=input('Esta comprobación no reserva ingredientes ni descuenta inventario.');
 protected readonly showCosts=computed(()=>this.result().costoEstimado!==undefined&&this.canSeeCosts());
 protected statusText(){
  const r=this.result();
  if(r.requiereUbicacion)return 'Elige una ubicación';
  return r.disponible===true?'Hay ingredientes suficientes':
   r.disponible===false?'Faltan ingredientes':'Revisión de ingredientes';
 }
 protected emptyColspan(){return 3+(this.showLots()?1:0)+(this.showCosts()?1:0)}
 protected readonly money=formatCurrency;
 protected readonly qty=(n?:string|null,unit?:string)=>{
  try{return n==null?'—':formatDecimal(n)+' '+(unit??'')}catch{return '—'}
 };
}
