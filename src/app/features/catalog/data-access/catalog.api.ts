import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {throwError} from 'rxjs';
import {API_ENDPOINTS} from '../../../core/http/api-endpoints';
import {gcSilentRequest} from '../../../core/http/api-context';
import type {
 CatalogCategory,CatalogCategoryOption,CatalogCategoryCreate,CatalogCategoryPatch,CatalogProduct,
 CatalogProductCreate,CatalogProductPatch,CatalogVariant,CatalogVariantInput,
 CatalogVariantPatch,CatalogVariantBranchPatch,CatalogGroup,CatalogGroupCreate,
 CatalogGroupPatch,CatalogModifier,CatalogModifierCreate,CatalogModifierPatch,
 CatalogGroupAttachment,CatalogPriceCreate,CatalogPrice,CatalogResolvedPrice,
 CatalogQuoteInput,CatalogQuote,CatalogProductReadiness,CatalogPage,CatalogOptions,
 CatalogPageQuery,CatalogOptionsQuery,CatalogKind,CatalogMenu,CatalogMenuCreate,
 CatalogMenuPatch,CatalogMenuLayout,CatalogBranchMenu,CatalogSummary,CatalogPriceCoverage
} from './catalog.models';

export function catalogParams(values:object):HttpParams{
 let params=new HttpParams();
 for(const [key,value] of Object.entries(values)){
  if(value!==undefined&&value!==null&&value!=='')params=params.set(key,String(value));
 }
 return params;
}
const silent={context:gcSilentRequest()};
const params=(values:object)=>({params:catalogParams(values),...silent});

/** CAT-A's 46 authenticated routes, grouped by the server's domain ownership.
 * No mutation uses automatic retry: prices, menus and publishing have business effects. */
@Injectable({providedIn:'root'})
export class CatalogApi {
 private readonly http=inject(HttpClient);
 private readonly e=API_ENDPOINTS.catalog;

 // Categories: 8 endpoints
 categories(q:CatalogPageQuery={}){
  return this.http.get<CatalogPage<CatalogCategory>>(this.e.categories,params(q));
 }
 categoryTree(){
  return this.http.get<{data:CatalogCategory[];total:number}>(this.e.categoryTree,silent);
 }
 categoryOptions(q:CatalogOptionsQuery={}){
  return this.http.get<CatalogOptions<CatalogCategoryOption>>(this.e.categoryOptions,params(q));
 }
 category(id:string){return this.http.get<CatalogCategory>(this.e.category(id),silent)}
 createCategory(dto:CatalogCategoryCreate){return this.http.post<CatalogCategory>(this.e.categories,dto,silent)}
 updateCategory(id:string,dto:CatalogCategoryPatch){
  return this.http.patch<CatalogCategory>(this.e.category(id),dto,silent);
 }
 categoryStatus(id:string,activo:boolean,motivo:string){
  return this.http.patch<CatalogCategory>(this.e.categoryStatus(id),{activo,motivo},silent);
 }
 categoryMedia(id:string,mediaIds:string[]){
  return this.http.put<{id:string;mediaIds:string[];principalMediaId:string|null}>(
   this.e.categoryMedia(id),{mediaIds},silent);
 }

 // Products: 9 endpoints
 products(q:CatalogPageQuery&{categoriaId?:string;tipo?:CatalogKind}={}){
  return this.http.get<CatalogPage<CatalogProduct>>(this.e.products,params(q));
 }
 productOptions(q:CatalogOptionsQuery&{sucursalId?:string}={}){
  return this.http.get<CatalogOptions<CatalogProduct&{label:string}>>(this.e.productOptions,params(q));
 }
 product(id:string,sucursalId?:string){
  if(!id.trim())return throwError(()=>new Error('No se identificó el producto para consultar su detalle.'));
  return this.http.get<CatalogProduct>(this.e.product(id),params({sucursalId}));
 }
 createProduct(dto:CatalogProductCreate){
  return this.http.post<CatalogProduct>(this.e.products,dto,silent);
 }
 updateProduct(id:string,dto:CatalogProductPatch){
  return this.http.patch<CatalogProduct>(this.e.product(id),dto,silent);
 }
 productStatus(id:string,activo:boolean,motivo:string){
  return this.http.patch<CatalogProduct>(this.e.productStatus(id),{activo,motivo},silent);
 }
 productMedia(id:string,mediaIds:string[]){
  return this.http.put<{id:string;mediaIds:string[];principalMediaId:string|null}>(
   this.e.productMedia(id),{mediaIds},silent);
 }
 createVariant(productId:string,dto:CatalogVariantInput){
  return this.http.post<CatalogVariant>(this.e.productVariants(productId),dto,silent);
 }
 productReadiness(id:string,sucursalId:string,fecha?:string){
  return this.http.get<CatalogProductReadiness>(this.e.productReadiness(id),params({sucursalId,fecha}));
 }

