import {HttpClient,HttpParams} from '@angular/common/http';
import {Injectable,inject} from '@angular/core';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 RecipeKind,RecipePage,RecipeRecord,RecipeOption,RecipeCoverage,RecipeCreate,
 RecipeVersionInput,RecipeVersion,ModifierComposition,ModifierPhysicalInput,
 PackagingRule,PackagingRuleInput,RecipePreview
} from './recipes.models';

export const recipePaths={
 list:'/api/recipes',options:'/api/recipes/options',preview:'/api/recipes/preview',
 coverage:'/api/recipes/reports/coverage',
 recipe:(id:string)=>'/api/recipes/'+encodeURIComponent(id),
 versions:(id:string)=>'/api/recipes/'+encodeURIComponent(id)+'/versions',
 version:(id:string)=>'/api/recipes/versions/'+encodeURIComponent(id),
 publish:(id:string)=>'/api/recipes/versions/'+encodeURIComponent(id)+'/publish',
 versionPreview:(id:string)=>'/api/recipes/versions/'+encodeURIComponent(id)+'/preview',
 modifier:(id:string)=>'/api/recipes/modifiers/'+encodeURIComponent(id)+'/components',
 packaging:'/api/recipes/packaging',
 packagingOne:(id:string)=>'/api/recipes/packaging/'+encodeURIComponent(id),
 packagingStatus:(id:string)=>'/api/recipes/packaging/'+encodeURIComponent(id)+'/status',
} as const;
export function recipeParams(query:object):HttpParams{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(query)){
  if(value!==undefined&&value!==null&&value!=='')params=params.set(key,String(value));
 }
 return params;
}
const silent={context:gcSilentRequest()};
const params=(query:object)=>({...silent,params:recipeParams(query)});
export interface RecipeListQuery {
 page?:number;limit?:number;search?:string;tipo?:RecipeKind;
 varianteId?:string;articuloResultadoId?:string;vista?:'RESUMEN'|'COMPLETA';
}
@Injectable({providedIn:'root'})
export class RecipesApi {
 private readonly http=inject(HttpClient);
 list(q:RecipeListQuery={}){
  return this.http.get<RecipePage<RecipeRecord>>(recipePaths.list,params({...q,vista:'RESUMEN'}));
 }
 options(q:RecipeListQuery={}){
  return this.http.get<RecipePage<RecipeOption>>(recipePaths.options,params(q));
 }
 detail(id:string){return this.http.get<RecipeRecord>(recipePaths.recipe(id),silent)}
 create(dto:RecipeCreate){return this.http.post<RecipeRecord>(recipePaths.list,dto,silent)}
 update(id:string,patch:{nombre?:string;activa?:boolean}){
  return this.http.patch<RecipeRecord>(recipePaths.recipe(id),patch,silent);
 }
 addVersion(id:string,dto:RecipeVersionInput){
  return this.http.post<RecipeVersion>(recipePaths.versions(id),dto,silent);
 }
 editVersion(id:string,dto:RecipeVersionInput){
  return this.http.put<RecipeVersion>(recipePaths.version(id),dto,silent);
 }
 publish(id:string){return this.http.post<RecipeVersion>(recipePaths.publish(id),{},silent)}
 preview(id:string,q:{sucursalId:string;ubicacionId?:string;cantidad?:string}){
  return this.http.get<RecipePreview>(recipePaths.versionPreview(id),params(q));
 }
 coverage(q:{search?:string;page?:number;limit?:number}={}){
  return this.http.get<RecipeCoverage>(recipePaths.coverage,params(q));
 }
 modifier(id:string){return this.http.get<ModifierComposition>(recipePaths.modifier(id),silent)}
 setModifier(id:string,componentes:ModifierPhysicalInput[]){
  return this.http.put<ModifierComposition>(recipePaths.modifier(id),{componentes},silent);
 }
 packaging(q:{sucursalId?:string;varianteId?:string}={}){
  return this.http.get<PackagingRule[]>(recipePaths.packaging,params(q));
 }
 packagingOne(id:string){return this.http.get<PackagingRule>(recipePaths.packagingOne(id),silent)}
 createPackaging(dto:PackagingRuleInput){
  return this.http.post<PackagingRule>(recipePaths.packaging,dto,silent);
 }
 updatePackaging(id:string,dto:PackagingRuleInput){
  return this.http.put<PackagingRule>(recipePaths.packagingOne(id),dto,silent);
 }
 packagingStatus(id:string,activa:boolean){
  return this.http.patch<{id:string;activa:boolean}>(recipePaths.packagingStatus(id),{activa},silent);
 }
}
