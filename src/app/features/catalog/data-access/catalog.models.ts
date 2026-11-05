/** CAT-A: types mirror src/modules/catalog/presentation/http/dto/catalog.dto.ts (main, 2026-11-02).
 * Technical identifiers are transported but never rendered as user-facing labels. */
export type CatalogKind='PREPARADO'|'INVENTARIABLE'|'SERVICIO';
export const PRODUCT_KINDS:readonly {value:CatalogKind;label:string}[]=[
 {value:'PREPARADO',label:'Preparado'},
 {value:'INVENTARIABLE',label:'Producto físico'},
 {value:'SERVICIO',label:'Servicio'},
];
export type CatalogPermission='catalog.read'|'catalog.manage'|'catalog.prices.manage'|
 'catalog.menus.manage'|'catalog.reports.read';

export interface CatalogPage<T>{
 data:T[];meta:{page:number;limit:number;total:number;totalPages:number;alcance?:string};
}
export interface CatalogOptions<T>{
 data:T[];meta:{hasMore:boolean;nextCursor:string|null};
}
export interface CatalogPageQuery {
 page?:number;limit?:number;search?:string;activo?:boolean;
}
export interface CatalogOptionsQuery {
 search?:string;cursor?:string;limit?:number;
}
export interface CatalogPhoto {
 mediaId:string;principal:boolean;orden:number;url:string;
}
export interface CatalogImages {
 imagenes?:CatalogPhoto[];imagenPrincipalUrl?:string|null;
}
export interface CatalogCategory extends CatalogImages {
 id:string;nombre:string;parentId:string|null;orden:number;activa:boolean;
 parent?:{id:string;nombre:string;parentId?:string|null}|null;
 _count?:{productosComoCategoria:number;categoriasComoParent:number};
 children?:CatalogCategory[];totalProductos?:number;
}
export interface CatalogCategoryOption {id:string;label:string;parentId:string|null}
export interface CatalogCategoryCreate {nombre:string;parentId?:string|null;orden?:number}
export type CatalogCategoryPatch=Partial<CatalogCategoryCreate>;
export interface CatalogArticleLink {id:string;codigo:string;nombre:string;activo:boolean}
export interface CatalogVariant extends CatalogImages {
 id:string;nombre:string;sku:string|null;orden:number;activo:boolean;
 productoId?:string;articuloInventarioId?:string|null;
 articuloInventario?:CatalogArticleLink|null;
 producto?:{id:string;nombre:string;codigo:string;tipo:CatalogKind;activo:boolean;visibleEnMenu:boolean};
 varianteGrupoModificadoresComoVariante?:CatalogVariantGroupLink[];
 precioVigente?:string|null;habilitadaSucursal?:boolean;pausadaHasta?:string|null;
 label?:string;
}
export interface CatalogProduct extends CatalogImages {
 id:string;codigo:string;nombre:string;descripcion:string|null;
 categoriaId?:string|null;categoria?:CatalogCategory|null;
 tipo:CatalogKind;activo:boolean;visibleEnMenu:boolean;
 varianteProductosComoProducto?:CatalogVariant[];
 variantesPrecios?:{varianteId:string;importe:string|null;sucursalId:string}[];
 label?:string;
}
export interface CatalogVariantInput {
 nombre:string;sku?:string|null;articuloInventarioId?:string|null;orden?:number;
}
export interface CatalogProductCreate {
 codigo:string;nombre:string;descripcion?:string|null;categoriaId?:string|null;
 tipo:CatalogKind;variantes?:CatalogVariantInput[];
}
export interface CatalogInlineArticle {
 codigo:string;nombre:string;unidadBaseId?:string;
 requiereLote?:boolean;requiereVencimiento?:boolean;
}
export interface CatalogSetupVariant extends CatalogVariantInput {
 precio?:string;nuevoArticulo?:CatalogInlineArticle;
}
export interface CatalogProductSetup extends Omit<CatalogProductCreate,'variantes'> {
 sucursalId?:string;variantes:CatalogSetupVariant[];
}
export interface CatalogProductSetupResult extends CatalogProduct{
 preciosConfigurados:{varianteId:string;nombre:string;importe:string;sucursalId:string}[];
}
export interface CatalogBatchPriceResult {
 guardados:number;precios:{id:string;varianteId:string;sucursalId:string;importe:string}[];
}
export type CatalogProductPatch=Partial<Pick<CatalogProduct,'nombre'|'descripcion'|'categoriaId'|'visibleEnMenu'>>;
export type CatalogVariantPatch=Partial<CatalogVariantInput>&{activo?:boolean};
export interface CatalogVariantBranchPatch {
 sucursalId:string;habilitada:boolean;pausadaHasta?:string|null;motivo?:string|null;
}
export interface CatalogGroup {
 id:string;nombre:string;minimo:number;maximo:number|null;activo:boolean;
 modificadoresComoGrupo?:CatalogModifier[];_count?:{varianteGrupoModificadoresComoGrupo:number};label?:string;
}
export interface CatalogGroupCreate {nombre:string;minimo:number;maximo?:number|null}
export type CatalogGroupPatch=Partial<CatalogGroupCreate>&{activo?:boolean};
export interface CatalogModifier {
 id:string;grupoId:string;nombre:string;incrementoPrecio:string;requiereComposicion:boolean;
 activo:boolean;grupo?:CatalogGroup;
}
export interface CatalogModifierCreate {
 grupoId:string;nombre:string;incrementoPrecio:string;requiereComposicion?:boolean;
}
export type CatalogModifierPatch=Partial<Omit<CatalogModifierCreate,'grupoId'>>&{activo?:boolean};
export interface CatalogVariantGroupLink {
 grupoId:string;orden:number;obligatorio:boolean;grupo?:CatalogGroup;
}
export interface CatalogGroupAttachment {grupoId:string;orden:number;obligatorio:boolean}
export interface CatalogPriceCreate {
 entityId:string;sucursalId:string;importe:string;vigenteDesde:string;vigenteHasta?:string|null;
}
export interface CatalogPrice {
 id:string;importe:string;vigenteDesde:string;vigenteHasta:string|null;
 sucursalId:string;varianteId?:string;modificadorId?:string;
}
export interface CatalogResolvedPrice {
 varianteId:string;sucursalId:string;moneda:string;importe:string|null;
 vigenteDesde:string|null;vigenteHasta:string|null;habilitada:boolean;motivo:string|null;
}
export interface CatalogQuoteInput {
 varianteId:string;sucursalId:string;modificadorIds:string[];fecha?:string;
}
export interface CatalogQuote {
 varianteId:string;sucursalId:string;fecha:string;moneda:string;
 precioBase:string;modificadores:{modificadorId:string;nombre:string;grupoId:string;incremento:string}[];
 total:string;advertencia:string;
}
export type CatalogReadinessWarning=
 'SUCURSAL_INACTIVA'|'PRODUCTO_O_VARIANTE_INACTIVA'|'OCULTA_EN_MENU'|
 'SIN_PRECIO'|'PAUSADA_EN_SUCURSAL'|'SIN_FOTOGRAFIA_CONFIRMADA'|
 'ARTICULO_FISICO_INVALIDO'|'VARIANTE_NO_EXISTE'|string;
