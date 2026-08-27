import { TechType, ServiceStatus } from './types';
import type { Technician, Client } from './types';

/**
 * Cor de cada status — fonte única para a legenda, o grid e a timeline.
 * Classes Tailwind completas (o scanner do Tailwind não entende nomes montados em runtime).
 */
export const STATUS_STYLE: Record<ServiceStatus, { bg: string; text: string }> = {
  [ServiceStatus.TRAINING_FIELD]: { bg: 'bg-slate-400', text: 'text-white' },
  [ServiceStatus.PREDICTED]: { bg: 'bg-yellow-400', text: 'text-yellow-900' },
  [ServiceStatus.WITH_ORDER]: { bg: 'bg-orange-400', text: 'text-white' },
  [ServiceStatus.CONFIRMED]: { bg: 'bg-green-600', text: 'text-white' },
  [ServiceStatus.TRAINING]: { bg: 'bg-purple-500', text: 'text-white' },
  [ServiceStatus.VACATION]: { bg: 'bg-blue-500', text: 'text-white' },
  [ServiceStatus.NEGOTIATION]: { bg: 'bg-cyan-400', text: 'text-cyan-900' },
  [ServiceStatus.HOLIDAY]: { bg: 'bg-slate-800', text: 'text-white' },
};

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
