export const SCHOOLS = ['中学', '高校'];
const subjects = { 中学: ['理科', '英語', '国語', '数学', '社会'], 高校: ['国語', '数学', '英語', '理科', '地歴・公民'] };
export const sectionKey = item => JSON.stringify([item.field, item.unit]);
export function buildCatalog(items) {
  return SCHOOLS.flatMap(school => subjects[school].flatMap(subject => [1, 2, 3, 'exam'].map(year => {
    const grade = `${school === '中学' ? '中' : '高'}${year}`;
    const matches = items.filter(item => item.school_level === school && item.subject === subject && (year === 'exam' || item.grade === grade));
    const sections = [...new Set(matches.map(sectionKey))].map(key => {
      const [field, unit] = JSON.parse(key);
      return { key, label: field === unit ? field : `${field} / ${unit}`, count: matches.filter(item => sectionKey(item) === key).length };
    });
    return { id: `${school}:${subject}:${year}`, school, subject, year, label: year === 'exam' ? `${subject}・受験用` : `${year}年${subject}`,
      count: matches.length, grades: [...new Set(matches.map(item => item.grade))], sections, ids: matches.map(item => item.id) };
  })));
}
export function normalizePreferences(raw, catalog) {
  const school = SCHOOLS.includes(raw?.school) ? raw.school : '';
  const profiles = Object.fromEntries(SCHOOLS.map(level => {
    const entry = raw?.profiles?.[level];
    const course = catalog.find(course => course.id === entry?.id && course.school === level && course.count > 0);
    if (!course) return [level, null];
    const sections = Array.isArray(entry.sections) ? [...new Set(entry.sections.filter(key => course.sections.some(section => section.key === key)))] : null;
    return [level, { id: course.id, sections }];
  }));
  return { school, profiles };
}
export function selectQuestions(items, school, selection, catalog) {
  if (!SCHOOLS.includes(school) || !selection) return [];
  const course = catalog.find(course => course.id === selection.id && course.school === school);
  if (!course) return [];
  const allowed = new Set(course.ids);
  const sections = Array.isArray(selection.sections) ? new Set(selection.sections) : null;
  const seen = new Set();
  return items.filter(item => {
    if (item.school_level !== school || !allowed.has(item.id) || seen.has(item.id) || (sections && !sections.has(sectionKey(item)))) return false;
    seen.add(item.id); return true;
  });
}
