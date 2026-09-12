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
  if (!service.period || service.period <= 0) {
    return {
      level: 'NONE',
      daysRemaining: null,
      targetDate: null,
      targetDateText: '-',
      isForecast: false
    };
  }

  // Se o serviço já estiver confirmado pelo cliente, não exibe alerta de pendência/vencimento
  if (service.status === ServiceStatus.CONFIRMED) {
    return {
      level: 'NONE',
      daysRemaining: null,
      targetDate: null,
      targetDateText: '-',
      isForecast: false
    };
  }

  const baseDateStr = (service.startDate && isValid(parseISO(service.startDate)))
    ? service.startDate
    : (service.lastCalibration || service.endDate);
  if (!baseDateStr) {
    return {
      level: 'NONE',
      daysRemaining: null,
      targetDate: null,
      targetDateText: '-',
      isForecast: false
    };
  }

  const baseDate = parseISO(baseDateStr);
  if (!isValid(baseDate)) {
    return {
      level: 'NONE',
      daysRemaining: null,
      targetDate: null,
      targetDateText: '-',
      isForecast: false
    };
  }

  const nextCalDate = addMonths(baseDate, service.period);
  const today = startOfDay(new Date());
  const diffDays = differenceInDays(nextCalDate, today);
  const targetDateText = format(nextCalDate, 'dd/MM/yyyy', { locale: ptBR });

  // 1. Data vencida: alerta vermelho
  if (diffDays < 0) {
    return {
      level: 'EXPIRED',
      daysRemaining: diffDays,
      targetDate: nextCalDate,
      targetDateText,
      isForecast: true
    };
  } 
  // 2. Faltando 2 meses (60 dias) ou menos e status diferente de Confirmado: alerta amarelo pulsante
  else if (diffDays <= 60) {
    return {
      level: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      targetDate: nextCalDate,
      targetDateText,
      isForecast: true
    };
  }

  return {
    level: 'OK',
    daysRemaining: diffDays,
    targetDate: nextCalDate,
    targetDateText,
    isForecast: true
  };
};

/**
 * Creates multiple recurring calibration forecast services up to a max horizon (default: 36 months / 3 years).
 * Example for period=12: returns forecasts for +12m, +24m, +36m.
 * Example for period=6: returns forecasts for +6m, +12m, +18m, +24m, +30m, +36m.
 */
export const createRecurringCalibrationForecasts = (
  baseService: Service,
  technicians: Technician[],
  existingServices: Service[],
  maxMonths: number = 36
): Service[] => {
  const period = baseService.period;
  if (!period || period <= 0) return [];

  const start = parseISO(baseService.startDate);
  const end = parseISO(baseService.endDate);
  if (!isValid(start) || !isValid(end)) return [];

  const forecasts: Service[] = [];
  const preferredTechId = baseService.technicianIds?.[0];

  // Duration in days to preserve the span
  const duration = differenceInDays(end, start) + 1;

  let cycle = 1;
  for (let months = period; months <= maxMonths; months += period) {
    const cycleStart = addMonths(start, months);
    const cycleEnd = addDays(cycleStart, duration - 1);

    const startDateStr = format(cycleStart, 'yyyy-MM-dd');
    const endDateStr = format(cycleEnd, 'yyyy-MM-dd');
    const week = getISOWeek(cycleStart);

    // Combine existing services + previously generated forecasts in this loop to avoid intra-batch collision
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
      os: '', // Vazio para preenchimento posterior
      description: `Calibração Prevista (+${months}m - Ciclo ${cycle}) - Ref. OS ${baseService.os || 'Base'}`,
      hp: baseService.hp || 0,
      ht: baseService.ht || 0,
      hv: baseService.hv || 0,
      startDate: startDateStr,
      endDate: endDateStr,
      technicianIds: chosenTechIds,
      status: ServiceStatus.PREDICTED,
      period: baseService.period,
      lastCalibration: baseService.endDate || baseService.startDate
    });

    cycle++;
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
  maxMonths: number = 36
): Service[] => {
  if (!updatedService.period || updatedService.period <= 0) return allServices;

  const clientNameNormalized = updatedService.client.trim().toLowerCase();

  // 1. Remove previsões automáticas futuras desse cliente
  const filtered = allServices.filter(s => {
    if (s.id === updatedService.id) return true; // Mantém o próprio serviço
    if (s.client.trim().toLowerCase() === clientNameNormalized &&
        s.status === ServiceStatus.PREDICTED &&
        s.description.includes('Calibração Prevista')) {
      return false; // Remove para recalcular
    }
    return true;
  });

  // 2. Gera a nova série de previsões a partir da nova data
  const newForecasts = createRecurringCalibrationForecasts(
    updatedService,
    technicians,
    filtered,
    maxMonths
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
export const calculateCalibration = (startDate?: string, lastCal?: string, period?: number) => {
    if (!period || period <= 0) {
        return { nextCalText: '***', forecastDate: null };
    }
    
    // Prioriza data da coluna Início (startDate); fallback para Última Calibração (lastCal)
    const baseDateStr = (startDate && isValid(parseISO(startDate)))
        ? startDate
        : (lastCal && isValid(parseISO(lastCal)) ? lastCal : null);

    if (!baseDateStr) {
        return { nextCalText: '***', forecastDate: null };
    }

    const baseDate = parseISO(baseDateStr);
    if (!isValid(baseDate)) return { nextCalText: '-', forecastDate: null };

    const nextDate = addMonths(baseDate, period);
    
    // "Proxima calibração": Formato completo dd/MM/yyyy (ex: 15/09/2026)
    const nextCalText = format(nextDate, 'dd/MM/yyyy', { locale: ptBR }); 

    return { nextCalText, forecastDate: nextDate };
};

/**
 * Calculates the service forecast dates based on startDate, endDate + period (months)
 * Returns a string in the format "de [date] até [date]"
 */
export const calculateServiceForecast = (startDate?: string, endDate?: string, period?: number) => {
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

    const { nextCalText } = calculateCalibration(s.startDate, s.lastCalibration, s.period);
    const { forecastText } = calculateServiceForecast(s.startDate, s.endDate, s.period);

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
      'LAST.CAL': s.lastCalibration || '',
      'PERIOD': s.period || 0,
      'Proxima calibração': nextCalText,
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