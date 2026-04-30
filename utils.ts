import { Service, ServiceStatus, Technician } from './types';
import { addMonths } from 'date-fns/addMonths';
import { differenceInDays } from 'date-fns/differenceInDays';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { ptBR } from 'date-fns/locale/pt-BR';
import * as XLSX from 'xlsx';

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