/**
 * Excel Service - File System Access API
 * Permite ler e escrever diretamente em arquivos Excel usando a API do navegador.
 * Compatível apenas com Chrome e Edge.
 */

import { Service, Technician, Client, User, ServiceStatus, TechType, UserRole } from './types';
import * as XLSX from 'xlsx';

// Tipo para o handle do arquivo (navegador)
type FileHandle = FileSystemFileHandle;

// Interface para verificar suporte do navegador
declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

interface OpenFilePickerOptions {
  types?: { description: string; accept: Record<string, string[]> }[];
  multiple?: boolean;
  startIn?: any; // FileSystemHandle or WellKnownDirectory
}

interface SaveFilePickerOptions {
  types?: { description: string; accept: Record<string, string[]> }[];
  suggestedName?: string;
  startIn?: any;
}

// Constantes para nomes das abas
const SHEET_SERVICES = 'Atividades';
const SHEET_TECHNICIANS = 'Tecnicos';
const SHEET_CLIENTS = 'Clientes';
const SHEET_USERS = 'Usuarios';

// --- IndexedDB Helpers ---
const DB_NAME = 'ServiceSyncDB';
const STORE_NAME = 'config';
const HANDLE_KEY = 'lastExcelHandle';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveLastHandle = async (handle: FileHandle): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Falha ao salvar handle no IndexedDB:', e);
  }
};

const getLastHandle = async (): Promise<FileHandle | undefined> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result as FileHandle);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Falha ao ler handle do IndexedDB:', e);
    return undefined;
  }
};

/**
 * Verifica se o navegador suporta File System Access API
 */
export const isFileSystemAccessSupported = (): boolean => {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
};

/**
 * Abre um diálogo para selecionar arquivo Excel
 */
export const openExcelFile = async (): Promise<FileHandle | null> => {
  if (!isFileSystemAccessSupported()) {
    alert('Seu navegador não suporta acesso a arquivos. Use Chrome ou Edge.');
    return null;
  }

  try {
    // Tenta obter o último local usado
    const lastHandle = await getLastHandle();

    const [handle] = await window.showOpenFilePicker!({
      types: [
        {
          description: 'Arquivos Excel',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
          },
        },
      ],
      multiple: false,
      startIn: lastHandle // Sugere iniciar no mesmo local do último arquivo
    });

    // Salva o novo handle para a próxima vez
    if (handle) {
      await saveLastHandle(handle);
    }

    return handle;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Usuário cancelou
      return null;
    }
    console.error('Erro ao abrir arquivo:', error);
    throw error;
  }
};

/**
 * Cria um novo arquivo Excel com a estrutura correta
 */
export const createNewExcelFile = async (): Promise<FileHandle | null> => {
  if (!isFileSystemAccessSupported()) {
    alert('Seu navegador não suporta acesso a arquivos. Use Chrome ou Edge.');
    return null;
  }

  try {
    const handle = await window.showSaveFilePicker!({
      types: [
        {
          description: 'Arquivos Excel',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          },
        },
      ],
      suggestedName: 'Calendario_Digital.xlsx',
    });
    return handle;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    console.error('Erro ao criar arquivo:', error);
    throw error;
  }
};

/**
 * Lê o workbook do arquivo Excel
 */
const readWorkbook = async (handle: FileHandle): Promise<XLSX.WorkBook> => {
  const file = await handle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
};

/**
 * Converte valor de data do Excel para string ISO
 */
const parseExcelDate = (value: unknown): string => {
  if (!value) return '';

  // Se já é uma Date
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Se é número (serial date do Excel)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // Se é string, tentar parsear
  if (typeof value === 'string') {
    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    // Formato DD/MM/YYYY
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
  }

  return String(value);
};

/**
 * Mapeia string de status para enum
 */
const parseStatus = (value: string): ServiceStatus => {
  const statusMap: Record<string, ServiceStatus> = {
    'Treinamento em Campo': ServiceStatus.TRAINING_FIELD,
    'Cliente Previsto': ServiceStatus.PREDICTED,
    'Cliente C/ Pedido': ServiceStatus.WITH_ORDER,
    'Cliente Confirmado': ServiceStatus.CONFIRMED,
    'Treinamento': ServiceStatus.TRAINING,
    'Férias / Bloqueio': ServiceStatus.VACATION,
    'Clientes em Negociação': ServiceStatus.NEGOTIATION,
    'Feriados': ServiceStatus.HOLIDAY,
  };
  return statusMap[value] || ServiceStatus.PREDICTED;
};

/**
 * Mapeia string de tipo para enum
 */
const parseTechType = (value: string): TechType => {
  if (value === 'PJ' || value === 'Third party') return TechType.PJ;
  return TechType.INTERNAL;
};

/**
 * Lê serviços (atividades) do Excel
 */
