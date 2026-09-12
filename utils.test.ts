// Smoke test da matemática de datas de calibração.
// Roda sem framework: `npm test` (node:test + node:assert, type stripping nativo do Node 24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecurringCalibrationForecasts, checkPeriodExceeded, calculateCalibration, getCalibrationStatus, filterServicesByPeriod } from './utils.ts';
import { ServiceStatus, TechType } from './types.ts';
import type { Service, Technician } from './types.ts';

const techs: Technician[] = [
  { id: 't1', name: 'ES', fullName: 'Eduardo Silva', type: TechType.INTERNAL, color: 'bg-red-100' },
  { id: 't2', name: 'LF', fullName: 'Luiz Ferreira', type: TechType.INTERNAL, color: 'bg-red-100' },
];

const base = (over: Partial<Service> = {}): Service => ({
  id: 's1',
  week: 2,
  client: 'Cliente Teste',
  manager: 'Gerente',
  os: '500000001',
  description: 'PMA',
  hp: 5,
  ht: 40,
  hv: 6,
  startDate: '2026-01-05',
  endDate: '2026-01-09',
  technicianIds: ['t1'],
  status: ServiceStatus.CONFIRMED,
  lastCalibration: '2025-07-05',
  period: 6,
  ...over,
});

test('projeta um ciclo a cada `period` meses até 36m', () => {
  const forecasts = createRecurringCalibrationForecasts(base(), techs, []);

  assert.equal(forecasts.length, 6, 'period=6 cabe 6 vezes em 36 meses');
  assert.deepEqual(
    forecasts.map(f => f.startDate),
    ['2026-07-05', '2027-01-05', '2027-07-05', '2028-01-05', '2028-07-05', '2029-01-05'],
  );
  assert.ok(forecasts.every(f => f.status === ServiceStatus.PREDICTED));
});

test('period=12 gera 3 ciclos; period=0 nao gera nada', () => {
  assert.equal(createRecurringCalibrationForecasts(base({ period: 12 }), techs, []).length, 3);
  assert.equal(createRecurringCalibrationForecasts(base({ period: 0 }), techs, []).length, 0);
});

test('preserva a duracao da visita base em cada projecao', () => {
  // base ocupa 5 dias (05 a 09 de janeiro)
  const [primeiro] = createRecurringCalibrationForecasts(base(), techs, []);
  assert.equal(primeiro.startDate, '2026-07-05');
  assert.equal(primeiro.endDate, '2026-07-09');
});

test('datas invalidas nao geram projecao', () => {
  assert.equal(createRecurringCalibrationForecasts(base({ startDate: '' }), techs, []).length, 0);
});

test('checkPeriodExceeded: dentro do prazo', () => {
  // ultima calibracao 2026-01-10 + 6 meses = limite 2026-07-10
  const r = checkPeriodExceeded(base({ lastCalibration: '2026-01-10' }), '2026-07-01');
  assert.equal(r.isExceeded, false);
  assert.equal(r.daysExceeded, 0);
  assert.equal(r.limitDateText, '10/07/2026');
});

test('checkPeriodExceeded: atrasado conta os dias', () => {
  const r = checkPeriodExceeded(base({ lastCalibration: '2026-01-10' }), '2026-07-20');
  assert.equal(r.isExceeded, true);
  assert.equal(r.daysExceeded, 10);
});

test('checkPeriodExceeded: sem periodicidade nunca acusa atraso', () => {
  assert.equal(checkPeriodExceeded(base({ period: 0 }), '2030-01-01').isExceeded, false);
});

test('checkPeriodExceeded: sem lastCalibration usa a data de inicio como base', () => {
  // startDate 2026-01-05 + 6m = 2026-07-05; proposta 10 dias depois
  const r = checkPeriodExceeded(base({ lastCalibration: '' }), '2026-07-15');
  assert.equal(r.isExceeded, true);
  assert.equal(r.daysExceeded, 10);
});

test('calculateCalibration: calcula proxima calibracao a partir da coluna Inicio (startDate)', () => {
  // startDate = 15/03/2026 + 6 meses = 15/09/2026
  const { nextCalText, forecastDate } = calculateCalibration('2026-03-15', '2025-01-01', 6);
  assert.equal(nextCalText, '15/09/2026');
  assert.ok(forecastDate instanceof Date);
});

