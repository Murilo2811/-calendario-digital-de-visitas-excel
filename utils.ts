import { Service, ServiceStatus, Technician } from './types';
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

  const baseDateStr = service.lastCalibration || service.endDate || service.startDate;
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

  if (diffDays < 0) {
    return {
      level: 'EXPIRED',
      daysRemaining: diffDays,
      targetDate: nextCalDate,
      targetDateText,
      isForecast: true
    };
  } else if (diffDays <= 30) {
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
 * Creates a future projected service (Cliente Previsto) based on a completed/confirmed service.
 */
export const createNextCalibrationService = (
  baseService: Service,
  availableTechs: Technician[]
): Service => {
  const period = baseService.period || 6;
  const start = parseISO(baseService.startDate);
  const end = parseISO(baseService.endDate);

  const newStart = isValid(start) ? addMonths(start, period) : new Date();
  const newEnd = isValid(end) ? addMonths(end, period) : newStart;

  const startDateStr = format(newStart, 'yyyy-MM-dd');
  const endDateStr = format(newEnd, 'yyyy-MM-dd');
  const week = getISOWeek(newStart);

  // Preserve tech if available, otherwise take first available or fallback to base
  const preferredTechId = baseService.technicianIds?.[0];
  const isPreferredAvailable = availableTechs.some(t => t.id === preferredTechId);
  const chosenTechIds = isPreferredAvailable && preferredTechId
    ? [preferredTechId]
    : (availableTechs.length > 0 ? [availableTechs[0].id] : (baseService.technicianIds || []));

  return {
    id: `svc-forecast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    week,
    client: baseService.client,
    manager: baseService.manager || '',
    os: '', // OS em branco para agendamento
    description: `Calibração Prevista (${period}m) - Ref. OS ${baseService.os || 'Anterior'}`,
    hp: baseService.hp || 0,
    ht: baseService.ht || 0,
    hv: baseService.hv || 0,
    startDate: startDateStr,
    endDate: endDateStr,
    technicianIds: chosenTechIds,
    status: ServiceStatus.PREDICTED,
    period: baseService.period,
    lastCalibration: baseService.endDate || baseService.startDate
  };
};

/**
 * Calculates the number of days a service spans.
 */
export const calculateDuration = (start: string, end: string): number => {
  return differenceInDays(parseISO(end), parseISO(start)) + 1;
};

/**
 * Calculates the next calibration date and forecast string based on last cal + period
 */
export const calculateCalibration = (lastCal?: string, period?: number) => {
    if (!lastCal || !period || period <= 0) {
        return { nextCalText: '***', forecastDate: null };
    }
    
    const lastDate = parseISO(lastCal);
    if (!isValid(lastDate)) return { nextCalText: '-', forecastDate: null };

    const nextDate = addMonths(lastDate, period);
    
    // "Proxima calibração": Month-YY (e.g. July-25)
    const nextCalText = format(nextDate, 'MMMM-yy', { locale: ptBR }); 

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

    const { nextCalText } = calculateCalibration(s.lastCalibration, s.period);
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