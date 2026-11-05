import type {CatalogVariant} from '../../catalog/data-access/catalog.models';
import type {Article,Unit} from '../../inventory/data-access/inventory.models';

export type RecipeKind='VENTA'|'PRODUCCION';
export type PackagingScope='ARTICULO'|'ORDEN';
export type PackagingMode='MESA'|'MOSTRADOR'|'PARA_LLEVAR'|'DELIVERY';
export type ModifierEffect='SUMAR'|'RESTAR'|'SUSTITUIR';
export const PACKAGING_MODES:readonly {value:PackagingMode;label:string}[]=[
 {value:'MESA',label:'En mesa'}, {value:'MOSTRADOR',label:'En mostrador'},
 {value:'PARA_LLEVAR',label:'Para llevar'}, {value:'DELIVERY',label:'A domicilio'},
];
export const EFFECTS:readonly {value:ModifierEffect;label:string}[]=[
 {value:'SUMAR',label:'Agregar ingrediente'}, {value:'RESTAR',label:'Quitar ingrediente'},
 {value:'SUSTITUIR',label:'Cambiar ingrediente'},
];
export interface RecipePage<T>{data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}
export interface RecipeComponent {
 id:string;articuloId:string;unidadId:string;cantidad:string;mermaPorcentaje:string;
 articulo?:(Pick<Article,'id'|'codigo'|'nombre'>&{unidadBase?:Unit})|null;unidad?:Unit|null;
}
export interface RecipeComponentInput {articuloId:string;unidadId:string;cantidad:string;mermaPorcentaje?:string}
export interface RecipeVersion {
 id:string;recetaId:string;numero:number;rendimiento:string;
 unidadRendimientoId:string;unidadRendimiento?:Unit|null;
 publicadaEn:string|null;activa:boolean;creadaEn:string;vidaUtilDias:number|null;
 recetaComponentesComoRecetaVersion?:RecipeComponent[];
}
export interface RecipeRecord {
 id:string;nombre:string;tipo:RecipeKind;activa:boolean;
 varianteId:string|null;articuloResultadoId:string|null;
 variante?:CatalogVariant|null;articuloResultado?:Article|null;
 recetaVersionesComoReceta?:RecipeVersion[];versionPublicada?:RecipeVersion|null;
}
export interface RecipeOption {
 id:string;label:string;tipo:RecipeKind;activa:boolean;
 versionActiva:number|null;versionActivaId:string|null;
 destino:{id:string|null;nombre:string;presentacion?:string};
 rendimiento:{cantidad:string;unidad:Unit}|null;
}
export interface RecipeCoverage {
 total:number;recetasVenta:number;recetasProduccion:number;publicadas:number;
 variantesPreparadasActivas:number;variantesSinRecetaPublicada:number;
 pendientes:RecipePage<{id:string;nombre:string;sku:string|null;motivo:string;
  producto:{id:string;nombre:string;codigo:string}}>;
}
export interface RecipeVersionInput {
 unidadRendimientoId:string;rendimiento:string;vidaUtilDias?:number;
 componentes:RecipeComponentInput[];publicar?:boolean;
}
export interface RecipeCreate {
 nombre:string;tipo:RecipeKind;varianteId?:string;articuloResultadoId?:string;
 version?:RecipeVersionInput;
}
export interface ModifierPhysicalComponent extends RecipeComponent {
 efecto:ModifierEffect;sustituyeArticuloId:string|null;
 sustituyeArticulo?:Pick<Article,'id'|'codigo'|'nombre'>|null;
}
export interface ModifierComposition {
 id:string;nombre:string;activo:boolean;requiereComposicion:boolean;grupoId:string;
 modificadorComponentesComoModificador:ModifierPhysicalComponent[];
}
export interface ModifierPhysicalInput extends RecipeComponentInput {
 efecto:ModifierEffect;sustituyeArticuloId?:string;
}
export interface PackagingLine {
 id:string;articuloId:string;cantidad:string;articulo?:Article|null;
}
export interface PackagingRule {
 id:string;nombre:string;alcance:PackagingScope;modalidad:PackagingMode;activa:boolean;
 varianteId:string|null;sucursalId:string|null;
 variante?:CatalogVariant|null;sucursal?:{id:string;nombre:string}|null;
 reglaEmpaqueLineasComoRegla:PackagingLine[];
}
export interface PackagingRuleInput {
 nombre:string;alcance:PackagingScope;modalidad:PackagingMode;
 varianteId?:string;sucursalId?:string;lineas:{articuloId:string;cantidad:string}[];
}
export interface RecipePreview {
 recetaVersionId:string;sucursalId:string;requiereUbicacion?:boolean;
 ingredientes?:{articuloId:string;articulo?:Article|null;cantidad:string;unidadId:string;unidad?:Unit|null;mermaPorcentaje:string}[];
}

// REC-UI 2: all quantities remain decimal strings; costs are absent without authorization.
export type ProductionStatus='BORRADOR'|'CONFIRMADA'|'CANCELADA';
export interface ProductionInput {
 recetaVersionId:string;ubicacionDestinoId:string;ubicacionConsumoId?:string;
 cantidadProducida:string;claveOperacion:string;fechaVencimiento?:string;
 origenes?:{articuloId:string;ubicacionId:string;loteId?:string}[];
}
export interface ProductionListItem {
 id:string;estado:ProductionStatus;receta:string;recetaVersion:number;
 ubicacion:string;cantidadProducida:string;articuloResultado:Article|null;
 unidadResultado:Unit|null;lote:string|null;confirmadoEn:string|null;
 creadoEn:string;costoTotal?:string|null;
}
export interface ProductionDetail {
 id:string;estado:ProductionStatus;recetaVersion:RecipeVersion&{receta:RecipeRecord};
 ubicacionDestino:{id:string;nombre:string;almacenId:string;almacen?:{sucursalId:string}};
 articuloResultado:Article|null;cantidadProducida:string;
 loteResultado?:{codigoLote:string}|null;fechaVencimiento:string|null;
 confirmadoEn:string|null;creadoEn:string;costoTotal?:string|null;
 consumos:{id:string;articulo:Pick<Article,'id'|'codigo'|'nombre'>;
  ubicacion:{id:string;nombre:string};lote:{id:string;codigoLote:string}|null;
  cantidad:string;costoUnitario?:string;costoTotal?:string|null}[];
}
export interface ProductionReport {
 sucursalId:string;periodo:{desde:string|null;hastaExclusiva:string|null};
 produccionesConfirmadas:number;
 articulos:{articuloId:string;codigo:string;nombre:string;unidad:string;
  cantidad:string;costoTotal?:string}[];
 costoTotal?:string;
}
export interface MaterialRequirement {
 articuloId:string;articulo?:Article|null;
 requerido:string;disponible:string;faltante?:string;
}
export interface ConsumptionPreview {
 articuloId:string;articulo?:Article|null;
 ubicacion?:{id:string;nombre:string}|null;
 lote?:{id:string;codigoLote:string}|null;
 cantidad:string;costoTotal?:string|null;
}
export interface RecipeStockPreview extends RecipePreview {
 disponible?:boolean;cantidad?:string;
 insuficientes?:MaterialRequirement[];consumos?:ConsumptionPreview[];
 costoEstimado?:string|null;
}
export interface RecipeQuoteInput {
 recetaVersionId:string;sucursalId:string;ubicacionId?:string;cantidad?:string;
 modificadores?:string[];modalidad?:PackagingMode;
}
