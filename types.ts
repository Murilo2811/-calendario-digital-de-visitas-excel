export enum TechType {
  INTERNAL = 'Internal',
  PJ = 'PJ', // Third party
}

export enum ServiceStatus {
  TRAINING_FIELD = 'Treinamento em Campo',
  PREDICTED = 'Cliente Previsto',
  WITH_ORDER = 'Cliente C/ Pedido',
  CONFIRMED = 'Cliente Confirmado',
  TRAINING = 'Treinamento',
  VACATION = 'Férias / Bloqueio',
  NEGOTIATION = 'Clientes em Negociação',
  HOLIDAY = 'Feriados'
}

export interface Technician {
  id: string;
  name: string; // e.g., "ES"
  fullName: string;
  type: TechType;
  color: string; // CSS color class or hex
}

export interface Client {
  id: string;
  name: string; // Nome Fantasia / Display Name
  corporateName?: string; // Razão Social
  cnpj?: string;
  city?: string;
  state?: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

export interface Service {
  id: string;
  week: number;
  client: string;
  manager: string;
  os: string; // Order Service
  description: string;

  // Hours Metrics
  hp: number; // Horas Planejadas
  ht: number; // Horas Totais
  hv: number; // Horas Viagem

  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string;   // ISO Date YYYY-MM-DD

  technicianIds: string[]; // Changed from single ID to array
  status: ServiceStatus;

  // Calibration Logic
  lastCalibration?: string; // ISO Date YYYY-MM-DD
  period?: number; // Months
}

export type ViewMode = 'grid' | 'timeline';

// Tipos de papel do usuário
export type UserRole = 'admin' | 'user';

// Usuário do sistema
export interface User {
  id: string;
  username: string;
  passwordHash: string; // SHA-256 hash
  role: UserRole;
  fullName: string;
  createdAt: string; // ISO Date
}

// Configurações da aplicação
export interface AppSettings {
  lastExcelFileName: string;
  autoReconnectPrompt: boolean;
}