/**
 * Language-aware count labels — correct Arabic pluralization.
 *
 * Arabic uses four plural categories after numerals:
 *   1        → singular            "1 علاج"
 *   2        → dual                "علاجان"
 *   3–10     → plural (few)        "3 علاجات"
 *   11–99    → accusative singular "11 علاجًا"
 *   0 / 100+ → singular            "100 علاج"
 *
 * English pluralizes only 1 vs many; Turkish never pluralizes after a numeral.
 *
 * The count itself always comes from live data, so the label updates whenever
 * a treatment is added or removed.
 */

const arabicCount = (count, forms) => {
  const n = Math.abs(count);
  const mod100 = n % 100;
  if (n === 0) return `0 ${forms.other}`;
  if (n === 1) return `1 ${forms.one}`;
  if (n === 2) return forms.two;
  if (mod100 >= 3 && mod100 <= 10) return `${n} ${forms.few}`;
  if (mod100 >= 11 && mod100 <= 99) return `${n} ${forms.many}`;
  return `${n} ${forms.other}`;
};

export function pluralCount(count, lang, forms) {
  const n = Math.max(0, Number(count) || 0);
  if (lang === 'ar') return arabicCount(n, forms.ar);
  if (lang === 'tr') return `${n} ${forms.one_tr || forms.one}`;
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

const TREATMENT_FORMS = {
  one: 'treatment',
  other: 'treatments',
  one_tr: 'tedavi',
  ar: { one: 'علاج', two: 'علاجان', few: 'علاجات', many: 'علاجًا', other: 'علاج' },
};

/** "1 treatment" / "علاجان" / "3 علاجات" / "11 علاجًا" */
export const treatmentCountLabel = (count, lang) => pluralCount(count, lang, TREATMENT_FORMS);

const PATIENT_FORMS = {
  one: 'patient',
  other: 'patients',
  one_tr: 'hasta',
  ar: { one: 'مريض', two: 'مريضان', few: 'مرضى', many: 'مريضًا', other: 'مريض' },
};

export const patientCountLabel = (count, lang) => pluralCount(count, lang, PATIENT_FORMS);