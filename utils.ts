import { ServiceStatus } from './types';
import type { Service, Technician } from './types';
import { addMonths } from 'date-fns/addMonths';
import { differenceInDays } from 'date-fns/differenceInDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { isBefore } from 'date-fns/isBefore';
import { addDays } from 'date-fns/addDays';
import { getISOWeek } from 'date-fns/getISOWeek';
import { isWeekend } from 'date-fns/isWeekend';
import { nextMonday } from 'date-fns/nextMonday';
import { ptBR } from 'date-fns/locale/pt-BR';
import * as XLSX from 'xlsx';

/**
 * Checks if two date ranges [s1, e1] and [s2, e2] overlap (inclusive).
 */
export const areDatesOverlapping = (
  start1Str: string,
  end1Str: string,
  start2Str: string,
  end2Str: string
): boolean => {
  try {
    const s1 = parseISO(start1Str);
    const e1 = parseISO(end1Str);
    const s2 = parseISO(start2Str);
    const e2 = parseISO(end2Str);

    if (!isValid(s1) || !isValid(e1) || !isValid(s2) || !isValid(e2)) {
      return false;
    }

    const range1Start = startOfDay(s1 <= e1 ? s1 : e1);
    const range1End = startOfDay(s1 <= e1 ? e1 : s1);
    const range2Start = startOfDay(s2 <= e2 ? s2 : e2);
    const range2End = startOfDay(s2 <= e2 ? e2 : s2);

    return range1Start <= range2End && range1End >= range2Start;
  } catch {
    return false;
  }
};

/**
 * Returns all services assigned to a technician that overlap with the specified date range.
 */
export const getTechnicianConflicts = (
  services: Service[],
  techId: string,
  startDate: string,
  endDate: string,
  excludeServiceId?: string
): Service[] => {
  if (!techId || !startDate || !endDate) return [];

  return services.filter(s => {
    if (excludeServiceId && s.id === excludeServiceId) return false;
    if (!s.technicianIds || !s.technicianIds.includes(techId)) return false;
    return areDatesOverlapping(startDate, endDate, s.startDate, s.endDate);
  });
};

/**
 * Returns all services for the same client that overlap with the specified date range.
 */
export const getClientConflicts = (
  services: Service[],
  clientName: string,
  startDate: string,
  endDate: string,
  excludeServiceId?: string
): Service[] => {
  if (!clientName || !startDate || !endDate) return [];
  const normalizedClient = clientName.trim().toLowerCase();

  return services.filter(s => {
    if (excludeServiceId && s.id === excludeServiceId) return false;
    if (!s.client || s.client.trim().toLowerCase() !== normalizedClient) return false;
    return areDatesOverlapping(startDate, endDate, s.startDate, s.endDate);
  });
};

/**
 * Finds all technicians who are free (no conflicting services) during the given date range.
 */
export const findAvailableTechnicians = (
  technicians: Technician[],
  services: Service[],
  startDate: string,
  endDate: string,
  excludeServiceId?: string
): Technician[] => {
  if (!technicians.length || !startDate || !endDate) return [];

  return technicians.filter(tech => {
    const conflicts = getTechnicianConflicts(services, tech.id, startDate, endDate, excludeServiceId);
    return conflicts.length === 0;
  });
};

export type CalibrationAlertLevel = 'EXPIRED' | 'EXPIRING_SOON' | 'OK' | 'NONE';

export interface CalibrationStatusInfo {
  level: CalibrationAlertLevel;
  daysRemaining: number | null;
  targetDate: Date | null;
  targetDateText: string;
  isForecast: boolean;
}

/**
 * Analyzes the calibration expiration status of a service.
 */
