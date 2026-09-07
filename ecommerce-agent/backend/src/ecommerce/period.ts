import { AppError } from '../errors.js';
import type { PeriodRange } from './adapter.js';

const VALID = 'today, yesterday, this_week, last_week, this_month, last_month, this_year, last_year, YYYY-MM (ej: 2026-08)';

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(now: Date): Date {
  const d = startOfDay(now);
  const offsetToMonday = (d.getDay() + 6) % 7;
  return addDays(d, -offsetToMonday);
}

function monthShift(now: Date, months: number): Date {
  return new Date(now.getFullYear(), now.getMonth() + months, 1);
}

/** Rango [from, to) para un especificador de período en lenguaje del agente. */
export function parsePeriod(spec: string, now = new Date()): PeriodRange {
  const s = spec.trim().toLowerCase();
  const today = startOfDay(now);

  switch (s) {
    case 'today':
      return { label: 'hoy', from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { label: 'ayer', from: addDays(today, -1), to: today };
    case 'this_week': {
      const monday = startOfWeek(now);
      return { label: 'esta semana', from: monday, to: addDays(monday, 7) };
    }
    case 'last_week': {
      const monday = addDays(startOfWeek(now), -7);
      return { label: 'la semana pasada', from: monday, to: addDays(monday, 7) };
    }
    case 'this_month':
      return { label: 'este mes', from: monthShift(now, 0), to: monthShift(now, 1) };
    case 'last_month':
      return { label: 'el mes pasado', from: monthShift(now, -1), to: monthShift(now, 0) };
    case 'this_year':
      return { label: 'este año', from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case 'last_year':
      return { label: 'el año pasado', from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear(), 0, 1) };
  }

  const ym = /^(\d{4})-(\d{2})$/.exec(spec.trim());
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (month >= 1 && month <= 12) {
      return { label: `${year}-${String(month).padStart(2, '0')}`, from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
    }
  }

  throw new AppError('VALIDATION', `Período no reconocido: '${spec}'`, {
    hint: `Períodos válidos: ${VALID}`,
  });
}

/** Período inmediatamente anterior al especificado (para comparaciones). */
export function previousPeriod(spec: string, now = new Date()): PeriodRange {
  const s = spec.trim().toLowerCase();
  const today = startOfDay(now);
  switch (s) {
    case 'today':
      return parsePeriod('yesterday', now);
    case 'yesterday':
      return { label: 'anteayer', from: addDays(today, -2), to: addDays(today, -1) };
    case 'this_week':
      return parsePeriod('last_week', now);
    case 'last_week': {
      const monday = addDays(startOfWeek(now), -14);
      return { label: 'hace dos semanas', from: monday, to: addDays(monday, 7) };
    }
    case 'this_month':
      return parsePeriod('last_month', now);
    case 'last_month':
      return { label: 'hace dos meses', from: monthShift(now, -2), to: monthShift(now, -1) };
    case 'this_year':
      return parsePeriod('last_year', now);
    case 'last_year':
      return { label: 'hace dos años', from: new Date(now.getFullYear() - 2, 0, 1), to: new Date(now.getFullYear() - 1, 0, 1) };
  }
  const ym = /^(\d{4})-(\d{2})$/.exec(spec.trim());
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (month >= 1 && month <= 12) {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      return {
        label: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
        from: new Date(prevYear, prevMonth - 1, 1),
        to: new Date(prevYear, prevMonth, 1),
      };
    }
  }
  throw new AppError('VALIDATION', `Período no reconocido: '${spec}'`, { hint: `Períodos válidos: ${VALID}` });
}