export interface CatalogVariantReadiness {
 varianteId:string;sucursalId:string;lista:boolean;advertencias:CatalogReadinessWarning[];
 precio?:string|null;receta?:string;cocina?:string;stock?:string;
}
export interface CatalogProductReadiness {
 productoId:string;sucursalId:string;lista:boolean;variantes:CatalogVariantReadiness[];
}
export interface CatalogMenuSectionItem {
 varianteId:string;orden:number;activo?:boolean;
 variante?:CatalogVariant;
}
export interface CatalogMenuSection {
 id?:string;nombre:string;orden:number;activo?:boolean;items:CatalogMenuSectionItem[];
}
export interface CatalogMenuSchedule {
 diaSemana:number;desde:string;hasta:string;activo?:boolean;
}
export interface CatalogMenu {
 id:string;codigo:string;nombre:string;descripcion:string|null;activo:boolean;
 version:number;publicadoEn:string|null;
 sucursales:{sucursalId:string;activa:boolean;sucursal?:{id:string;codigo:string;nombre:string;activa:boolean}}[];
 secciones:CatalogMenuSection[];horarios:CatalogMenuSchedule[];
}
export interface CatalogMenuCreate {
 codigo:string;nombre:string;descripcion?:string|null;sucursalIds:string[];
}
export type CatalogMenuPatch=Partial<Pick<CatalogMenu,'nombre'|'descripcion'|'activo'>>;
export interface CatalogMenuLayout {
 expectedVersion:number;sucursalIds:string[];
 secciones:{nombre:string;orden:number;items:{varianteId:string;orden:number}[]}[];
 horarios:{diaSemana:number;desde:string;hasta:string}[];
}
export interface CatalogProjectedModifier {
 id:string;nombre:string;recargo:string;
}
export interface CatalogProjectedGroup {
 grupoId:string;grupo:string;orden:number;minimo:number;maximo:number|null;
 opciones:CatalogProjectedModifier[];
}
export interface CatalogProjectedItem {
 id:string;orden:number;variante:CatalogVariant;
 gruposModificadores:CatalogProjectedGroup[];
 precio:string;moneda:string;stock:string;
}
export interface CatalogProjectedMenu {
 id:string;codigo:string;nombre:string;descripcion:string|null;
 secciones:{id:string;nombre:string;orden:number;items:CatalogProjectedItem[]}[];
}
export interface CatalogBranchMenu {
 sucursalId:string;fecha:string;horaLocal:string;menus:CatalogProjectedMenu[];nota:string;
}
export interface CatalogSummary {
 alcance:string;fecha:string;
 categoriasActivas:number;productosActivos:number;variantesActivas:number;
 gruposActivos:number;modificadoresActivos:number;menusPublicados:number;
 productosVisibles:number;productosSinImagen:number;
 productosPorTipo:{tipo:CatalogKind;cantidad:number}[];
 sucursales:CatalogPriceCoverage[];ventas:null;rentabilidad:null;nota:string;
}
export interface CatalogPriceCoverage {
 sucursalId:string;codigo?:string;nombre?:string;activa?:boolean;
 variantesVisibles?:number;conPrecio?:number;sinPrecio?:number;
 vendiblesPorPrecioYEstado?:number;menusPublicados?:number;
 productosConImagen?:number;fecha?:string;nota?:string;autorizada?:boolean;
}
