/** Angular's static `new` route does NOT populate `paramMap.get('id')`.
 * Only the dynamic detail route has an identifier. */
export function catalogProductRoute(routePath:string|null|undefined,routeId:string|null):{
 isNew:boolean;id:string|null
}{
 if(routePath==='new'||routeId==='new')return {isNew:true,id:null};
 return {isNew:false,id:routeId};
}