export const getCalibrationStatus = (service: Service): CalibrationStatusInfo => {
  const today = startOfDay(new Date());

  const endDateObj = service.endDate && isValid(parseISO(service.endDate))
    ? startOfDay(parseISO(service.endDate))
    : (service.startDate && isValid(parseISO(service.startDate)) ? startOfDay(parseISO(service.startDate)) : null);

  const isEndDateInFutureOrToday = endDateObj ? endDateObj >= today : false;

  // CASO 1: Atividade NÃO realizada (realized !== 'sim')
  if (service.realized !== 'sim') {
    // 1.1 Se a data de término da visita já passou -> VENCIDA!
    if (endDateObj && !isEndDateInFutureOrToday) {
      const diffDays = differenceInDays(endDateObj, today);
      const targetDateText = format(endDateObj, 'dd/MM/yyyy', { locale: ptBR });
      return {
        level: 'EXPIRED',
        daysRemaining: Math.abs(diffDays),
        targetDate: endDateObj,
        targetDateText,
        isForecast: false
      };
    }

    // 1.2 Se a data de término da visita ainda NÃO venceu (hoje ou no futuro):
    // Regra: "se a data de fim ainda nao venceu nao concidere como vencido"
    if (endDateObj && isEndDateInFutureOrToday) {
      const endDiffDays = differenceInDays(endDateObj, today);
      // O badge 'Xd' só deve aparecer se o status for diferente de "Cliente Confirmado"
      const isExpiringSoon = endDiffDays <= 30 && service.status !== ServiceStatus.CONFIRMED;
      const targetDateText = format(endDateObj, 'dd/MM/yyyy', { locale: ptBR });
      return {
        level: isExpiringSoon ? 'EXPIRING_SOON' : 'OK',
        daysRemaining: endDiffDays,
        targetDate: endDateObj,
        targetDateText,
        isForecast: false
      };
    }

    return {
      level: 'NONE',
      daysRemaining: null,
      targetDate: null,
      targetDateText: '-',
      isForecast: false
    };
  }

  // CASO 2: Atividade REALIZADA (realized === 'sim')
  // Se não houver periodicidade (> 0), visita realizada está concluída sem pendência futura
  if (!service.period || service.period <= 0) {
    return {
      level: 'NONE',
      daysRemaining: null,
      targetDate: null,
      targetDateText: '-',
      isForecast: false
    };
  }

  // Com periodicidade, avalia o vencimento da PRÓXIMA calibração
  let targetDate: Date;
  if (service.nextCalibration && isValid(parseISO(service.nextCalibration))) {
    targetDate = startOfDay(parseISO(service.nextCalibration));
  } else {
    const baseDateStr = (service.startDate && isValid(parseISO(service.startDate)))
      ? service.startDate
      : (service.lastCalibration || service.endDate);

    if (!baseDateStr || !isValid(parseISO(baseDateStr))) {
      return {
        level: 'NONE',
        daysRemaining: null,
        targetDate: null,
        targetDateText: '-',
        isForecast: false
      };
    }

    targetDate = startOfDay(addMonths(parseISO(baseDateStr), service.period));
  }

  const diffDays = differenceInDays(targetDate, today);
  const targetDateText = format(targetDate, 'dd/MM/yyyy', { locale: ptBR });

  // Se a data da próxima calibração expirou -> VENCIDA!
  if (diffDays < 0) {
    return {
      level: 'EXPIRED',
      daysRemaining: Math.abs(diffDays),
      targetDate,
      targetDateText,
      isForecast: true
    };
  }

  // Próximo do vencimento da calibração (até 30 dias se status != Confirmado)
  if (diffDays <= 30 && service.status !== ServiceStatus.CONFIRMED) {
    return {
      level: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      targetDate,
      targetDateText,
      isForecast: true
    };
  }

  return {
    level: 'OK',
    daysRemaining: diffDays,
    targetDate,
    targetDateText,
    isForecast: true
  };
};

/**
 * Utility to adjust a date to Monday if it falls on Saturday or Sunday.
 */
const adjustToNextMondayIfWeekend = (date: Date): Date => (isWeekend(date) ? nextMonday(date) : date);

/**
 * Cria múltiplos serviços de previsão de calibração recorrentes até um horizonte máximo (padrão: 6 meses, máximo: 12 meses).
 * - A recorrência parte estritamente da data de início (startDate) da atividade base selecionada.
 * - Garante sequência cronológica: início < término para cada ciclo, preservando a duração em dias da atividade original.
 * - Se a data calculada cair em sábado ou domingo, ajusta o início para a segunda-feira seguinte.
 * - Periodicidade máxima de 12 meses.
 * - Cada ciclo subsequente encadeia a partir do ciclo anterior.
 */
