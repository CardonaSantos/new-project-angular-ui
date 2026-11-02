/** A remote search is only a partial list. Keep the saved or edited choice visible. */
export function keepSelected<T extends {id:string}>(
 entries:readonly T[],selected:T|null|undefined
):T[]{
 if(!selected)return [...entries];
 return entries.some(entry=>entry.id===selected.id)?[...entries]:[selected,...entries];
}
export function readableCategory(
 source:{id:string;nombre:string;parentId?:string|null}|null|undefined
){
 if(!source)return null;
 return {id:source.id,nombre:source.nombre,parentId:source.parentId??null,
  orden:0,activa:true};
}
