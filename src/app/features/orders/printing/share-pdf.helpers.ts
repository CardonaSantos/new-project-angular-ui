/** True when the browser can hand a file to the OS share sheet (navigator.share with
 * files) — on a phone this is what lets "Enviar por WhatsApp" open WhatsApp directly
 * with the PDF attached, no download step. Desktop support varies by OS/browser/whether
 * WhatsApp Desktop is registered as a share target, so this is checked live rather than
 * assumed, and the caller falls back to a plain download when it's false. */
export function canShareFiles():boolean{
 return typeof navigator!=='undefined'
  &&typeof navigator.share==='function'&&typeof navigator.canShare==='function';
}

function downloadBlob(blob:Blob,filename:string):void{
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download=filename;link.style.display='none';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}

/** Shares a PDF through the OS share sheet when possible, otherwise downloads it as a
 * plain file. Returns which happened, so the caller can tell the person what to do next
 * only when a share sheet never opened (a silent download needs a word of explanation;
 * the share sheet itself is already the feedback). A user-cancelled share (AbortError)
 * counts as 'shared', not a failure — they saw the sheet and chose to close it. */
export async function sharePdf(blob:Blob,filename:string,title:string,text:string):
 Promise<'shared'|'downloaded'>{
 const file=new File([blob],filename,{type:'application/pdf'});
 if(canShareFiles()&&navigator.canShare({files:[file]})){
  try{await navigator.share({files:[file],title,text});return 'shared'}
  catch(e){if((e as DOMException)?.name==='AbortError')return 'shared'}
 }
 downloadBlob(blob,filename);
 return 'downloaded';
}
