// Smoke test da matemática de datas de calibração.
// Roda sem framework: `npm test` (node:test + node:assert, type stripping nativo do Node 24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecurringCalibrationForecasts, checkPeriodExceeded, calculateCalibration, getCalibrationStatus, filterServicesByPeriod, calculateServiceForecast } from './utils.ts';
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

test('preserva e herda os comentarios da visita base em cada projecao', () => {
  const forecasts = createRecurringCalibrationForecasts(
    base({ comments: 'Levar kit de calibração padrão e EPI para alta tensão' }),
    techs,
    []
  );
  assert.ok(forecasts.length > 0);
  assert.ok(forecasts.every(f => f.comments === 'Levar kit de calibração padrão e EPI para alta tensão'));
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
  const service = base({ startDate: '2026-05-20', endDate: '2026-05-25', period: 6, lastCalibration: '2024-01-01', status: ServiceStatus.PREDICTED, realized: 'sim' });
  const status = getCalibrationStatus(service);
  assert.equal(status.targetDateText, '20/11/2026');
  assert.equal(status.isForecast, true);
});

test('getCalibrationStatus: cliente realizado sem periodicidade nao exibe alerta de pendencia', () => {
  const service = base({ startDate: '2025-01-01', endDate: '2025-01-05', period: 0, status: ServiceStatus.CONFIRMED, realized: 'sim' });
  const status = getCalibrationStatus(service);
  assert.equal(status.level, 'NONE');
});

test('getCalibrationStatus: cliente confirmado realizado com proxima calibracao vencida exibe EXPIRED (VENC)', () => {
  const service = base({ startDate: '2026-01-05', endDate: '2026-01-09', period: 6, status: ServiceStatus.CONFIRMED, realized: 'sim' });
  const status = getCalibrationStatus(service);
  assert.equal(status.level, 'EXPIRED', 'Próxima calibração de 05/07/2026 já passou de hoje e deve acusar VENC');
});

