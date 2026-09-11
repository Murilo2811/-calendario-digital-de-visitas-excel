// Round-trip do Excel: o que buildWorkbook escreve, parseWorkbookData tem que ler de volta igual.
// As duas metades vivem em arquivos diferentes e divergem em silencio se ninguem checar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildWorkbook, parseWorkbookData } from './excelService.ts';
import { ServiceStatus, TechType } from './types.ts';
import type { Service, Technician, Client, User } from './types.ts';

const technicians: Technician[] = [
  { id: 't1', name: 'ES', fullName: 'Eduardo Silva', type: TechType.INTERNAL, color: 'bg-red-100' },
  { id: 't2', name: 'CG', fullName: 'Carlos Gomes', type: TechType.PJ, color: 'bg-amber-100' },
];

const clients: Client[] = [
  { id: 'c1', name: 'Cliente A', city: 'Campinas', state: 'SP', contactName: 'Eng. Teste' },
];

const users: User[] = [
  { id: 'u1', username: 'operador teste', passwordHash: 'a'.repeat(64), role: 'operador', fullName: 'Operador Teste', createdAt: '2026-01-02' },
];

const services: Service[] = [
  {
    id: 's1', week: 2, client: 'Cliente A', manager: 'Gerente', os: '500000001',
    description: 'PMA', hp: 5, ht: 40, hv: 6,
    startDate: '2026-01-05', endDate: '2026-01-09',
    technicianIds: ['t1', 't2'], status: ServiceStatus.CONFIRMED,
    lastCalibration: '2025-07-05', period: 6,
    comments: 'Nota técnica de teste para calibração preventiva',
  },
  {
    id: 's2', week: 10, client: 'Cliente A', manager: 'Gerente', os: '',
    description: 'Calibração Prevista (+6m - Ciclo 1) - Ref. OS 500000001', hp: 0, ht: 8, hv: 0,
    startDate: '2026-07-05', endDate: '2026-07-09',
    technicianIds: ['t1'], status: ServiceStatus.PREDICTED,
    lastCalibration: '2026-01-09', period: 6,
  },
];

/** Escreve e le de volta, como faz o salvar/recarregar de verdade. */
const roundTrip = () => {
  const buffer = XLSX.write(buildWorkbook(services, technicians, clients, users), { type: 'array', bookType: 'xlsx' });
  return parseWorkbookData(XLSX.read(buffer, { type: 'array', cellDates: true }));
};

test('preserva as atividades, com datas, periodicidade e comentarios', () => {
  const lido = roundTrip();

  assert.equal(lido.services.length, 2);
  assert.deepEqual(
    lido.services.map(s => [s.id, s.startDate, s.endDate, s.period]),
    [['s1', '2026-01-05', '2026-01-09', 6], ['s2', '2026-07-05', '2026-07-09', 6]],
  );
  assert.equal(lido.services[0].status, ServiceStatus.CONFIRMED);
  assert.equal(lido.services[1].status, ServiceStatus.PREDICTED);
  assert.equal(lido.services[0].lastCalibration, '2025-07-05');
  assert.equal(lido.services[0].comments, 'Nota técnica de teste para calibração preventiva');
  assert.equal(lido.services[1].comments, '');
});

test('reconstroi os tecnicos de cada atividade a partir das siglas', () => {
  const lido = roundTrip();
  assert.deepEqual(lido.services[0].technicianIds, ['t1', 't2']);
  assert.deepEqual(lido.services[1].technicianIds, ['t1']);
});

test('preserva tecnicos, clientes e usuarios', () => {
  const lido = roundTrip();

  assert.deepEqual(lido.technicians.map(t => [t.id, t.name, t.type]), [['t1', 'ES', TechType.INTERNAL], ['t2', 'CG', TechType.PJ]]);
  assert.equal(lido.clients[0].name, 'Cliente A');
  assert.equal(lido.clients[0].city, 'Campinas');
  assert.equal(lido.users[0].username, 'operador teste');
  assert.equal(lido.users[0].passwordHash, 'a'.repeat(64));
  assert.equal(lido.users[0].role, 'operador');
});

test('planilha vazia nao quebra a leitura', () => {
  const buffer = XLSX.write(buildWorkbook([], [], [], []), { type: 'array', bookType: 'xlsx' });
  const lido = parseWorkbookData(XLSX.read(buffer, { type: 'array', cellDates: true }));
  assert.deepEqual([lido.services, lido.technicians, lido.clients, lido.users], [[], [], [], []]);
});
