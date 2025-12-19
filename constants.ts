import { Service, ServiceStatus, Technician, TechType, Client } from './types';

export const TECHNICIANS: Technician[] = [
  { id: 't1', name: 'ES', fullName: 'Eduardo Silva', type: TechType.INTERNAL, color: 'bg-red-100' },
  { id: 't2', name: 'LF', fullName: 'Luiz Ferreira', type: TechType.INTERNAL, color: 'bg-red-100' },
  { id: 't3', name: 'MC', fullName: 'Maria Costa', type: TechType.INTERNAL, color: 'bg-red-100' },
  { id: 't4', name: 'CG', fullName: 'Carlos Gomes', type: TechType.PJ, color: 'bg-amber-100' }, // PJ
  { id: 't5', name: 'PJ', fullName: 'Paulo Junior', type: TechType.PJ, color: 'bg-amber-100' }, // PJ
];

export const INITIAL_CLIENTS: Client[] = [
  { id: 'c1', name: 'Petrobras', city: 'Macaé', state: 'RJ', contactName: 'Eng. Roberto' },
  { id: 'c2', name: 'Vale', city: 'Itabira', state: 'MG', contactName: 'Gestão de Ativos' },
  { id: 'c3', name: 'Suzano', city: 'Limeira', state: 'SP' },
  { id: 'c4', name: 'Klabin', city: 'Telêmaco Borba', state: 'PR' },
  { id: 'c5', name: 'Gerdau', city: 'Ouro Branco', state: 'MG' },
  { id: 'c6', name: 'Braskem', city: 'Camaçari', state: 'BA' },
  { id: 'c7', name: 'Raízen', city: 'Piracicaba', state: 'SP' },
  { id: 'c8', name: 'ArcelorMittal', city: 'Tubarão', state: 'ES' },
  { id: 'c9', name: 'Sylvamo', city: 'Luiz Antônio', state: 'SP' },
  { id: 'c10', name: 'Interno', city: '-', state: '-' }, 
  { id: 'c11', name: 'Feriado', city: '-', state: '-' },
  { id: 'c12', name: 'Férias', city: '-', state: '-' }
];

export const INITIAL_SERVICES: Service[] = [
  {
    id: 's1',
    week: 2,
    client: 'Petrobras',
    manager: 'Ana K.',
    os: '500109709',
    description: 'PMA',
    hp: 5.0,
    ht: 48.0,
    hv: 6.0,
    startDate: '2025-01-06',
    endDate: '2025-01-10',
    technicianIds: ['t3'], // MC
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-07-22',
    period: 6
  },
  {
    id: 's2',
    week: 3,
    client: 'Suzano',
    manager: 'Ana K.',
    os: '500136926',
    description: 'PMA',
    hp: 2.0,
    ht: 49.0,
    hv: 5.0,
    startDate: '2025-01-13',
    endDate: '2025-01-21',
    technicianIds: ['t4'], // CG
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-07-15',
    period: 6
  },
  {
    id: 's3',
    week: 4,
    client: 'Klabin',
    manager: 'JM',
    os: '500141864',
    description: 'PMA',
    hp: 3.0,
    ht: 24.5,
    hv: 15.0,
    startDate: '2025-01-20',
    endDate: '2025-01-24',
    technicianIds: ['t2'], // LF
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-06-19',
    period: 6
  },
  {
    id: 's4',
    week: 4,
    client: 'Gerdau',
    manager: 'JM',
    os: '500140912',
    description: 'PMA',
    hp: 3.0,
    ht: 25.0,
    hv: 23.0,
    startDate: '2025-01-20',
    endDate: '2025-01-24',
    technicianIds: ['t3'], // MC
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-06-28',
    period: 6
  },
  {
    id: 's5',
    week: 5,
    client: 'Veracel',
    manager: 'CT',
    os: '500142108',
    description: 'PMA',
    hp: 4.0,
    ht: 35.0,
    hv: 16.0,
    startDate: '2025-01-27',
    endDate: '2025-01-31',
    technicianIds: ['t1'], // ES
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-07-15',
    period: 6
  },
  {
    id: 's6',
    week: 5,
    client: 'Klabin',
    manager: 'JM',
    os: '500136363',
    description: 'PMA',
    hp: 8.0,
    ht: 40.0,
    hv: 12.0,
    startDate: '2025-01-27',
    endDate: '2025-01-31',
    technicianIds: ['t2'], // JC (mapped to t2 LF for demo)
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-08-09',
    period: 6
  },
  {
    id: 's7',
    week: 5,
    client: 'Bo Paper',
    manager: 'CT',
    os: '500142169',
    description: 'GARANTIA',
    hp: 0,
    ht: 8.0,
    hv: 8.0,
    startDate: '2025-01-29',
    endDate: '2025-01-31',
    technicianIds: ['t3'], // MC
    status: ServiceStatus.CONFIRMED,
    lastCalibration: '2024-10-14',
    period: 0 // ***
  }
];