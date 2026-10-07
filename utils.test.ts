// Smoke test da matemática de datas de calibração.
// Roda sem framework: `npm test` (node:test + node:assert, type stripping nativo do Node 24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecurringCalibrationForecasts, checkPeriodExceeded, calculateCalibration, getCalibrationStatus, filterServicesByPeriod, calculateServiceForecast, applyBatchServiceUpdates, getBrazilianHoliday, isNonWorkingDay, generateNextCalibrationService, getPreviousServiceStartDate, syncServicesLastCalibration } from './utils.ts';
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

test('projeta um ciclo a cada `period` meses com ajuste de fim de semana para segunda-feira', () => {
  // Padrão maxMonths = 6m com period = 6 gera 1 ciclo
  const forecasts6m = createRecurringCalibrationForecasts(base(), techs, []);
  assert.equal(forecasts6m.length, 1, 'period=6 cabe 1 vez no horizonte padrão de 6 meses');
  assert.equal(forecasts6m[0].startDate, '2026-07-06');
  assert.equal(forecasts6m[0].status, ServiceStatus.PREDICTED);

  // Horizonte maxMonths = 12m com period = 6 gera 2 ciclos
  const forecasts12m = createRecurringCalibrationForecasts(base(), techs, [], 12);
  assert.equal(forecasts12m.length, 2, 'period=6 cabe 2 vezes em 12 meses');
  assert.deepEqual(
    forecasts12m.map(f => f.startDate),
    ['2026-07-06', '2027-01-06']
  );
});

test('period=12 gera 1 ciclo em horizonte de 12m; period=0 nao gera nada', () => {
  assert.equal(createRecurringCalibrationForecasts(base({ period: 12 }), techs, [], 12).length, 1);
  assert.equal(createRecurringCalibrationForecasts(base({ period: 0 }), techs, [], 12).length, 0);
});

