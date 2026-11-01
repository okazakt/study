// Finite, authored presentations of one learning point. Identity and totals stay shared.
const fields = ['prompt','answer','dummies','note'];
export function normalizePatternUsage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key,row])=>key && row && Number.isSafeInteger(row.count) && row.count>=0 && Number.isFinite(row.lastAt) && row.lastAt>=0).map(([key,row])=>[key,{count:row.count,lastAt:row.lastAt}]));
}
export function choicePresentations(item) {
  const base=item.presentationBase || Object.fromEntries(fields.map(field=>[field,item[field]]));
  const patterns=[{...base,id:'base'},...(item.presentations || [])];
  if(new Set(patterns.map(p=>p.id)).size!==patterns.length)throw new Error(`${item.id}: duplicate presentation ID`);
  for(const pattern of patterns){
    if(!pattern.id || !pattern.prompt || !pattern.answer || typeof pattern.note!=='string' || !Array.isArray(pattern.dummies) || pattern.dummies.length!==3 || new Set([pattern.answer,...pattern.dummies]).size!==4)throw new Error(`${item.id}: invalid presentation`);
  }
  return patterns;
}
export function materializeChoiceItem(item,random=Math.random,usage={},previous='') {
  if(!item.presentations?.length)return item;
  const patterns=choicePresentations(item),source=item.sourceId || item.id;
  const signature=p=>JSON.stringify([source,p.id]);
  const candidates=patterns.filter(p=>signature(p)!==previous);
  const stats=normalizePatternUsage(usage),rank=p=>[stats[p.id]?.count || 0,stats[p.id]?.lastAt || 0];
  const compare=(a,b)=>a[0]-b[0] || a[1]-b[1];
  const best=candidates.map(rank).sort(compare)[0];
  const tied=candidates.filter(p=>compare(rank(p),best)===0),selected=tied[Math.min(tied.length-1,Math.floor(random()*tied.length))];
  return {...item,...Object.fromEntries(fields.map(field=>[field,selected[field]])),presentationBase:item.presentationBase || Object.fromEntries(fields.map(field=>[field,item[field]])),
    variant:{generator:'choice_text',version:1,parameters:{pattern:selected.id},signature:signature(selected)}};
}