export const createRecurringCalibrationForecasts = (
  baseService: Service,
  technicians: Technician[],
  existingServices: Service[],
  maxMonths: number = 6,
  overridePeriod?: number
): Service[] => {
  const rawPeriod = (overridePeriod && overridePeriod > 0) ? overridePeriod : baseService.period;
  if (!rawPeriod || rawPeriod <= 0) return [];
  // Periodicidade máxima de 12 meses
  const period = Math.min(rawPeriod, 12);

  const baseStart = parseISO(baseService.startDate);
  const baseEnd = parseISO(baseService.endDate || baseService.startDate);
  if (!isValid(baseStart)) return [];

  // Duração em dias da visita base original (preservada em todos os ciclos, mínimo 1 dia)
  const duration = isValid(baseEnd)
    ? Math.max(1, differenceInDays(baseEnd, baseStart) + 1)
    : 1;

  const forecasts: Service[] = [];
  const preferredTechId = baseService.technicianIds?.[0];

  let currentRefStart = baseStart;

  for (let months = period; months <= maxMonths; months += period) {
    // Projeta o início somando o período e joga para segunda-feira se cair no fim de semana
    const cycleStart = adjustToNextMondayIfWeekend(addMonths(currentRefStart, period));
    // Fim é rigorosamente cronológico e preserva a duração exata da visita
    const cycleEnd = addDays(cycleStart, duration - 1);
    const cycle = months / period;

    const startDateStr = format(cycleStart, 'yyyy-MM-dd');
    const endDateStr = format(cycleEnd, 'yyyy-MM-dd');
    const week = getISOWeek(cycleStart);

    // Combina serviços existentes com as novas previsões geradas neste lote para alocar técnicos
    const allServicesToCheck = [...existingServices, ...forecasts];
    const availableTechs = findAvailableTechnicians(technicians, allServicesToCheck, startDateStr, endDateStr);

    const isPreferredAvailable = preferredTechId ? availableTechs.some(t => t.id === preferredTechId) : false;
    const chosenTechIds = isPreferredAvailable && preferredTechId
      ? [preferredTechId]
      : (availableTechs.length > 0 ? [availableTechs[0].id] : (baseService.technicianIds || []));

    forecasts.push({
      id: `svc-forecast-${Date.now()}-${cycle}-${Math.random().toString(36).substr(2, 5)}`,
      week,
      client: baseService.client,
      manager: baseService.manager || '',
      os: '', // Em branco para preenchimento futuro
      description: `Calibração Prevista (+${months}m - Ciclo ${cycle}) - Ref. OS ${baseService.os || 'Base'}`,
      hp: baseService.hp || 0,
      ht: baseService.ht || 0,
      hv: baseService.hv || 0,
      startDate: startDateStr,
      endDate: endDateStr,
      technicianIds: chosenTechIds,
      status: ServiceStatus.PREDICTED,
      period,
      // A última calibração reflete a data de início da visita imediatamente anterior no ciclo
      lastCalibration: format(currentRefStart, 'yyyy-MM-dd'),
      nextCalibration: format(addMonths(cycleStart, period), 'yyyy-MM-dd'),
      comments: baseService.comments || '',
      realized: 'nao'
    });

    // Atualiza a referência para o próximo ciclo encadear cronologicamente
    currentRefStart = cycleStart;
  }

  return forecasts;
};

/**
 * Interface representing the result of a periodicity check.
 */
export interface PeriodExceededResult {
  isExceeded: boolean;
  daysExceeded: number;
  limitDateText: string;
}

const NO_DEADLINE: PeriodExceededResult = { isExceeded: false, daysExceeded: 0, limitDateText: '' };

/**
 * Checks if a proposed start date for a service exceeds its expected calibration period deadline.
 */
