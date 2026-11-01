import {matchesPracticeItem} from './learning.js?v=0.56.0';
export const TEXTBOOK_KEY='study-beat-textbooks-v1';
export function availableTextbookSeries(data){
 return [...new Set((data?.books || []).map(b=>b.series))].map(id=>{
  const books=data.books.filter(b=>b.series===id);
  return {id,title:books[0].title.replace(/ [123]$/,''),publisher:books[0].publisher,available:books.some(b=>b.units.some(u=>u.items.length)),status:books[0].status};
 });
}
export function normalizeTextbookSettings(raw,data){
 const allowed=availableTextbookSeries(data).filter(s=>s.available).map(s=>s.id);
 const valid=raw?.version===1 && raw.usageYear===data?.usageYear;
 const series=valid&&allowed.includes(raw.series)?raw.series:'';
 const unitsByCourse={};
 for(const [course,units] of Object.entries(valid&&raw.unitsByCourse||{})){
  const year=course.split(':').at(-1),books=(data?.books||[]).filter(b=>b.series===series&&(year==='exam'||b.year===Number(year)));
  const ids=new Set(books.flatMap(b=>b.units.map(u=>u.id)));
  if(/^中学:英語:(1|2|3|exam)$/.test(course))unitsByCourse[course]=Array.isArray(units)?[...new Set(units.filter(id=>ids.has(id)))]:null;
 }
 return {version:1,usageYear:data?.usageYear || 2026,series,unitsByCourse};
}
export function textbookBooks(data,settings,course){
 if(!settings?.series || !/^中学:英語:(1|2|3|exam)$/.test(course||''))return [];
 const year=course.split(':').at(-1);
 return (data?.books||[]).filter(b=>b.series===settings.series&&(year==='exam'||b.year===Number(year)));
}
export function textbookUnits(data,settings,course){return textbookBooks(data,settings,course).flatMap(book=>book.units.map(unit=>({...unit,bookId:book.id,year:book.year,bookNumber:book.bookNumber})));}
export function selectTextbookQuestions(items,data,settings,selection,{allUnits=false}={}){
 const units=textbookUnits(data,settings,selection?.id),selected=allUnits?null:settings?.unitsByCourse?.[selection?.id];
 const allowed=new Map();
 for(const unit of units){if(Array.isArray(selected)&&!selected.includes(unit.id))continue;
  for(const row of unit.items)if(!allowed.has(row.sourceId))allowed.set(row.sourceId,{unit,page:row.page});
 }
 return items.filter(item=>allowed.has(item.id)&&item.school_level==='中学'&&item.subject==='英語'&&matchesPracticeItem(item,selection?.practiceType || 'all')).map(item=>{
  const {unit,page}=allowed.get(item.id);return {...item,grade:`中${unit.year}`,textbook:{bookId:unit.bookId,usageYear:data.usageYear,editionYear:data.editionYear,unitId:unit.id,bookNumber:unit.bookNumber,page}};
 });
}
