/**
 * Russian three-form plural helper (1, 2-4, 5+).
 *
 * Examples:
 *   plural(1, ['день', 'дня', 'дней'])    → 'день'
 *   plural(2, ['день', 'дня', 'дней'])    → 'дня'
 *   plural(5, ['день', 'дня', 'дней'])    → 'дней'
 *   plural(21, ['день', 'дня', 'дней'])   → 'день'
 *   plural(22, ['день', 'дня', 'дней'])   → 'дня'
 *   plural(11, ['день', 'дня', 'дней'])   → 'дней'  (11..14 → form3)
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export const DAYS_FORMS: [string, string, string] = ['день', 'дня', 'дней'];
export const BOARDS_FORMS: [string, string, string] = ['доска', 'доски', 'досок'];
export const ELEMENTS_FORMS: [string, string, string] = ['элемент', 'элемента', 'элементов'];