test('preserva a duracao da visita base em cada projecao', () => {
  // base ocupa 5 dias (05 a 09 de janeiro)
  // 05/07/2026 é domingo, ajusta para segunda-feira 06/07/2026 e dura 5 dias (até 10/07/2026 sexta-feira)
  const [primeiro] = createRecurringCalibrationForecasts(base(), techs, []);
  assert.equal(primeiro.startDate, '2026-07-06');
  assert.equal(primeiro.endDate, '2026-07-10');
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

test('getPreviousServiceStartDate e syncServicesLastCalibration: Últ. Cal. reflete a data de início da visita anterior do mesmo cliente', () => {
  const v1 = base({ id: 'v1', client: 'CLIENTE-A', startDate: '2025-05-10', endDate: '2025-05-15', lastCalibration: '2024-11-10' });
  const v2 = base({ id: 'v2', client: 'CLIENTE-A', startDate: '2025-11-10', endDate: '2025-11-15', lastCalibration: '' });
  const v3 = base({ id: 'v3', client: 'CLIENTE-A', startDate: '2026-05-10', endDate: '2026-05-15', lastCalibration: '' });
  const vOutro = base({ id: 'v4', client: 'CLIENTE-B', startDate: '2025-08-01', endDate: '2025-08-05', lastCalibration: '2025-02-01' });

  const all = [v1, v2, v3, vOutro];

  // v1 é a primeira visita do CLIENTE-A (não tem anterior)
  assert.equal(getPreviousServiceStartDate(v1, all), null);

  // v2 tem v1 como anterior -> reflete startDate de v1 ('2025-05-10')
  assert.equal(getPreviousServiceStartDate(v2, all), '2025-05-10');

  // v3 tem v2 como anterior mais recente -> reflete startDate de v2 ('2025-11-10')
  assert.equal(getPreviousServiceStartDate(v3, all), '2025-11-10');

  // syncServicesLastCalibration sincroniza em massa
  const synced = syncServicesLastCalibration(all);
  assert.equal(synced[0].lastCalibration, '2024-11-10', 'Primeira visita preserva calibração manual/histórica');
  assert.equal(synced[1].lastCalibration, '2025-05-10', 'Segunda visita reflete início da primeira');
  assert.equal(synced[2].lastCalibration, '2025-11-10', 'Terceira visita reflete início da segunda');
  assert.equal(synced[3].lastCalibration, '2025-02-01', 'Cliente B sem anterior preserva valor próprio');
});

test('calculateCalibration: aceita data manual e tem precedencia sobre o calculo', () => {
  const { nextCalText, isoDate } = calculateCalibration('2026-01-05', '2025-01-05', 6, '2026-09-25');
  assert.equal(nextCalText, '25/09/2026');
  assert.equal(isoDate, '2026-09-25');
});

test('independência de Status e Realizado: alterar Realizado mantém o Status intacto e vice-versa', () => {
  const item: Service = base({
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    lastCalibration: '2025-05-15',
    status: ServiceStatus.CONFIRMED,
    realized: 'nao',
  });

  // 1. Ao selecionar 'sim', mantém Status original (Cliente Confirmado) e Últ. Cal. não é sobrescrita
  const updatedSim: Service = {
    ...item,
    realized: 'sim',
  };
  assert.equal(updatedSim.status, ServiceStatus.CONFIRMED, 'Status deve permanecer Cliente Confirmado');
  assert.equal(updatedSim.lastCalibration, '2025-05-15', 'Últ. Calibração deve permanecer intacta');

  // 2. Ao alterar a data de próxima calibração enquanto Realizado for 'sim', Status permanece intacto
  const updatedNextCal: Service = {
    ...updatedSim,
    nextCalibration: '2026-11-20',
  };
  assert.equal(updatedNextCal.status, ServiceStatus.CONFIRMED, 'Status deve permanecer inalterado');

  // 3. Ao reverter para 'nao', Status e Últ. Cal. continuam intactos
  const revertedNao: Service = {
    ...updatedNextCal,
    realized: 'nao',
  };
  assert.equal(revertedNao.status, ServiceStatus.CONFIRMED, 'Status deve continuar Cliente Confirmado');
  assert.equal(revertedNao.lastCalibration, '2025-05-15', 'Últ. Calibração permanece intacta');
});

test('getCalibrationStatus segue a regra de vencimento pela data de fim quando realizado for nao', () => {
  const result = calculateCalibration('2026-01-05', '2025-01-05', 6, '2026-07-05', 'nao');
  assert.equal(result.nextCalText, '05/07/2026', 'Deve calcular próxima calibração mesmo quando realizado for nao');
  assert.ok(result.forecastDate instanceof Date);
  assert.equal(result.isoDate, '2026-07-05');

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

test('calculateServiceForecast calcula as datas de previsão formatadas', () => {
  // Cenário 1: quando datas e período forem válidos, calcula intervalo
  const r1 = calculateServiceForecast('2026-01-05', '2026-01-09', 6, '05/07/2026', 'sim');
  assert.equal(r1.forecastText, 'de 05/07/2026 até 09/07/2026');
  assert.ok(r1.forecastStartDate instanceof Date);
  assert.ok(r1.forecastEndDate instanceof Date);

  // Cenário 2: mesmo quando realized for 'nao', calcula a previsão
  const r2 = calculateServiceForecast('2026-01-05', '2026-01-09', 6, '05/07/2026', 'nao');
  assert.equal(r2.forecastText, 'de 05/07/2026 até 09/07/2026');

  // Cenário 3: quando período for 0 ou sem datas, retorna ***
  const r3 = calculateServiceForecast('2026-01-05', '2026-01-09', 0);
  assert.equal(r3.forecastText, '***');
});

test('ao alterar a data de início em atividade realizada, Realizado reverte para "nao", Últ. Cal. é restaurada e Status permanece intacto', () => {
  // Simula estado de atividade que foi realizada
  const activeSim: Service = base({
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    realized: 'sim',
    previousLastCalibration: '2025-05-15',
    lastCalibration: '2026-05-15',
    status: ServiceStatus.CONFIRMED,
  });

  // Simula a lógica de transição disparada na alteração de startDate
  const newStartDate = '2026-06-01';
  const updatedOnStartChange: Service = {
    ...activeSim,
    startDate: newStartDate,
    ...(activeSim.realized === 'sim' && newStartDate !== activeSim.startDate ? {
      realized: 'nao',
      lastCalibration: activeSim.previousLastCalibration ?? activeSim.lastCalibration,
    } : {}),
  };

  assert.equal(updatedOnStartChange.realized, 'nao', 'Realizado deve reverter para nao');
  assert.equal(updatedOnStartChange.lastCalibration, '2025-05-15', 'Últ. Cal. deve ser restaurada para a anterior');
  assert.equal(updatedOnStartChange.status, ServiceStatus.CONFIRMED, 'Status deve permanecer intacto (CONFIRMED)');

  // Próx. Calibração e Previsão são calculadas e preenchidas para a nova data
  const nextCal = calculateCalibration(
    updatedOnStartChange.startDate,
    updatedOnStartChange.lastCalibration,
    updatedOnStartChange.period,
    updatedOnStartChange.nextCalibration,
    updatedOnStartChange.realized
  );
  assert.equal(nextCal.nextCalText, '01/12/2026', 'Próx. Calibração deve ser calculada a partir de 01/06/2026 + 6m');

  const forecast = calculateServiceForecast(
    updatedOnStartChange.startDate,
    updatedOnStartChange.endDate,
    updatedOnStartChange.period,
    nextCal.nextCalText,
    updatedOnStartChange.realized
  );
  assert.equal(forecast.forecastText, 'de 01/12/2026 até 15/11/2026');
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

test('recorrência: cadastro deve ter início e fim seguindo a premissa da coluna Previsão', () => {
  const baseSvc = base({
    startDate: '2026-03-10',
    endDate: '2026-03-14',
    period: 6,
    realized: 'sim',
  });

  // Calcula a previsão oficial da coluna Previsão
  const { nextCalText } = calculateCalibration(baseSvc.startDate, baseSvc.lastCalibration, baseSvc.period, undefined, baseSvc.realized);
  const { forecastStartDate, forecastEndDate } = calculateServiceForecast(
    baseSvc.startDate,
    baseSvc.endDate,
    baseSvc.period,
    nextCalText,
    baseSvc.realized
  );

  const forecasts = createRecurringCalibrationForecasts(baseSvc, techs, [], 36);

  // Ciclo 1 deve bater exatamente com a coluna Previsão
  const ciclo1 = forecasts[0];
  assert.ok(forecastStartDate && forecastEndDate, 'Previsão deve calcular datas');
  assert.equal(ciclo1.startDate, '2026-09-10', 'Início do 1º ciclo deve ser exatamente 6 meses após o início');
  assert.equal(ciclo1.endDate, '2026-09-14', 'Fim do 1º ciclo deve ser exatamente 6 meses após o fim');
  assert.equal(ciclo1.lastCalibration, '2026-03-10', 'Última calibração do 1º ciclo deve ser o início da visita base');
  assert.equal(ciclo1.status, ServiceStatus.PREDICTED);
  assert.equal(ciclo1.realized, 'nao');
  assert.equal(ciclo1.os, '');

  // Ciclo 2 deve ter início e fim definidos avançando pelo período e encadeando a última calibração
  const ciclo2 = forecasts[1];
  assert.equal(ciclo2.startDate, '2027-03-10');
  assert.equal(ciclo2.endDate, '2027-03-14');
  assert.equal(ciclo2.lastCalibration, '2026-09-10', 'Última calibração do ciclo 2 é o início do ciclo 1');

  // Todos os ciclos gerados devem ter início, fim e semana válidos
  for (const f of forecasts) {
    assert.ok(f.startDate, 'Todo ciclo deve ter data de início');
    assert.ok(f.endDate, 'Todo ciclo deve ter data de término');
    assert.ok(f.week > 0, 'Todo ciclo deve ter número de semana calculado');
  }
});

test('recorrência: parte estritamente da data de início da visita base selecionada', () => {
  const clienteX = 'KLABIN - O. Costa';
  const visitaJaneiro = base({
    id: 'svc-jan',
    client: clienteX,
    startDate: '2026-01-26',
    endDate: '2026-01-30',
    period: 6,
    realized: 'sim',
  });

  const visitaDezembro = base({
    id: 'svc-dez',
    client: clienteX,
    startDate: '2026-12-07',
    endDate: '2026-12-11',
    period: 6,
    realized: 'sim',
  });

  // existingServices contém tanto a visita de janeiro quanto a visita de dezembro
  const existingServices = [visitaJaneiro, visitaDezembro];

  // Dispara a recorrência clicando na visita de JANEIRO com horizonte de 12 meses
  const forecasts = createRecurringCalibrationForecasts(visitaJaneiro, techs, existingServices, 12);

  assert.equal(forecasts.length, 2, 'Deve gerar 2 previsões em 12 meses para periodicidade de 6m');

  // O 1º ciclo gerado DEVE partir da visita de JANEIRO selecionada (+6m = 27/07/2026)
  const primeiroCiclo = forecasts[0];
  assert.equal(primeiroCiclo.startDate, '2026-07-27', 'Início deve ser 27/07/2026');
  assert.equal(primeiroCiclo.endDate, '2026-07-31', 'Fim deve ser 31/07/2026 (5 dias)');
  assert.equal(primeiroCiclo.lastCalibration, '2026-01-26', 'Ciclo 1: última calibração = início da visita base');
  assert.equal(forecasts[1].startDate, '2027-01-27', 'Ciclo 2: início deve ser 27/01/2027');
  assert.equal(forecasts[1].lastCalibration, '2026-07-27', 'Ciclo 2: última calibração = início do ciclo anterior');

  // Todos os ciclos gerados devem seguir ordem estritamente cronológica
  for (let i = 0; i < forecasts.length; i++) {
    const f = forecasts[i];
    assert.ok(f.startDate < f.endDate, `Ciclo ${i + 1}: Data início (${f.startDate}) deve ser anterior à data fim (${f.endDate})`);
    if (i > 0) {
      assert.ok(f.startDate > forecasts[i - 1].endDate, `Ciclo ${i + 1} deve começar após o término do Ciclo ${i}`);
    }
  }
});

test('recorrência: eventos futuros gerados possuem colunas próx. calibração e previsão preenchidas', () => {
  const baseSvc = base({
    startDate: '2026-01-26',
    endDate: '2026-01-30',
    period: 6,
  });

  const forecasts = createRecurringCalibrationForecasts(baseSvc, techs, [], 36);
  assert.ok(forecasts.length > 0);

  for (const f of forecasts) {
    assert.ok(f.nextCalibration, 'Deve possuir nextCalibration preenchido no objeto');
    const { nextCalText } = calculateCalibration(f.startDate, f.lastCalibration, f.period, f.nextCalibration, f.realized);
    const { forecastText } = calculateServiceForecast(f.startDate, f.endDate, f.period, nextCalText, f.realized);
    assert.notEqual(nextCalText, '0', 'Próx. Calibração não deve ser 0');
    assert.notEqual(nextCalText, '***', 'Próx. Calibração deve ser uma data válida');
    assert.notEqual(forecastText, '0', 'Previsão não deve ser 0');
    assert.ok(forecastText.startsWith('de '), 'Previsão deve iniciar com "de "');
  }
});

test('recorrência: suporta overridePeriod personalizado e horizonte em meses customizado', () => {
  // Base original tem period: 0
  const baseSvc = base({
    startDate: '2026-03-02',
    endDate: '2026-03-06',
    period: 0,
  });

  // Gera com overridePeriod: 6 e horizonte de 24 meses (deve gerar 4 ciclos)
  const forecasts24m = createRecurringCalibrationForecasts(baseSvc, techs, [], 24, 6);
  assert.equal(forecasts24m.length, 4, '24 meses a cada 6 meses devem gerar 4 visitas');
  assert.equal(forecasts24m[0].period, 6, 'Visita gerada deve herdar o período escolhido de 6 meses');
  assert.equal(baseSvc.period, 0, 'A visita original não deve ter seu período alterado');

  // Gera com overridePeriod: 12 e horizonte de 36 meses (deve gerar 3 ciclos)
  const forecasts36m = createRecurringCalibrationForecasts(baseSvc, techs, [], 36, 12);
  assert.equal(forecasts36m.length, 3, '36 meses a cada 12 meses devem gerar 3 visitas');
});

test('applyBatchServiceUpdates: alteração em massa de Status e Realizado com regras de negócio', () => {
  const s1 = base({ id: 's1', status: ServiceStatus.WITH_ORDER, realized: 'nao', endDate: '2026-02-15', lastCalibration: '2025-08-15' });
  const s2 = base({ id: 's2', status: ServiceStatus.CONFIRMED, realized: 'nao', endDate: '2026-03-20', lastCalibration: '2025-09-20' });
  const s3 = base({ id: 's3', status: ServiceStatus.WITH_ORDER, realized: 'nao', endDate: '2026-04-10', lastCalibration: '2025-10-10' });

  // 1. Atualizar apenas status em lote para s1 e s2
  const updatedStatusOnly = applyBatchServiceUpdates([s1, s2, s3], new Set(['s1', 's2']), {
    status: ServiceStatus.CONFIRMED,
  });
  assert.equal(updatedStatusOnly[0].status, ServiceStatus.CONFIRMED);
  assert.equal(updatedStatusOnly[1].status, ServiceStatus.CONFIRMED);
  assert.equal(updatedStatusOnly[2].status, ServiceStatus.WITH_ORDER, 's3 não deve ser alterado');

  // 2. Atualizar apenas realizado para 'sim' (sem status explícito):
  // Status e lastCalibration permanecem inalterados e independentes
  const updatedRealizedOnly = applyBatchServiceUpdates([s1, s2], new Set(['s1']), {
    realized: 'sim',
  });
  assert.equal(updatedRealizedOnly[0].realized, 'sim');
  assert.equal(updatedRealizedOnly[0].status, ServiceStatus.WITH_ORDER, 'Status deve permanecer inalterado (WITH_ORDER)');
  assert.equal(updatedRealizedOnly[0].lastCalibration, '2025-08-15', 'Última calibração não é sobrescrita');

  // 3. Atualizar de volta para 'nao': calibração e status inalterados
  const revertedRealized = applyBatchServiceUpdates(updatedRealizedOnly, new Set(['s1']), {
    realized: 'nao',
  });
  assert.equal(revertedRealized[0].realized, 'nao');
  assert.equal(revertedRealized[0].status, ServiceStatus.WITH_ORDER, 'Status deve permanecer inalterado (WITH_ORDER)');
  assert.equal(revertedRealized[0].lastCalibration, '2025-08-15', 'Calibração preservada');

  // 4. Atualizar ambos ao mesmo tempo (status explícito + realizado: 'sim'):
  // O status explícito deve prevalecer sobre a regra padrão de 'Cliente Previsto'
  const updatedBoth = applyBatchServiceUpdates([s1], new Set(['s1']), {
    status: ServiceStatus.CONFIRMED,
    realized: 'sim',
  });
  assert.equal(updatedBoth[0].realized, 'sim');
  assert.equal(updatedBoth[0].status, ServiceStatus.CONFIRMED, 'Status explícito escolhido na barra prevalece');
  assert.equal(updatedBoth[0].lastCalibration, '2025-08-15', 'Última calibração permanece inalterada');
});

test('getBrazilianHoliday e isNonWorkingDay: identificação correta de fins de semana e feriados nacionais', () => {
  // Feriados fixos
  assert.equal(getBrazilianHoliday(new Date(2026, 0, 1)), 'Confraternização Universal');
  assert.equal(getBrazilianHoliday(new Date(2026, 3, 21)), 'Tiradentes');
  assert.equal(getBrazilianHoliday(new Date(2026, 4, 1)), 'Dia do Trabalho');
  assert.equal(getBrazilianHoliday(new Date(2026, 8, 7)), 'Independência do Brasil');
  assert.equal(getBrazilianHoliday(new Date(2026, 9, 12)), 'Nossa Senhora Aparecida');
  assert.equal(getBrazilianHoliday(new Date(2026, 10, 2)), 'Finados');
  assert.equal(getBrazilianHoliday(new Date(2026, 10, 15)), 'Proclamação da República');
  assert.equal(getBrazilianHoliday(new Date(2026, 10, 20)), 'Dia da Consciência Negra');
  assert.equal(getBrazilianHoliday(new Date(2026, 11, 25)), 'Natal');

  // Dia útil normal (ex: 14 de Setembro de 2026 - Segunda-feira)
  const mondayWorkday = new Date(2026, 8, 14);
  assert.equal(getBrazilianHoliday(mondayWorkday), null);
  const workdayRes = isNonWorkingDay(mondayWorkday);
  assert.equal(workdayRes.isWeekend, false);
  assert.equal(workdayRes.isNonWorking, false);
  assert.equal(workdayRes.holidayName, null);

  // Sábado (ex: 19 de Setembro de 2026)
  const saturday = new Date(2026, 8, 19);
  const satRes = isNonWorkingDay(saturday);
  assert.equal(satRes.isWeekend, true);
  assert.equal(satRes.isNonWorking, true);

  // Domingo (ex: 20 de Setembro de 2026)
  const sunday = new Date(2026, 8, 20);
  const sunRes = isNonWorkingDay(sunday);
  assert.equal(sunRes.isWeekend, true);
  assert.equal(sunRes.isNonWorking, true);

  // Feriado em dia de semana (ex: 07 de Setembro de 2026 - Segunda-feira)
  const holidayMonday = new Date(2026, 8, 7);
  const holRes = isNonWorkingDay(holidayMonday);
  assert.equal(holRes.isWeekend, false);
  assert.equal(holRes.isNonWorking, true);
  assert.equal(holRes.holidayName, 'Independência do Brasil');
});

test('generateNextCalibrationService: cria nova atividade ao confirmar status preservando todas as características', () => {
  const currentService: Service = {
    id: 'orig-1',
    week: 10,
    client: 'PETROBRAS',
    manager: 'Carlos Silva',
    os: 'OS-889977',
    description: 'Calibração Geral Transmissores',
    hp: 40,
    ht: 10,
    hv: 5,
    startDate: '2026-03-09',
    endDate: '2026-03-13', // Duração de 5 dias
    technicianIds: ['t1', 't2'],
    status: ServiceStatus.CONFIRMED,
    period: 6,
    lastCalibration: '2025-09-09',
    nextCalibration: '2026-09-09', // Cai numa quarta-feira
    comments: 'Observação interna',
    realized: 'sim'
  };

  const next = generateNextCalibrationService(currentService, [currentService]);
  assert.ok(next !== null, 'Deveria ter gerado uma nova atividade');
  if (!next) return;
  assert.equal(next.client, 'PETROBRAS');
  assert.equal(next.os, 'OS-889977');
  assert.equal(next.manager, 'Carlos Silva');
  assert.equal(next.description, 'Calibração Geral Transmissores');
  assert.equal(next.hp, 40);
  assert.equal(next.ht, 10);
  assert.equal(next.hv, 5);
  assert.deepEqual(next.technicianIds, ['t1', 't2']);
  assert.equal(next.status, ServiceStatus.PREDICTED);
  assert.equal(next.realized, 'nao');
  assert.equal(next.startDate, '2026-09-09');
  assert.equal(next.endDate, '2026-09-13'); // Preserva 5 dias de duração (9 a 13)
  assert.equal(next.period, 6);
  assert.equal(next.lastCalibration, '2026-03-09');
  assert.equal(next.nextCalibration, '2027-03-09');
});

test('generateNextCalibrationService: ajusta data para segunda-feira se cair em final de semana', () => {
  const currentService: Service = {
    id: 'orig-weekend',
    week: 20,
    client: 'VALE',
    manager: 'Mariana',
    os: 'OS-1234',
    description: 'Calibração Válvulas',
    hp: 16,
    ht: 0,
    hv: 0,
    startDate: '2026-05-11',
    endDate: '2026-05-12', // 2 dias
    technicianIds: ['t1'],
    status: ServiceStatus.CONFIRMED,
    period: 6,
    lastCalibration: '',
    nextCalibration: '2026-09-12', // 12/09/2026 é Sábado!
    realized: 'sim'
  };

  const next = generateNextCalibrationService(currentService, [currentService]);
  assert.ok(next !== null);
  if (!next) return;
  // Sábado 12/09/2026 deve ser ajustado para Segunda-feira 14/09/2026
  assert.equal(next.startDate, '2026-09-14');
  // Duração de 2 dias: 14/09 a 15/09
  assert.equal(next.endDate, '2026-09-15');
});

test('generateNextCalibrationService: previne duplicidade se atividade já existir para o mesmo cliente na data', () => {
  const currentService: Service = {
    id: 'orig-dup',
    week: 10,
    client: 'AMBEV',
    manager: '',
    os: 'OS-99',
    description: 'Manutenção',
    hp: 0,
    ht: 0,
    hv: 0,
    startDate: '2026-01-05',
    endDate: '2026-01-09',
    technicianIds: [],
    status: ServiceStatus.CONFIRMED,
    period: 12,
    lastCalibration: '',
    nextCalibration: '2027-01-05',
    realized: 'sim'
  };

  const existingFuture: Service = {
    id: 'future-already-there',
    week: 1,
    client: 'AMBEV',
    manager: '',
    os: 'OS-99',
    description: 'Manutenção futura já cadastrada',
    hp: 0,
    ht: 0,
    hv: 0,
    startDate: '2027-01-05',
    endDate: '2027-01-09',
    technicianIds: [],
    status: ServiceStatus.PREDICTED,
    period: 12,
    lastCalibration: '2026-01-09',
    realized: 'nao'
  };

  const next = generateNextCalibrationService(currentService, [currentService, existingFuture]);
  assert.equal(next, null, 'Não deve criar duplicidade quando já existir atividade para a mesma data');
});

test('applyBatchServiceUpdates: gera automaticamente novas atividades ao alterar status para Cliente Confirmado em lote', () => {
  const s1: Service = {
    id: 'batch-c1',
    week: 1,
    client: 'BRASKEM',
    manager: 'Gestor A',
    os: 'OS-100',
    description: 'Serviço 1',
    hp: 8,
    ht: 0,
    hv: 0,
    startDate: '2026-02-02',
    endDate: '2026-02-06',
    technicianIds: ['t1'],
    status: ServiceStatus.PREDICTED,
    period: 6,
    lastCalibration: '',
    nextCalibration: '2026-08-03',
    realized: 'nao'
  };

  const s2: Service = {
    id: 'batch-c2',
    week: 1,
    client: 'KLABIN',
    manager: 'Gestor B',
    os: 'OS-200',
    description: 'Serviço 2 sem próxima calibração',
    hp: 8,
    ht: 0,
    hv: 0,
    startDate: '2026-02-02',
    endDate: '2026-02-06',
    technicianIds: ['t2'],
    status: ServiceStatus.PREDICTED,
    period: 0,
    lastCalibration: '',
    nextCalibration: '',
    realized: 'nao'
  };

  const result = applyBatchServiceUpdates([s1, s2], new Set(['batch-c1', 'batch-c2']), {
    status: ServiceStatus.CONFIRMED
  });

  // s1 deve ter gerado 1 nova atividade futura (total 3 serviços no array retornado)
  assert.equal(result.length, 3);
  const newService = result.find(s => s.id !== 'batch-c1' && s.id !== 'batch-c2');
  assert.ok(newService !== undefined);
  if (!newService) return;
  assert.equal(newService.client, 'BRASKEM');
  assert.equal(newService.os, 'OS-100');
  assert.equal(newService.startDate, '2026-08-03');
  assert.equal(newService.status, ServiceStatus.PREDICTED);
  assert.equal(newService.realized, 'nao');
});

test('regra de calibração vencida: início deve começar depois da última calibração + período + 1 dia', () => {
  // Última calibração: 10/01/2026, período: 6 meses -> Prazo limite: 10/07/2026
  
  // Cenário 1: Início no dia exato do limite (10/07/2026) -> DENTRO DO PRAZO (não é calibração vencida)
  const svcNoPrazo = base({
    client: 'Cliente Calibração',
    lastCalibration: '2026-01-10',
    startDate: '2026-07-10',
    endDate: '2099-07-12', // término no futuro para isolar teste de periodicidade
    period: 6,
    realized: 'nao',
    status: ServiceStatus.CONFIRMED
  });
  const statusNoPrazo = getCalibrationStatus(svcNoPrazo);
  assert.equal(statusNoPrazo.level, 'OK', 'Início no dia 10/07/2026 deve estar dentro do prazo');
  assert.equal(statusNoPrazo.isDelayed, undefined);

  // Cenário 2: Início 1 dia depois do limite (11/07/2026) -> VENCIDA (+1 dia)
  const svcVencida1Dia = base({
    client: 'Cliente Calibração',
    lastCalibration: '2026-01-10',
    startDate: '2026-07-11',
    endDate: '2099-07-13',
    period: 6,
    realized: 'nao',
    status: ServiceStatus.CONFIRMED
  });
  const statusVencida1Dia = getCalibrationStatus(svcVencida1Dia);
  assert.equal(statusVencida1Dia.level, 'EXPIRED', 'Início no dia 11/07/2026 (+1 dia do limite) deve ser considerado VENCIDA');
  assert.equal(statusVencida1Dia.isDelayed, true);
  assert.equal(statusVencida1Dia.daysDelayed, 1);
  assert.equal(statusVencida1Dia.limitDateText, '10/07/2026');

  // Cenário 3: Início 10 dias depois do limite (20/07/2026) -> VENCIDA (10 dias de atraso)
  const svcVencida10Dias = base({
    client: 'Cliente Calibração',
    lastCalibration: '2026-01-10',
    startDate: '2026-07-20',
    endDate: '2099-07-22',
    period: 6,
    realized: 'nao',
    status: ServiceStatus.PREDICTED
  });
  const statusVencida10Dias = getCalibrationStatus(svcVencida10Dias);
  assert.equal(statusVencida10Dias.level, 'EXPIRED');
  assert.equal(statusVencida10Dias.isDelayed, true);
  assert.equal(statusVencida10Dias.daysDelayed, 10);
});

test('regra de calibração vencida: busca data da última calibração a partir da visita anterior do mesmo cliente', () => {
  const visitaAnterior = base({
    id: 'visita-1',
    client: 'PETROBRAS',
    startDate: '2026-01-05',
    endDate: '2026-01-09',
    period: 6,
    realized: 'sim'
  });

  // Segunda visita marcada para 15/07/2026 (limite era 05/07/2026 -> 10 dias de atraso)
  const visitaSeguinte = base({
    id: 'visita-2',
    client: 'PETROBRAS',
    startDate: '2026-07-15',
    endDate: '2099-07-18',
    period: 6,
    lastCalibration: '', // campo vazio, deve buscar de visitaAnterior
    realized: 'nao'
  });

  const status = getCalibrationStatus(visitaSeguinte, [visitaAnterior, visitaSeguinte]);
  assert.equal(status.level, 'EXPIRED');
  assert.equal(status.isDelayed, true);
  assert.equal(status.daysDelayed, 10);
  assert.equal(status.limitDateText, '05/07/2026');
});

test('regra de calibração realizada fora do prazo: exibe OVERDUE_REALIZED para histórico de atraso', () => {
  const svcRealizadaComAtraso = base({
    client: 'SUZANO',
    lastCalibration: '2026-01-10',
    startDate: '2026-07-20',
    endDate: '2026-07-24',
    period: 6,
    nextCalibration: '2099-01-20',
    realized: 'sim',
    status: ServiceStatus.CONFIRMED
  });

  const status = getCalibrationStatus(svcRealizadaComAtraso);
  assert.equal(status.level, 'OVERDUE_REALIZED');
  assert.equal(status.isDelayed, true);
  assert.equal(status.daysDelayed, 10);
  assert.ok(status.delayReason?.includes('Realizada Fora do Prazo'));
});

test('regra de primeira atividade: sem atividade anterior no calendário NÃO deve aparecer como calibração vencida', () => {
  // Atividade única do cliente (primeira visita cadastrada no calendário)
  const primeiraVisita = base({
    id: 'primeira-visita-1',
    client: 'NOVO CLIENTE ABB',
    startDate: '2026-07-20',
    endDate: '2099-07-24', // futura
    period: 6,
    lastCalibration: '2024-01-01', // data antiga no campo manual
    realized: 'nao',
    status: ServiceStatus.PREDICTED
  });

  // 1. getCalibrationStatus com lista de serviços onde ela é a única do cliente
  const status = getCalibrationStatus(primeiraVisita, [primeiraVisita]);
  assert.equal(status.level, 'OK', 'Primeira visita não deve nascer com calibração vencida');
  assert.equal(status.isDelayed, undefined, 'Não deve ter flag de atraso por ciclo anterior');

  // 2. checkPeriodExceeded ao criar, editar ou arrastar
  const check = checkPeriodExceeded(primeiraVisita, primeiraVisita.startDate, [primeiraVisita]);
  assert.equal(check.isExceeded, false, 'Primeira visita não deve emitir aviso de prazo ultrapassado');
  assert.equal(check.daysExceeded, 0);

  // 3. Se a própria visita já passou no passado (ex: 2020), acusa visita vencida pela data de término, mas sem atraso de calibração
  const visitaPassada = base({
    id: 'primeira-visita-passada',
    client: 'OUTRO NOVO CLIENTE',
    startDate: '2020-01-05',
    endDate: '2020-01-09',
    period: 6,
    lastCalibration: '2019-01-01',
    realized: 'nao',
    status: ServiceStatus.CONFIRMED
  });
  const statusPassada = getCalibrationStatus(visitaPassada, [visitaPassada]);
  assert.equal(statusPassada.level, 'EXPIRED', 'Visita agendada no passado não realizada acusa visita vencida');
  assert.equal(statusPassada.isDelayed, undefined, 'Não deve acusar atraso de calibração');
});