export const checkPeriodExceeded = (
  service: Service,
  proposedStartDate: string
): PeriodExceededResult => {
  const period = service.period;
  if (!period || period <= 0) return NO_DEADLINE;

  const proposedStart = parseISO(proposedStartDate);
  if (!isValid(proposedStart)) return NO_DEADLINE;

  // Prazo conta a partir da última calibração; sem ela, do início do próprio serviço
  const baseDate = [service.lastCalibration, service.startDate]
    .map(d => (d ? parseISO(d) : null))
    .find(d => d && isValid(d));

  if (!baseDate) return NO_DEADLINE;

  const limitDate = addMonths(baseDate, period);
  const daysDiff = differenceInDays(proposedStart, limitDate);

  return {
    isExceeded: daysDiff > 0,
    daysExceeded: Math.max(daysDiff, 0),
    limitDateText: format(limitDate, 'dd/MM/yyyy', { locale: ptBR })
  };
};

/**
 * Recalculates and replaces all future forecast visits for a client starting from a newly rescheduled service.
 */
export const recalculateFutureForecastsFromNewDate = (
  updatedService: Service,
  allServices: Service[],
  technicians: Technician[],
  maxMonths: number = 6
): Service[] => {
  if (!updatedService.period || updatedService.period <= 0) return allServices;

  const clientNameNormalized = updatedService.client.trim().toLowerCase();
  const safePeriod = Math.min(updatedService.period, 12);
  const safeHorizon = safePeriod > 6 ? 12 : Math.min(maxMonths, 12);

  // 1. Remove previsões automáticas futuras desse cliente
  const filtered = allServices.filter(s => {
    if (s.id === updatedService.id) return true; // Mantém o próprio serviço
    if (s.client.trim().toLowerCase() === clientNameNormalized &&
        s.status === ServiceStatus.PREDICTED &&
        (s.description.includes('Calibração Prevista') || s.id.startsWith('svc-forecast-'))) {
      return false; // Remove para recalcular
    }
    return true;
  });

  // 2. Gera a nova série de previsões a partir da nova data
  const newForecasts = createRecurringCalibrationForecasts(
    updatedService,
    technicians,
    filtered,
    safeHorizon,
    safePeriod
  );

  return [...filtered, ...newForecasts];
};

/**
 * Calculates the number of days a service spans.
 */
export const calculateDuration = (start: string, end: string): number => {
  return differenceInDays(parseISO(end), parseISO(start)) + 1;
};

/**
 * Calculates the next calibration date and forecast string based on startDate (or lastCal) + period
 * Format: dd/MM/yyyy (padrão brasileiro)
 */
export const calculateCalibration = (startDate?: string, lastCal?: string, period?: number, manualNextCal?: string, realized?: 'sim' | 'nao') => {
    if (manualNextCal && isValid(parseISO(manualNextCal))) {
        const manualDate = parseISO(manualNextCal);
        return {
            nextCalText: format(manualDate, 'dd/MM/yyyy', { locale: ptBR }),
            forecastDate: manualDate,
            isoDate: manualNextCal
        };
    }

    if (!period || period <= 0) {
        return { nextCalText: '***', forecastDate: null, isoDate: '' };
    }
    
    // Prioriza data da coluna Início (startDate); fallback para Última Calibração (lastCal)
    const baseDateStr = (startDate && isValid(parseISO(startDate)))
        ? startDate
        : (lastCal && isValid(parseISO(lastCal)) ? lastCal : null);

    if (!baseDateStr) {
        return { nextCalText: '***', forecastDate: null, isoDate: '' };
    }

    const baseDate = parseISO(baseDateStr);
    if (!isValid(baseDate)) return { nextCalText: '-', forecastDate: null, isoDate: '' };

    const nextDate = addMonths(baseDate, period);
    
    // "Proxima calibração": Formato completo dd/MM/yyyy (ex: 15/09/2026)
    const nextCalText = format(nextDate, 'dd/MM/yyyy', { locale: ptBR }); 
    const isoDate = format(nextDate, 'yyyy-MM-dd');

    return { nextCalText, forecastDate: nextDate, isoDate };
};

/**
 * Calculates the service forecast dates based on startDate, endDate + period (months)
 * Returns a string in the format "de [date] até [date]"
 */