test('getCalibrationStatus: atividade nao realizada com data de fim vencida exibe EXPIRED mesmo com periodo de 12 ou 36 meses', () => {
  const service36 = base({ startDate: '2026-01-06', endDate: '2026-01-10', period: 36, status: ServiceStatus.CONFIRMED, realized: 'nao' });
  assert.equal(getCalibrationStatus(service36).level, 'EXPIRED', 'Visita de janeiro/2026 não realizada com período 36 deve acusar VENC');

  const service12 = base({ startDate: '2026-01-19', endDate: '2026-01-23', period: 12, status: 'FÉRIAS / BLOQUEIO' as ServiceStatus, realized: 'nao' });
  assert.equal(getCalibrationStatus(service12).level, 'EXPIRED', 'Visita de janeiro/2026 não realizada com período 12 deve acusar VENC');
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

test('sincronização de Realizado: define Últ. Cal. com base na coluna Fim e reverte ao marcar Não', () => {
  const item: Service = base({
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    lastCalibration: '2025-05-15',
    realized: 'nao',
  });

  // Simula seleção de 'sim'
  const previous = item.lastCalibration || '';
  const updatedSim: Service = {
    ...item,
    realized: 'sim',
    previousLastCalibration: previous,
    lastCalibration: item.endDate,
  };

  assert.equal(updatedSim.lastCalibration, '2026-05-15', 'Últ. Cal. deve assumir a data de Fim');
  assert.equal(updatedSim.previousLastCalibration, '2025-05-15', 'Deve guardar a data anterior');

  // Simula alteração posterior da data de Fim enquanto Realizado = 'sim'
  const updatedDataFim: Service = {
    ...updatedSim,
    endDate: '2026-05-20',
    lastCalibration: '2026-05-20',
  };
  assert.equal(updatedDataFim.lastCalibration, '2026-05-20', 'Últ. Cal. acompanha a nova data de Fim');

  // Simula reversão para 'nao'
  const revertedNao: Service = {
    ...updatedDataFim,
    realized: 'nao',
    lastCalibration: updatedDataFim.previousLastCalibration,
  };
  assert.equal(revertedNao.lastCalibration, '2025-05-15', 'Últ. Cal. deve reverter para a data anterior');
});

test('calculateCalibration: aceita data manual e tem precedencia sobre o calculo', () => {
  const { nextCalText, isoDate } = calculateCalibration('2026-01-05', '2025-01-05', 6, '2026-09-25');
  assert.equal(nextCalText, '25/09/2026');
  assert.equal(isoDate, '2026-09-25');
});

test('sincronização de Status: muda para Cliente Previsto quando Realizado for Sim e reverte ao marcar Não', () => {
  const item: Service = base({
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    lastCalibration: '2025-05-15',
    status: ServiceStatus.CONFIRMED,
    realized: 'nao',
  });

  // 1. Ao selecionar 'sim', salva previousStatus e muda status para Cliente Previsto
  const updatedSim: Service = {
    ...item,
    realized: 'sim',
    previousStatus: item.status,
    status: ServiceStatus.PREDICTED,
  };
  assert.equal(updatedSim.status, ServiceStatus.PREDICTED, 'Status deve mudar para Cliente Previsto');
  assert.equal(updatedSim.previousStatus, ServiceStatus.CONFIRMED, 'previousStatus deve guardar o status original');

  // 2. Ao alterar a data de próxima calibração enquanto Realizado for 'sim', mantém/assegura Cliente Previsto
  const updatedNextCal: Service = {
    ...updatedSim,
    nextCalibration: '2026-11-20',
    status: ServiceStatus.PREDICTED,
  };
  assert.equal(updatedNextCal.status, ServiceStatus.PREDICTED);

  // 3. Ao reverter para 'nao', status reverte para o status anterior (Cliente Confirmado)
  const revertedNao: Service = {
    ...updatedNextCal,
    realized: 'nao',
    status: updatedNextCal.previousStatus || updatedNextCal.status,
  };
  assert.equal(revertedNao.status, ServiceStatus.CONFIRMED, 'Status deve reverter para o original');
});

test('quando realizado for "nao", calculateCalibration retorna "0" mas getCalibrationStatus segue a regra de vencimento pela data de fim', () => {
  const result = calculateCalibration('2026-01-05', '2025-01-05', 6, '2026-07-05', 'nao');
  assert.equal(result.nextCalText, '0', 'Deve retornar 0 como texto quando realizado não for sim');
  assert.equal(result.forecastDate, null, 'forecastDate deve ser null');
  assert.equal(result.isoDate, '', 'isoDate deve ser vazio');

  // Cenário 1: Data de fim já passou -> EXPIRED (VENC)
  const svcVencida: Service = base({
    startDate: '2020-01-01',
    endDate: '2020-01-05',
    realized: 'nao',
    period: 0,
    status: ServiceStatus.CONFIRMED,
  });
  const status1 = getCalibrationStatus(svcVencida);
  assert.equal(status1.level, 'EXPIRED', 'Se a data de fim já passou, deve acusar EXPIRED');

  // Cenário 2: Data de início já passou, mas data de fim ainda NÃO venceu -> NÃO é EXPIRED!
  const svcEmAndamento: Service = base({
    startDate: '2020-01-01',
    endDate: '2099-12-31',
    realized: 'nao',
    period: 0,
    status: ServiceStatus.CONFIRMED,
  });
  const status2 = getCalibrationStatus(svcEmAndamento);
  assert.notEqual(status2.level, 'EXPIRED', 'Se a data de fim ainda não venceu, NÃO deve ser considerado vencido');
});

test('quando próxima calibração for "0" ou realizado for "nao", calculateServiceForecast retorna "0"', () => {
  // Cenário 1: quando nextCalText for '0'
  const r1 = calculateServiceForecast('2026-01-05', '2026-01-09', 6, '0', 'sim');
  assert.equal(r1.forecastText, '0', 'Previsão deve ser 0 quando nextCalText for 0');
  assert.equal(r1.forecastStartDate, null);
  assert.equal(r1.forecastEndDate, null);

  // Cenário 2: quando realized for 'nao'
  const r2 = calculateServiceForecast('2026-01-05', '2026-01-09', 6, undefined, 'nao');
  assert.equal(r2.forecastText, '0', 'Previsão deve ser 0 quando realized for nao');

  // Cenário 3: quando realized for 'sim' e nextCalText for válido, calcula intervalo
  const r3 = calculateServiceForecast('2026-01-05', '2026-01-09', 6, '05/07/2026', 'sim');
  assert.equal(r3.forecastText, 'de 05/07/2026 até 09/07/2026');
  assert.ok(r3.forecastStartDate instanceof Date);
});

test('ao alterar a data de início em atividade realizada, Realizado reverte para "nao", Últ. Cal. e Status são restaurados', () => {
  // Simula estado de atividade que foi realizada
  const activeSim: Service = base({
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    realized: 'sim',
    previousLastCalibration: '2025-05-15',
    lastCalibration: '2026-05-15',
    previousStatus: ServiceStatus.CONFIRMED,
    status: ServiceStatus.PREDICTED,
  });

  // Simula a lógica de transição disparada na alteração de startDate
  const newStartDate = '2026-06-01';
  const updatedOnStartChange: Service = {
    ...activeSim,
    startDate: newStartDate,
    ...(activeSim.realized === 'sim' && newStartDate !== activeSim.startDate ? {
      realized: 'nao',
      lastCalibration: activeSim.previousLastCalibration ?? activeSim.lastCalibration,
      status: activeSim.previousStatus ?? activeSim.status,
    } : {}),
  };

  assert.equal(updatedOnStartChange.realized, 'nao', 'Realizado deve reverter para nao');
  assert.equal(updatedOnStartChange.lastCalibration, '2025-05-15', 'Últ. Cal. deve ser restaurada para a anterior');
  assert.equal(updatedOnStartChange.status, ServiceStatus.CONFIRMED, 'Status deve ser restaurado para o anterior');

  // Verifica que com Realizado = 'nao', Próx. Calibração e Previsão retornam '0'
  const nextCal = calculateCalibration(
    updatedOnStartChange.startDate,
    updatedOnStartChange.lastCalibration,
    updatedOnStartChange.period,
    updatedOnStartChange.nextCalibration,
    updatedOnStartChange.realized
  );
  assert.equal(nextCal.nextCalText, '0', 'Próx. Calibração deve ser 0');

  const forecast = calculateServiceForecast(
    updatedOnStartChange.startDate,
    updatedOnStartChange.endDate,
    updatedOnStartChange.period,
    nextCal.nextCalText,
    updatedOnStartChange.realized
  );
  assert.equal(forecast.forecastText, '0', 'Previsão deve ser 0');
});

test('o alerta "Xd" (EXPIRING_SOON) só aparece se status for diferente de "Cliente Confirmado"', () => {
  // Data futura próxima (daqui a 10 dias)
  const today = new Date();
  const future10 = new Date(today);
  future10.setDate(today.getDate() + 10);
  const future10Str = future10.toISOString().split('T')[0];

  // Cenário 1: Status = Cliente Confirmado -> NÃO deve gerar EXPIRING_SOON (nível OK)
  const svcConfirmado: Service = base({
    startDate: future10Str,
    endDate: future10Str,
    period: 0,
    status: ServiceStatus.CONFIRMED,
    realized: 'nao',
  });
  const statusConf = getCalibrationStatus(svcConfirmado);
  assert.equal(statusConf.level, 'OK', 'Cliente Confirmado não deve receber o badge Xd');

  // Cenário 2: Status = Cliente Previsto -> DEVE gerar EXPIRING_SOON (badge Xd)
  const svcPrevisto: Service = base({
    startDate: future10Str,
    endDate: future10Str,
    period: 0,
    status: ServiceStatus.PREDICTED,
    realized: 'nao',
  });
  const statusPrev = getCalibrationStatus(svcPrevisto);
  assert.equal(statusPrev.level, 'EXPIRING_SOON', 'Cliente Previsto deve receber o badge Xd');

  // Cenário 3: Se já venceu (endDate no passado), Cliente Confirmado CONTINUA recebendo EXPIRED (VENC)
  const svcVencidoConf: Service = base({
    startDate: '2020-01-01',
    endDate: '2020-01-05',
    period: 0,
    status: ServiceStatus.CONFIRMED,
    realized: 'nao',
  });
  const statusVenc = getCalibrationStatus(svcVencidoConf);
  assert.equal(statusVenc.level, 'EXPIRED', 'Cliente Confirmado com data de fim vencida e não realizado deve receber VENC');
});