test('calculateCalibration: usa lastCalibration como fallback se startDate estiver ausente', () => {
  // sem startDate, usa lastCalibration: 10/02/2026 + 12 meses = 10/02/2027
  const { nextCalText } = calculateCalibration('', '2026-02-10', 12);
  assert.equal(nextCalText, '10/02/2027');
});

test('calculateCalibration: retorna *** se period for zero ou nao houver datas validas', () => {
  assert.equal(calculateCalibration('2026-03-15', '', 0).nextCalText, '***');
  assert.equal(calculateCalibration('', '', 6).nextCalText, '***');
});

test('getCalibrationStatus: calcula data alvo a partir da coluna Inicio para status previsto', () => {
  const service = base({ startDate: '2026-05-20', period: 6, lastCalibration: '2024-01-01', status: ServiceStatus.PREDICTED });
  const status = getCalibrationStatus(service);
  assert.equal(status.targetDateText, '20/11/2026');
  assert.equal(status.isForecast, true);
});

test('getCalibrationStatus: cliente confirmado nao exibe alerta de pendencia', () => {
  const service = base({ startDate: '2025-01-01', period: 6, status: ServiceStatus.CONFIRMED });
  const status = getCalibrationStatus(service);
  assert.equal(status.level, 'NONE');
});

test('filterServicesByPeriod: filtra exclusivamente pela data de inicio (startDate)', () => {
  const list: Service[] = [
    base({ id: 's1', startDate: '2025-03-10', endDate: '2025-03-14' }), // Início em Março 2025
    base({ id: 's2', startDate: '2025-03-28', endDate: '2025-04-03' }), // Início em Março 2025 (termina em Abril)
    base({ id: 's3', startDate: '2025-04-10', endDate: '2025-04-12' }), // Início em Abril 2025
    base({ id: 's4', startDate: '2024-08-05', endDate: '' }),           // Início em Agosto 2024
    base({ id: 's5', startDate: '', endDate: '2025-05-15' }),           // Sem startDate (apenas endDate)
    base({ id: 's6', startDate: '', endDate: '' }),                     // Sem data alguma
  ];

  // Março 2025 (month = 2) -> deve conter s1 e s2 (ambos iniciaram em março)
  const marco2025 = filterServicesByPeriod(list, 2025, 2);
  assert.deepEqual(marco2025.map(s => s.id), ['s1', 's2']);

  // Abril 2025 (month = 3) -> deve conter SOMENTE s3 (s2 iniciou em março, logo NÃO aparece em abril)
  const abril2025 = filterServicesByPeriod(list, 2025, 3);
  assert.deepEqual(abril2025.map(s => s.id), ['s3']);

  // Agosto 2024 (month = 7) -> deve conter s4
  const agosto2024 = filterServicesByPeriod(list, 2024, 7);
  assert.deepEqual(agosto2024.map(s => s.id), ['s4']);

  // Setembro 2026 (month = 8) -> NÃO deve conter s4 da Suzano de 2024!
  const set2026 = filterServicesByPeriod(list, 2026, 8);
  assert.equal(set2026.length, 0, 'nenhum servico de 2024/2025 deve vazar para Setembro de 2026');

  // Ano Inteiro 2025 (month = -1) -> deve conter s1, s2, s3 (que iniciam em 2025) e itens sem data (s5, s6)
  const ano2025 = filterServicesByPeriod(list, 2025, -1);
  assert.ok(ano2025.some(s => s.id === 's1'));
  assert.ok(ano2025.some(s => s.id === 's2'));
  assert.ok(ano2025.some(s => s.id === 's3'));
  assert.ok(ano2025.some(s => s.id === 's5'), 'sem startDate aparece em ano inteiro para permitir preenchimento');
  assert.ok(ano2025.some(s => s.id === 's6'), 'sem data aparece em ano inteiro para permitir preenchimento');
  assert.ok(!ano2025.some(s => s.id === 's4'), 's4 iniciou em 2024, nao deve aparecer em 2025');

  // Ano Inteiro 2024 (month = -1) -> deve conter s4
  const ano2024 = filterServicesByPeriod(list, 2024, -1);
  assert.ok(ano2024.some(s => s.id === 's4'));
  assert.ok(!ano2024.some(s => s.id === 's1'), 's1 iniciou em 2025, nao deve aparecer em 2024');
});

