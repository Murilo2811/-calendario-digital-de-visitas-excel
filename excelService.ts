/**
 * Excel Service - File System Access API
 * Permite ler e escrever diretamente em arquivos Excel usando a API do navegador.
 * Compatível apenas com Chrome e Edge.
 */

import { ServiceStatus, TechType } from './types';
import type { Service, Technician, Client, User, UserRole } from './types';
import * as XLSX from 'xlsx';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { getISOWeek } from 'date-fns/getISOWeek';

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
    if (isNaN(value.getTime())) return '';
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
    const clean = value.trim();
    if (!clean) return '';

    // Formato YYYY-MM-DD (com ou sem horário posterior)
    const matchIso = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (matchIso) {
      return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
    }

    // Formato DD/MM/YYYY ou DD-MM-YYYY (com ou sem horário posterior)
    const matchBr = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (matchBr) {
      const day = matchBr[1].padStart(2, '0');
      const month = matchBr[2].padStart(2, '0');
      const year = matchBr[3];
      return `${year}-${month}-${day}`;
    }
  }

  return '';
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
 * Extrai todos os dados estruturados a partir de um WorkBook XLSX
 */
export const parseWorkbookData = (workbook: XLSX.WorkBook): {
  services: Service[];
  technicians: Technician[];
  clients: Client[];
  users: User[];
} => {
  // 1. Técnicos
  const techSheet = workbook.Sheets[SHEET_TECHNICIANS];
  const technicians: Technician[] = techSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(techSheet).map((row, index) => ({
        id: String(row['ID'] || `tech-${index}-${Date.now()}`),
        name: String(row['Sigla'] || ''),
        fullName: String(row['Nome Completo'] || row['Nome'] || ''),
        type: parseTechType(String(row['Tipo'] || 'Internal')),
        color: String(row['Cor'] || 'bg-red-100'),
      }))
    : [];

  // 2. Clientes
  const clientSheet = workbook.Sheets[SHEET_CLIENTS];
  const clients: Client[] = clientSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(clientSheet).map((row, index) => ({
        id: String(row['ID'] || `cli-${index}-${Date.now()}`),
        name: String(row['Nome'] || row['Nome Fantasia'] || ''),
        corporateName: row['Razao Social'] ? String(row['Razao Social']) : undefined,
        cnpj: row['CNPJ'] ? String(row['CNPJ']) : undefined,
        city: row['Cidade'] ? String(row['Cidade']) : undefined,
        state: row['Estado'] ? String(row['Estado']) : undefined,
        contactName: row['Contato'] ? String(row['Contato']) : undefined,
        email: row['Email'] ? String(row['Email']) : undefined,
        phone: row['Telefone'] ? String(row['Telefone']) : undefined,
      }))
    : [];

  // 3. Usuários
  const userSheet = workbook.Sheets[SHEET_USERS];
  const users: User[] = userSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(userSheet).map((row, index) => ({
        id: String(row['ID'] || `user-${index}-${Date.now()}`),
        username: String(row['Usuario'] || ''),
        passwordHash: String(row['SenhaHash'] || ''),
        role: (String(row['Papel'] || 'user').toLowerCase() as UserRole),
        fullName: String(row['NomeCompleto'] || row['Usuario'] || ''),
        createdAt: String(row['CriadoEm'] || new Date().toISOString().split('T')[0]),
      }))
    : [];

  // 4. Serviços
  const serviceSheet = workbook.Sheets[SHEET_SERVICES];
  const services: Service[] = serviceSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(serviceSheet).map((row, index) => {
        const techString = String(row['Tecnicos'] || row['EXEC.'] || '');
        const techNames = techString.split(',').map(s => s.trim()).filter(Boolean);
        const technicianIds = techNames
          .map(name => technicians.find(t => t.name === name || t.fullName === name)?.id)
          .filter((id): id is string => !!id);

        const rawStartStr = parseExcelDate(row['Inicio'] || row['Data Inicio']);
        const rawEndStr = parseExcelDate(row['Fim'] || row['Data Fim']);
        const startDateStr = rawStartStr || rawEndStr;
        const endDateStr = rawEndStr || rawStartStr;
        let weekNumber = Number(row['Semana'] || row['SEM.'] || 0);
        const parsedStart = parseISO(startDateStr);
        if (isValid(parsedStart)) {
          weekNumber = getISOWeek(parsedStart);
        }

        return {
          id: String(row['ID'] || `svc-imported-${index}-${Date.now()}`),
          week: weekNumber,
          client: String(row['Cliente'] || row['CLIENT'] || ''),
          manager: String(row['Gerente'] || row['Manager'] || ''),
          os: String(row['OS'] || ''),
          description: String(row['Descricao'] || row['DESCRIPT'] || ''),
          hp: Number(row['HP'] || 0),
          ht: Number(row['HT'] || 0),
          hv: Number(row['HV'] || 0),
          startDate: startDateStr,
          endDate: endDateStr,
          technicianIds: technicianIds.length > 0 ? technicianIds : [],
          status: parseStatus(String(row['Status'] || 'Cliente Previsto')),
          lastCalibration: parseExcelDate(row['Ultima Calibracao'] || row['LAST.CAL']),
          period: Number(row['Periodo'] || row['PERIOD'] || 0),
          comments: String(row['Comentários'] || row['Comentarios'] || row['Observacoes'] || row['Observações'] || row['Comments'] || ''),
          realized: (() => {
            const raw = String(row['Realizado'] || row['REALIZADO'] || row['Status Realizado'] || '').trim().toLowerCase();
            return (raw === 'sim' || raw === 's' || raw === 'true' || raw === '1' || raw === 'yes') ? 'sim' : 'nao';
          })(),
        };
      })
    : [];

  return { services, technicians, clients, users };
};