export const calculateServiceForecast = (
    startDate?: string,
    endDate?: string,
    period?: number,
    nextCalText?: string,
    realized?: 'sim' | 'nao'
) => {
    if (!startDate || !endDate || !period || period <= 0) {
        return { forecastText: '***', forecastStartDate: null, forecastEndDate: null };
    }
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (!isValid(start) || !isValid(end)) {
        return { forecastText: '-', forecastStartDate: null, forecastEndDate: null };
    }
    
    const forecastStart = addMonths(start, period);
    const forecastEnd = addMonths(end, period);
    
    const forecastText = `de ${format(forecastStart, 'dd/MM/yyyy', { locale: ptBR })} até ${format(forecastEnd, 'dd/MM/yyyy', { locale: ptBR })}`;
    
    return { forecastText, forecastStartDate: forecastStart, forecastEndDate: forecastEnd };
};

/**
 * Generates an array of dates for a given range.
 */
export const getDaysInRange = (start: Date, end: Date) => {
  return eachDayOfInterval({ start, end });
};

// --- EXCEL UTILS ---

/**
 * Exports the current services list to an Excel file.
 */
export const exportToExcel = (services: Service[], technicians: Technician[]) => {
  // 1. Sort by Start Date chronologically
  const sortedServices = [...services].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // 2. Map data to the exact 16 columns format
  const dataToExport = sortedServices.map(s => {
    const techNames = s.technicianIds
      .map(id => technicians.find(t => t.id === id)?.name || '')
      .filter(Boolean)
      .join(', ');

    const { nextCalText } = calculateCalibration(s.startDate, s.lastCalibration, s.period, s.nextCalibration, s.realized);
    const { forecastText } = calculateServiceForecast(s.startDate, s.endDate, s.period, nextCalText, s.realized);

    return {
      'SEM.': s.week,
      'CLIENT': s.client,
      'Manager': s.manager,
      'OS': s.os,
      'DESCRIPT': s.description,
      'HP': s.hp,
      'HT': s.ht,
      'HV': s.hv,
      'Inicio': s.startDate,
      'Fim': s.endDate,
      'EXEC.': techNames || 'Unknown',
      'REALIZADO': s.realized === 'sim' ? 'Sim' : 'Não',
      'LAST.CAL': s.lastCalibration || '',
      'PERIOD': s.period || 0,
      'Proxima calibração': s.realized === 'sim' ? (s.nextCalibration || nextCalText) : '0',
      'Status': s.status,
      'Previsão': forecastText
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // 3. Define Column Widths (wch = width characters)
  const wscols = [
    { wch: 6 },  // SEM
    { wch: 30 }, // CLIENT
    { wch: 10 }, // Manager
    { wch: 12 }, // OS
    { wch: 25 }, // DESCRIPT
    { wch: 6 },  // HP
    { wch: 6 },  // HT
    { wch: 6 },  // HV
    { wch: 12 }, // Inicio
    { wch: 12 }, // Fim
    { wch: 15 }, // EXEC (widened for multiple techs)
    { wch: 12 }, // REALIZADO
    { wch: 12 }, // LAST.CAL
    { wch: 8 },  // PERIOD
    { wch: 18 }, // Prox Cal
    { wch: 22 }, // Status
    { wch: 35 }, // Previsao
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Service_Schedule");
  
  // Download the file
  XLSX.writeFile(workbook, `Calendario_Digital_Export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/**
 * Filtra serviços com base no período selecionado (ano e mês),
 * considerando EXCLUSIVAMENTE a Data de Início (startDate).
 * month: -1 indica 'Ano Inteiro'; 0 a 11 representam Janeiro a Dezembro.
 */
export const filterServicesByPeriod = (
  services: Service[],
  selectedYear: number,
  selectedMonth: number
): Service[] => {
  let periodStartStr: string;
  let periodEndStr: string;

  if (selectedMonth === -1) {
    periodStartStr = `${selectedYear}-01-01`;
    periodEndStr = `${selectedYear}-12-31`;
  } else {
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    periodStartStr = `${selectedYear}-${monthStr}-01`;
    periodEndStr = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }

  return services.filter(s => {
    const rawStart = (s.startDate || '').trim();

    // Se não tiver data de início cadastrada:
    if (!rawStart) {
      // Exibe apenas na visão de Ano Inteiro para permitir identificação e preenchimento
      return selectedMonth === -1;
    }

    // Filtra estritamente pela Data de Início dentro do intervalo do período selecionado
    return rawStart >= periodStartStr && rawStart <= periodEndStr;
  });
};

/**
 * Aplica atualizações em lote (status e/ou realizado) a um conjunto de serviços,
 * respeitando regras de calibração, precedência de status e histórico de reversão.
 */
export const applyBatchServiceUpdates = (
  services: Service[],
  targetIds: Set<string>,
  updates: { status?: ServiceStatus; realized?: 'sim' | 'nao' },
  referenceDate: Date = new Date()
): Service[] => {
  const today = startOfDay(referenceDate);

  const updatedList = services.map(s => {
    if (!targetIds.has(s.id)) return s;

    let updatedService = { ...s };

    // 1. Processar 'realized' (Status e Últ. Cal. permanecem independentes)
    if (updates.realized) {
      updatedService.realized = updates.realized;
    }

    // 2. Processar 'status' explícito
    if (updates.status) {
      updatedService.status = updates.status;
    }

    return updatedService;
  });

  // Se o status alterado em lote for CONFIRMED ("Cliente Confirmado"),
  // gera a nova atividade futura para cada atividade que possuir próxima calibração válida.
  let finalServices = updatedList;
  if (updates.status === ServiceStatus.CONFIRMED) {
    const newlyCreated: Service[] = [];
    for (const s of updatedList) {
      if (targetIds.has(s.id)) {
        const nextService = generateNextCalibrationService(s, [...updatedList, ...newlyCreated]);
        if (nextService) {
          newlyCreated.push(nextService);
        }
      }
    }
    if (newlyCreated.length > 0) {
      finalServices = [...updatedList, ...newlyCreated];
    }
  }

  return syncServicesLastCalibration(finalServices);
};

/**
 * Retorna o nome do feriado nacional brasileiro se a data for feriado, ou null.
 */
export const getBrazilianHoliday = (date: Date): string | null => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Feriados nacionais fixos (formato MM-DD)
  const fixedHolidays: Record<string, string> = {
    '01-01': 'Confraternização Universal',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalho',
    '09-07': 'Independência do Brasil',
    '10-12': 'Nossa Senhora Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '11-20': 'Dia da Consciência Negra',
    '12-25': 'Natal'
  };

  if (fixedHolidays[mmdd]) {
    return fixedHolidays[mmdd];
  }

  // Feriados móveis derivados da Páscoa (Algoritmo Gregoriano de Meeus/Jones/Butcher)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, easterMonth, easterDay);

  const goodFriday = addDays(easter, -2);
  const carnival = addDays(easter, -47);
  const corpusChristi = addDays(easter, 60);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, goodFriday)) return 'Sexta-feira Santa';
  if (isSameDay(date, carnival)) return 'Carnaval';
  if (isSameDay(date, corpusChristi)) return 'Corpus Christi';

  return null;
};

/**
 * Determina se a data é um dia não útil (final de semana ou feriado nacional).
 */
export const isNonWorkingDay = (date: Date): { isWeekend: boolean; holidayName: string | null; isNonWorking: boolean } => {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const holidayName = getBrazilianHoliday(date);
  return {
    isWeekend,
    holidayName,
    isNonWorking: isWeekend || holidayName !== null
  };
};

/**
 * Cria automaticamente uma nova atividade futura na data da próxima calibração
 * ao confirmar uma visita, preservando todas as características e evitando duplicações.
 */
export function generateNextCalibrationService(
  currentService: Service,
  existingServices: Service[]
): Service | null {
  // Identifica a data da próxima calibração
  let nextCalStr = currentService.nextCalibration;
  if (!nextCalStr || !isValid(parseISO(nextCalStr))) {
    const calc = calculateCalibration(
      currentService.startDate,
      currentService.lastCalibration,
      currentService.period,
      undefined,
      currentService.realized
    );
    if (calc.isoDate && isValid(parseISO(calc.isoDate))) {
      nextCalStr = calc.isoDate;
    }
  }

  if (!nextCalStr || !isValid(parseISO(nextCalStr))) {
    return null;
  }

  const parsedTargetStart = parseISO(nextCalStr);
  const targetStart = adjustToNextMondayIfWeekend(parsedTargetStart);

  // Calcula a duração da visita original
  let duration = 1;
  if (currentService.startDate && currentService.endDate) {
    try {
      duration = calculateDuration(currentService.startDate, currentService.endDate);
    } catch {
      duration = 1;
    }
  }
  if (duration < 1) duration = 1;

  const targetEnd = addDays(targetStart, duration - 1);
  const startDateStr = format(targetStart, 'yyyy-MM-dd');
  const endDateStr = format(targetEnd, 'yyyy-MM-dd');

  // Previne duplicação se já existir atividade futura para o mesmo cliente na mesma data
  const alreadyExists = existingServices.some(s =>
    s.id !== currentService.id &&
    s.client &&
    currentService.client &&
    s.client.trim().toLowerCase() === currentService.client.trim().toLowerCase() &&
    s.startDate === startDateStr
  );

  if (alreadyExists) {
    return null;
  }

  // Próxima calibração para o ciclo seguinte
  const period = currentService.period || 0;
  let futureNextCal = '';
  if (period > 0) {
    futureNextCal = format(addMonths(targetStart, period), 'yyyy-MM-dd');
  }

  const newService: Service = {
    id: `svc-nextcal-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    week: getISOWeek(targetStart),
    client: currentService.client,
    manager: currentService.manager || '',
    os: currentService.os || '',
    description: currentService.description || '',
    hp: currentService.hp || 0,
    ht: currentService.ht || 0,
    hv: currentService.hv || 0,
    startDate: startDateStr,
    endDate: endDateStr,
    technicianIds: currentService.technicianIds ? [...currentService.technicianIds] : [],
    status: ServiceStatus.PREDICTED,
    period,
    lastCalibration: currentService.startDate || currentService.endDate || '',
    nextCalibration: futureNextCal,
    comments: currentService.comments || '',
    realized: 'nao'
  };

  return newService;
};

/**
 * Retorna a Data de Início (startDate) da visita imediatamente anterior cadastrada para o mesmo cliente,
 * ou null caso seja a primeira visita do cliente no calendário.
 */
export const getPreviousServiceStartDate = (
  service: Pick<Service, 'id' | 'client' | 'startDate'>,
  allServices: Service[]
): string | null => {
  if (!service.client || !service.startDate) return null;
  const clientNorm = service.client.trim().toLowerCase();
  if (!clientNorm) return null;

  const currentStart = parseISO(service.startDate);
  if (!isValid(currentStart)) return null;

  const previousServices = allServices.filter(s => {
    if (s.id === service.id) return false;
    if ((s.client || '').trim().toLowerCase() !== clientNorm) return false;
    if (!s.startDate) return false;
    const start = parseISO(s.startDate);
    if (!isValid(start)) return false;
    return isBefore(start, currentStart);
  });

  if (previousServices.length === 0) return null;

  // Ordena decrescente pela data de início para obter a visita mais recente anterior
  previousServices.sort((a, b) => {
    const timeDiff = parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (b.endDate || '').localeCompare(a.endDate || '');
  });

  return previousServices[0].startDate;
};

/**
 * Sincroniza a propriedade lastCalibration de todos os serviços de uma lista,
 * refletindo a última data de início anterior do mesmo cliente para serviços que possuem histórico anterior,
 * e preservando o valor existente (manual/importado) para o primeiro serviço de cada cliente.
 */
export const syncServicesLastCalibration = (services: Service[]): Service[] => {
  return services.map(s => {
    const prevStartDate = getPreviousServiceStartDate(s, services);
    if (prevStartDate) {
      if (s.lastCalibration !== prevStartDate) {
        return { ...s, lastCalibration: prevStartDate };
      }
      return s;
    }
    return s;
  });
};

/**
 * Remove previsões automáticas obsoletas ou de anos muito distantes (ex: 2028-2030) geradas em testes antigos.
 */
export const cleanObsoleteCalibrationForecasts = (services: Service[]): Service[] => {
  return services.filter(s => {
    const isAutoForecast = s.status === ServiceStatus.PREDICTED &&
      ((s.description || '').includes('Calibração Prevista') || s.id.startsWith('svc-forecast-'));
    if (isAutoForecast && s.startDate && s.startDate >= '2028-01-01') {
      return false;
    }
    return true;
  });
};