 // Variants: 5 endpoints
 variantOptions(q:CatalogOptionsQuery&{productoId?:string;sucursalId?:string}={}){
  return this.http.get<CatalogOptions<CatalogVariant&{label:string}>>(this.e.variantOptions,params(q));
 }
 variant(id:string,sucursalId?:string){
  return this.http.get<CatalogVariant>(this.e.variant(id),params({sucursalId}));
 }
 updateVariant(id:string,dto:CatalogVariantPatch){
  return this.http.patch<CatalogVariant>(this.e.variant(id),dto,silent);
 }
 variantBranch(id:string,dto:CatalogVariantBranchPatch){
  return this.http.patch<CatalogVariant>(this.e.variantBranch(id),dto,silent);
 }
 variantMedia(id:string,mediaIds:string[]){
  return this.http.put<{id:string;mediaIds:string[];principalMediaId:string|null}>(
   this.e.variantMedia(id),{mediaIds},silent);
 }

 // Modifier groups: 4 endpoints
 modifierGroups(q:CatalogPageQuery={}){
  return this.http.get<CatalogPage<CatalogGroup>>(this.e.modifierGroups,params(q));
 }
 modifierGroupOptions(q:CatalogOptionsQuery={}){
  return this.http.get<CatalogOptions<CatalogGroup&{label:string}>>(this.e.modifierGroupOptions,params(q));
 }
 createModifierGroup(dto:CatalogGroupCreate){
  return this.http.post<CatalogGroup>(this.e.modifierGroups,dto,silent);
 }
 updateModifierGroup(id:string,dto:CatalogGroupPatch){
  return this.http.patch<CatalogGroup>(this.e.modifierGroup(id),dto,silent);
 }

 // Modifier choices: 3 endpoints
 modifiers(q:CatalogPageQuery&{grupoId?:string}={}){
  return this.http.get<CatalogPage<CatalogModifier>>(this.e.modifiers,params(q));
 }
 createModifier(dto:CatalogModifierCreate){
  return this.http.post<CatalogModifier>(this.e.modifiers,dto,silent);
 }
 updateModifier(id:string,dto:CatalogModifierPatch){
  return this.http.patch<CatalogModifier>(this.e.modifier(id),dto,silent);
 }

 // Variant-group associations: 1 endpoint
 attachVariantGroups(id:string,grupos:CatalogGroupAttachment[]){
  return this.http.put<CatalogVariantGroupLinkResult[]>(this.e.variantGroups(id),{grupos},silent);
 }

 // Pricing: 6 endpoints
 createVariantPrice(dto:CatalogPriceCreate){
  return this.http.post<CatalogPrice>(this.e.variantPrices,dto,silent);
 }
 createModifierPrice(dto:CatalogPriceCreate){
  return this.http.post<CatalogPrice>(this.e.modifierPrices,dto,silent);
 }
 variantPriceHistory(id:string,sucursalId:string){
  return this.http.get<CatalogPrice[]>(this.e.variantPriceHistory(id),params({sucursalId}));
 }
 modifierPriceHistory(id:string,sucursalId:string){
  return this.http.get<CatalogPrice[]>(this.e.modifierPriceHistory(id),params({sucursalId}));
 }
 resolvePrice(id:string,sucursalId:string,fecha?:string){
  return this.http.get<CatalogResolvedPrice>(this.e.resolveVariantPrice(id),params({sucursalId,fecha}));
 }
 quote(dto:CatalogQuoteInput){
  return this.http.post<CatalogQuote>(this.e.quote,dto,silent);
 }

 // Menus: 7 endpoints
 menus(q:CatalogPageQuery&{sucursalId?:string}={}){
  return this.http.get<CatalogPage<CatalogMenu>>(this.e.menus,params(q));
 }
 createMenu(dto:CatalogMenuCreate){
  return this.http.post<CatalogMenu>(this.e.menus,dto,silent);
 }
 menu(id:string){return this.http.get<CatalogMenu>(this.e.menu(id),silent)}
 updateMenu(id:string,dto:CatalogMenuPatch){
  return this.http.patch<CatalogMenu>(this.e.menu(id),dto,silent);
 }
 replaceMenuLayout(id:string,dto:CatalogMenuLayout){
  return this.http.put<CatalogMenu>(this.e.menuLayout(id),dto,silent);
 }
 publishMenu(id:string,expectedVersion:number){
  return this.http.post<CatalogMenu>(this.e.menuPublish(id),{expectedVersion},silent);
 }
 unpublishMenu(id:string){
  return this.http.post<CatalogMenu>(this.e.menuUnpublish(id),{},silent);
 }

 // Published menu projection: 1 endpoint, still authenticated
 branchMenu(sucursalId:string,fecha?:string){
  return this.http.get<CatalogBranchMenu>(this.e.branchMenu,params({sucursalId,fecha}));
 }

 // Reporting: 2 endpoints
 summary(sucursalId?:string){
  return this.http.get<CatalogSummary>(this.e.reports.summary,params({sucursalId}));
 }
 priceCoverage(sucursalId:string,fecha?:string){
  return this.http.get<CatalogPriceCoverage>(this.e.reports.coverage,params({sucursalId,fecha}));
 }
}
interface CatalogVariantGroupLinkResult {
 grupoId:string;varianteId:string;orden:number;obligatorio:boolean;
}
