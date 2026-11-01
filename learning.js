export const SCHOOLS = ['中学', '高校'];
const subjects = { 中学: ['国語', '英語', '数学', '理科', '社会'], 高校: ['国語', '英語', '数学', '理科', '地歴・公民'] };
export const sectionKey = item => JSON.stringify([item.field, item.unit]);
export function choiceColumns(question) {
  return question.mode !== 'kanji_component' && question.choices.some(text => Array.from(text).length > 12 || /[A-Za-z]{8,}/.test(text)) ? 2 : 4;
}
export function practiceTypes(subject) {
  const options = subject === '国語' ? [['kanji_write','漢字書き'],['kanji_read','漢字読み'],['idiom','熟語'],['modern','現代文法'],['reading','読解のポイント'],['classical','古文'],['kanbun','漢文']]
    : subject === '英語' ? [['word_ja_en','単語和英'],['word_en_ja','単語英和'],['word_spelling','単語綴り'],['phrase_ja_en','熟語和英'],['phrase_en_ja','熟語英和'],['grammar','英文法'],['reading','読解のポイント']] : [];
  return [...options, ['all','全て']].map(([id,label]) => ({id,label}));
}
export function matchesPracticeItem(item, type = 'all') {
  if (type === 'all') return true;
  if (item.subject === '国語') return ({kanji_write:item.kind === 'kanji',kanji_read:item.kind === 'kanji',idiom:item.kind === 'idiom',
    modern:item.field === '現代文文法',reading:item.field === '読解',classical:item.field === '古文文法',kanbun:item.field === '漢文文法'})[type] === true;
  if (item.subject === '英語' && type === 'grammar') return item.field === '英文法';
  if (item.subject === '英語' && type === 'reading') return item.field === '英文読解';
  if (item.subject === '英語') return ['word_ja_en','word_en_ja','word_spelling'].includes(type) ? !!item.english && !item.phrase_blanks
    : ['phrase_ja_en','phrase_en_ja'].includes(type) && !!item.phrase_blanks;
  return false;
}
export function matchesPracticeQuestion(question, type = 'all') {
  if (!matchesPracticeItem(question,type)) return false;
  const mode = {kanji_write:'kanji_component',kanji_read:'kanji_reading',word_ja_en:'to_english',word_en_ja:'to_japanese',
    word_spelling:'spelling',phrase_ja_en:'to_english',phrase_en_ja:'to_japanese'}[type];
  return !mode || question.mode === mode;
}
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
    const practiceType = practiceTypes(course.subject).some(option => option.id === entry.practiceType) ? entry.practiceType : 'all';
    return [level, { id: course.id, sections, practiceType }];
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
    if (item.school_level !== school || !allowed.has(item.id) || seen.has(item.id) || !matchesPracticeItem(item, selection.practiceType || 'all') || (sections && !sections.has(sectionKey(item)))) return false;
    seen.add(item.id); return true;
  });
}