export const readServicesFromExcel = async (handle: FileHandle, technicians: Technician[]): Promise<Service[]> => {
  const workbook = await readWorkbook(handle);
  const sheet = workbook.Sheets[SHEET_SERVICES];

  if (!sheet) {
    console.log('Aba "Atividades" não encontrada, retornando lista vazia');
    return [];
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return data.map((row, index) => {
    // Converter nomes de técnicos para IDs
    const techString = String(row['Tecnicos'] || row['EXEC.'] || '');
    const techNames = techString.split(',').map(s => s.trim()).filter(Boolean);
    const technicianIds = techNames
      .map(name => technicians.find(t => t.name === name || t.fullName === name)?.id)
      .filter((id): id is string => !!id);

    return {
      id: String(row['ID'] || `svc-imported-${index}-${Date.now()}`),
      week: Number(row['Semana'] || row['SEM.'] || 0),
      client: String(row['Cliente'] || row['CLIENT'] || ''),
      manager: String(row['Gerente'] || row['Manager'] || ''),
      os: String(row['OS'] || ''),
      description: String(row['Descricao'] || row['DESCRIPT'] || ''),
      hp: Number(row['HP'] || 0),
      ht: Number(row['HT'] || 0),
      hv: Number(row['HV'] || 0),
      startDate: parseExcelDate(row['Inicio'] || row['Data Inicio']),
      endDate: parseExcelDate(row['Fim'] || row['Data Fim']),
      technicianIds: technicianIds.length > 0 ? technicianIds : [],
      status: parseStatus(String(row['Status'] || 'Cliente Previsto')),
      lastCalibration: parseExcelDate(row['Ultima Calibracao'] || row['LAST.CAL']),
      period: Number(row['Periodo'] || row['PERIOD'] || 0),
    };
  });
};

/**
 * Lê técnicos do Excel
 */
export const readTechniciansFromExcel = async (handle: FileHandle): Promise<Technician[]> => {
  const workbook = await readWorkbook(handle);
  const sheet = workbook.Sheets[SHEET_TECHNICIANS];

  if (!sheet) {
    console.log('Aba "Tecnicos" não encontrada, retornando lista vazia');
    return [];
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return data.map((row, index) => ({
    id: String(row['ID'] || `tech-${index}-${Date.now()}`),
    name: String(row['Sigla'] || ''),
    fullName: String(row['Nome Completo'] || row['Nome'] || ''),
    type: parseTechType(String(row['Tipo'] || 'Internal')),
    color: String(row['Cor'] || 'bg-red-100'),
  }));
};

/**
 * Lê clientes do Excel
 */
export const readClientsFromExcel = async (handle: FileHandle): Promise<Client[]> => {
  const workbook = await readWorkbook(handle);
  const sheet = workbook.Sheets[SHEET_CLIENTS];

  if (!sheet) {
    console.log('Aba "Clientes" não encontrada, retornando lista vazia');
    return [];
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return data.map((row, index) => ({
    id: String(row['ID'] || `cli-${index}-${Date.now()}`),
    name: String(row['Nome'] || row['Nome Fantasia'] || ''),
    corporateName: row['Razao Social'] ? String(row['Razao Social']) : undefined,
    cnpj: row['CNPJ'] ? String(row['CNPJ']) : undefined,
    city: row['Cidade'] ? String(row['Cidade']) : undefined,
    state: row['Estado'] ? String(row['Estado']) : undefined,
    contactName: row['Contato'] ? String(row['Contato']) : undefined,
    email: row['Email'] ? String(row['Email']) : undefined,
    phone: row['Telefone'] ? String(row['Telefone']) : undefined,
  }));
};

/**
 * Lê usuários do Excel
 */
export const readUsersFromExcel = async (handle: FileHandle): Promise<User[]> => {
  const workbook = await readWorkbook(handle);
  const sheet = workbook.Sheets[SHEET_USERS];

  if (!sheet) {
    console.log('Aba "Usuarios" não encontrada, retornando lista vazia');
    return [];
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return data.map((row, index) => ({
    id: String(row['ID'] || `user-${index}-${Date.now()}`),
    username: String(row['Usuario'] || ''),
    passwordHash: String(row['SenhaHash'] || ''),
    role: (String(row['Papel'] || 'user') as UserRole),
    fullName: String(row['NomeCompleto'] || ''),
    createdAt: parseExcelDate(row['CriadoEm']),
  }));
};

/**
 * Lê todos os dados do Excel
 */
export const readAllFromExcel = async (handle: FileHandle): Promise<{
  services: Service[];
  technicians: Technician[];
  clients: Client[];
  users: User[];
}> => {
  // Ler técnicos primeiro para usar no mapeamento de serviços
  const technicians = await readTechniciansFromExcel(handle);
  const clients = await readClientsFromExcel(handle);
  const services = await readServicesFromExcel(handle, technicians);
  const users = await readUsersFromExcel(handle);

  return { services, technicians, clients, users };
};

/**
 * Salva todos os dados no Excel
 */
export const saveAllToExcel = async (
  handle: FileHandle,
  services: Service[],
  technicians: Technician[],
  clients: Client[],
  users: User[] = []
): Promise<void> => {
  // Criar workbook novo
  const workbook = XLSX.utils.book_new();

  // --- Aba de Atividades ---
  const servicesData = services.map(s => {
    const techNames = s.technicianIds
      .map(id => technicians.find(t => t.id === id)?.name || '')
      .filter(Boolean)
      .join(', ');

    return {
      'ID': s.id,
      'Semana': s.week,
      'Cliente': s.client,
      'Gerente': s.manager,
      'OS': s.os,
      'Descricao': s.description,
      'HP': s.hp,
      'HT': s.ht,
      'HV': s.hv,
      'Inicio': s.startDate,
      'Fim': s.endDate,
      'Tecnicos': techNames,
      'Status': s.status,
      'Ultima Calibracao': s.lastCalibration || '',
      'Periodo': s.period || 0,
    };
  });

  const servicesSheet = XLSX.utils.json_to_sheet(servicesData);
  servicesSheet['!cols'] = [
    { wch: 20 }, // ID
    { wch: 8 },  // Semana
    { wch: 25 }, // Cliente
    { wch: 12 }, // Gerente
    { wch: 15 }, // OS
    { wch: 25 }, // Descricao
    { wch: 6 },  // HP
    { wch: 6 },  // HT
    { wch: 6 },  // HV
    { wch: 12 }, // Inicio
    { wch: 12 }, // Fim
    { wch: 20 }, // Tecnicos
    { wch: 22 }, // Status
    { wch: 15 }, // Ultima Calibracao
    { wch: 8 },  // Periodo
  ];
  XLSX.utils.book_append_sheet(workbook, servicesSheet, SHEET_SERVICES);

  // --- Aba de Técnicos ---
  const techniciansData = technicians.map(t => ({
    'ID': t.id,
    'Sigla': t.name,
    'Nome Completo': t.fullName,
    'Tipo': t.type,
    'Cor': t.color,
  }));

  const techniciansSheet = XLSX.utils.json_to_sheet(techniciansData);
  techniciansSheet['!cols'] = [
    { wch: 15 }, // ID
    { wch: 10 }, // Sigla
    { wch: 25 }, // Nome Completo
    { wch: 12 }, // Tipo
    { wch: 15 }, // Cor
  ];
  XLSX.utils.book_append_sheet(workbook, techniciansSheet, SHEET_TECHNICIANS);

  // --- Aba de Clientes ---
  const clientsData = clients.map(c => ({
    'ID': c.id,
    'Nome': c.name,
    'Razao Social': c.corporateName || '',
    'CNPJ': c.cnpj || '',
    'Cidade': c.city || '',
    'Estado': c.state || '',
    'Contato': c.contactName || '',
    'Email': c.email || '',
    'Telefone': c.phone || '',
  }));

  const clientsSheet = XLSX.utils.json_to_sheet(clientsData);
  clientsSheet['!cols'] = [
    { wch: 15 }, // ID
    { wch: 25 }, // Nome
    { wch: 30 }, // Razao Social
    { wch: 18 }, // CNPJ
    { wch: 20 }, // Cidade
    { wch: 5 },  // Estado
    { wch: 20 }, // Contato
    { wch: 25 }, // Email
    { wch: 15 }, // Telefone
  ];
  XLSX.utils.book_append_sheet(workbook, clientsSheet, SHEET_CLIENTS);

  // --- Aba de Usuários ---
  const usersData = users.map(u => ({
    'ID': u.id,
    'Usuario': u.username,
    'SenhaHash': u.passwordHash,
    'Papel': u.role,
    'NomeCompleto': u.fullName,
    'CriadoEm': u.createdAt,
  }));

  const usersSheet = XLSX.utils.json_to_sheet(usersData);
  usersSheet['!cols'] = [
    { wch: 20 }, // ID
    { wch: 25 }, // Usuario
    { wch: 70 }, // SenhaHash
    { wch: 10 }, // Papel
    { wch: 30 }, // NomeCompleto
    { wch: 12 }, // CriadoEm
  ];
  XLSX.utils.book_append_sheet(workbook, usersSheet, SHEET_USERS);

  // Escrever no arquivo
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  // Usar File System Access API para escrever
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
};

/**
 * Verifica se o arquivo Excel existe e tem a estrutura correta
 */
export const validateExcelStructure = async (handle: FileHandle): Promise<{
  isValid: boolean;
  hasServices: boolean;
  hasTechnicians: boolean;
  hasClients: boolean;
}> => {
  try {
    const workbook = await readWorkbook(handle);

    return {
      isValid: true,
      hasServices: !!workbook.Sheets[SHEET_SERVICES],
      hasTechnicians: !!workbook.Sheets[SHEET_TECHNICIANS],
      hasClients: !!workbook.Sheets[SHEET_CLIENTS],
    };
  } catch (error) {
    console.error('Erro ao validar estrutura do Excel:', error);
    return {
      isValid: false,
      hasServices: false,
      hasTechnicians: false,
      hasClients: false,
    };
  }
};