/**
 * Lê todos os dados do arquivo Excel via FileHandle
 */
export const readAllFromExcel = async (handle: FileHandle): Promise<{
  services: Service[];
  technicians: Technician[];
  clients: Client[];
  users: User[];
}> => {
  const workbook = await readWorkbook(handle);
  return parseWorkbookData(workbook);
};

// --- MÉTODOS PARA SERVIDOR DE REDE LOCAL (POWER SHELL / HTTP LISTENER) ---

export interface NetworkServerStatus {
  running: boolean;
  port?: number;
  excelFileName?: string;
  excelExists?: boolean;
  excelPath?: string;
}

/**
 * Verifica se o micro-servidor local de rede está rodando
 */
export const checkNetworkServerStatus = async (): Promise<NetworkServerStatus | null> => {
  try {
    const res = await fetch('/api/excel/status', { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Servidor local não disponível (ex: rodando via Vite dev ou servidor web estático)
  }
  return null;
};

/**
 * Carrega a planilha central diretamente do servidor de rede
 */
export const loadFromNetworkServer = async (): Promise<{
  services: Service[];
  technicians: Technician[];
  clients: Client[];
  users: User[];
  fileName: string;
} | null> => {
  try {
    const res = await fetch('/api/excel/load', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const data = parseWorkbookData(workbook);
    return { ...data, fileName: 'Calendario_Digital_Base.xlsx' };
  } catch (e) {
    console.error('Erro ao carregar dados do servidor de rede:', e);
    return null;
  }
};

/**
 * Monta o workbook completo (4 abas) a partir do estado da aplicação.
 * Formato lido de volta por parseWorkbookData — mantenha os dois em sincronia.
 */
export const buildWorkbook = (
  services: Service[],
  technicians: Technician[],
  clients: Client[],
  users: User[]
): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();

  const appendSheet = (
    rows: Record<string, unknown>[],
    name: string,
    widths: number[]
  ) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = widths.map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };

  appendSheet(services.map(s => ({
    'ID': s.id,
    'Semana': s.week,
    'Cliente': s.client,
    'Gerente': s.manager,
    'OS': s.os,
    'Descricao': s.description,
    'HP': s.hp,
    'HT': s.ht,
    'HV': s.hv,
    'Data Inicio': s.startDate,
    'Data Fim': s.endDate,
    'Tecnicos': s.technicianIds
      .map(id => technicians.find(t => t.id === id)?.name || '')
      .filter(Boolean)
      .join(', '),
    'Realizado': s.realized === 'sim' ? 'Sim' : 'Não',
    'Status': s.status,
    'Ultima Calibracao': s.lastCalibration || '',
    'Periodo': s.period || 0,
    'Comentários': s.comments || '',
  })), SHEET_SERVICES, [20, 8, 25, 12, 15, 25, 6, 6, 6, 12, 12, 20, 12, 22, 15, 8, 35]);

  appendSheet(technicians.map(t => ({
    'ID': t.id,
    'Sigla': t.name,
    'Nome Completo': t.fullName,
    'Tipo': t.type,
    'Cor': t.color,
  })), SHEET_TECHNICIANS, [15, 10, 25, 12, 15]);

  appendSheet(clients.map(c => ({
    'ID': c.id,
    'Nome': c.name,
    'Razao Social': c.corporateName || '',
    'CNPJ': c.cnpj || '',
    'Cidade': c.city || '',
    'Estado': c.state || '',
    'Contato': c.contactName || '',
    'Email': c.email || '',
    'Telefone': c.phone || '',
  })), SHEET_CLIENTS, [15, 25, 30, 18, 20, 5, 20, 25, 15]);

  appendSheet(users.map(u => ({
    'ID': u.id,
    'Usuario': u.username,
    'SenhaHash': u.passwordHash,
    'Papel': u.role,
    'NomeCompleto': u.fullName,
    'CriadoEm': u.createdAt,
  })), SHEET_USERS, [20, 25, 70, 10, 30, 12]);

  return workbook;
};

/** Serializa o workbook para o blob .xlsx que vai para disco ou para a rede. */
const workbookToBlob = (workbook: XLSX.WorkBook): Blob =>
  new Blob([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

/**
 * Salva os dados diretamente na planilha central da rede via micro-servidor local
 */
export const saveToNetworkServer = async (
  services: Service[],
  technicians: Technician[],
  clients: Client[],
  users: User[]
): Promise<boolean> => {
  try {
    const blob = workbookToBlob(buildWorkbook(services, technicians, clients, users));

    const res = await fetch('/api/excel/save', {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    });

    return res.ok;
  } catch (e) {
    console.error('Erro ao salvar no servidor de rede:', e);
    return false;
  }
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
  const blob = workbookToBlob(buildWorkbook(services, technicians, clients, users));

  // Usar File System Access API para escrever
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
};
