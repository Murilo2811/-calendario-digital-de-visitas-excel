import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { Service, Technician, ViewMode, ServiceStatus, TechType, Client, User, AppSettings } from './types';
import { TECHNICIANS, INITIAL_CLIENTS, STATUS_STYLE } from './constants';
import { ServiceGrid } from './components/ServiceGrid';
import { ResourceTimeline } from './components/ResourceTimeline';
import { AddServiceModal } from './components/AddServiceModal';
import { QuickAddModal } from './components/QuickAddModal';
import { TechManagerModal } from './components/TechManagerModal';
import { ClientManagerModal } from './components/ClientManagerModal';
import { HelpModal } from './components/HelpModal';
import { LoginPage } from './components/LoginPage';
import { SettingsModal } from './components/SettingsModal';
import { CalibrationAlertsModal } from './components/CalibrationAlertsModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { createDefaultAdmin, canEdit, canManage, canExport } from './authService';
import {
    calculateDuration,
    exportToExcel,
    getTechnicianConflicts,
    getClientConflicts,
    findAvailableTechnicians,
    getCalibrationStatus,
    createRecurringCalibrationForecasts,
    checkPeriodExceeded,
    recalculateFutureForecastsFromNewDate,
    filterServicesByPeriod
} from './utils';
import {
    openExcelFile,
    createNewExcelFile,
    readAllFromExcel,
    saveAllToExcel,
    isFileSystemAccessSupported,
    checkNetworkServerStatus,
    loadFromNetworkServer,
    saveToNetworkServer,
} from './excelService';
// FIX: Switched to deep imports for date-fns to resolve module loading errors.
// FIX: Changed date-fns imports to named exports from submodules to support date-fns v3.
import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { differenceInDays } from 'date-fns/differenceInDays';
import { endOfMonth } from 'date-fns/endOfMonth';
import { endOfYear } from 'date-fns/endOfYear';
import { format } from 'date-fns/format';
import { getISOWeek } from 'date-fns/getISOWeek';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfYear } from 'date-fns/startOfYear';
import { isBefore } from 'date-fns/isBefore';
import { startOfDay } from 'date-fns/startOfDay';
import { ptBR } from 'date-fns/locale/pt-BR';

import {
    LayoutGrid,
    CalendarDays,
    Plus,
    Users,
    Download,
    Filter,
    Search,
    Building2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Layers,
    HelpCircle,
    Zap,
    CheckCircle,
    FileSpreadsheet,
    Unplug,
    Loader2,
    FilePlus2,
    Settings,
    LogOut,
    Minus,
    Bell,
    AlertTriangle,
    Save,
    Check
} from 'lucide-react';

// Helper to sort technicians: Internal first, then Alphabetical by Name
const sortTechnicians = (list: Technician[]) => {
    return [...list].sort((a, b) => {
        if (a.type === TechType.INTERNAL && b.type === TechType.PJ) return -1;
        if (a.type === TechType.PJ && b.type === TechType.INTERNAL) return 1;
        return a.name.localeCompare(b.name);
    });
};

const App: React.FC = () => {
    const [view, setView] = useState<ViewMode>('grid');
    const [services, setServices] = useState<Service[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>(() => sortTechnicians(TECHNICIANS));
    const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isTechModalOpen, setIsTechModalOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isCalibrationAlertsModalOpen, setIsCalibrationAlertsModalOpen] = useState(false);
    const [isUnsavedExitModalOpen, setIsUnsavedExitModalOpen] = useState(false);
    const [pendingExitAction, setPendingExitAction] = useState<'logout' | 'disconnect' | null>(null);
    const [editingService, setEditingService] = useState<Service | null>(null);

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

    const [searchText, setSearchText] = useState('');
    const [filterTechId, setFilterTechId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const legendRef = useRef<HTMLDivElement>(null);
    const [isGrouped, setIsGrouped] = useState(false);
    const [customDaysOffset, setCustomDaysOffset] = useState(0);

    // Contagem de alertas de calibração
    const calibrationAlertsSummary = useMemo(() => {
        let expired = 0;
        let expiringSoon = 0;
        services.forEach(s => {
            const st = getCalibrationStatus(s);
            if (st.level === 'EXPIRED') expired++;
            else if (st.level === 'EXPIRING_SOON') expiringSoon++;
        });
        return { expired, expiringSoon, totalAlerts: expired + expiringSoon };
    }, [services]);

    const [excelHandle, setExcelHandle] = useState<FileSystemFileHandle | null>(null);
    const [isExcelConnected, setIsExcelConnected] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    const [excelFileName, setExcelFileName] = useState<string>('');
    const [isNetworkServer, setIsNetworkServer] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    // Toast State
    const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    const showToast = useCallback((message: string) => {
        setToast({ show: true, message });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3000);
    }, []);

    const legendItems = Object.entries(STATUS_STYLE).map(([label, { bg }]) => ({ color: bg, label }));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
                setIsLegendOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [legendRef]);

    // Clock State
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);

    // "Não salvo" é derivado, não marcado à mão: alguma lista trocou de referência
    // desde o último ponto salvo (o estado é imutável, então referência basta).
    const [saved, setSaved] = useState({ services, technicians, clients, users });
    const hasUnsavedChanges = services !== saved.services || technicians !== saved.technicians
        || clients !== saved.clients || users !== saved.users;
    const markSaved = () => setSaved({ services, technicians, clients, users });
    // Cargas preenchem o estado por setters que só valem no próximo render; o ponto salvo
    // é tirado depois que eles comitam (layout effect: antes da pintura, sem piscar "Salvar").
    const [loadCount, setLoadCount] = useState(0);
    useLayoutEffect(markSaved, [loadCount]);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // App Settings with localStorage
    const [appSettings, setAppSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('appSettings');
        if (saved) {
            try { return JSON.parse(saved); } catch { }
        }
        return { lastExcelFileName: '', autoReconnectPrompt: true };
    });

    // Persist appSettings to localStorage
    useEffect(() => {
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
    }, [appSettings]);

    // 1. Auto-detecção do Micro-servidor de Rede Local
    useEffect(() => {
        const autoConnectNetworkServer = async () => {
            try {
                const status = await checkNetworkServerStatus();
                if (status && status.running) {
                    setIsNetworkServer(true);
                    setIsExcelLoading(true);

                    const data = await loadFromNetworkServer();
                    if (data) {
                        if (data.technicians.length > 0) setTechnicians(sortTechnicians(data.technicians));
                        if (data.clients.length > 0) setClients(data.clients);
                        if (data.services.length > 0) setServices(data.services);

                        if (data.users.length > 0) {
                            setUsers(data.users);
                        } else {
                            const defaultAdmin = await createDefaultAdmin();
                            setUsers([defaultAdmin]);
                            await saveToNetworkServer(data.services, data.technicians, data.clients, [defaultAdmin]);
                        }

                        setExcelFileName(data.fileName || 'Calendario_Digital_Base.xlsx');
                        setIsExcelConnected(true);
                        setLoadCount(n => n + 1);
                        showToast('Conectado à planilha central da rede!');
                    } else {
                        // Se o arquivo ainda não existe na rede, cria a planilha inicial automaticamente
                        const defaultAdmin = await createDefaultAdmin();
                        setUsers([defaultAdmin]);
                        await saveToNetworkServer([], sortTechnicians(TECHNICIANS), INITIAL_CLIENTS, [defaultAdmin]);
                        setExcelFileName('Calendario_Digital_Base.xlsx');
                        setIsExcelConnected(true);
                        setLoadCount(n => n + 1);
                        showToast('Planilha central criada na rede!');
                    }
                    setIsExcelLoading(false);
                    return;
                }
            } catch (err) {
                console.log('Modo navegador avulso (sem micro-servidor local de rede)');
            } finally {
                setIsExcelLoading(false);
            }

            // Fallback para navegador comum (File System Access)
            if (appSettings.autoReconnectPrompt && appSettings.lastExcelFileName && !isExcelConnected && !currentUser) {
                const shouldReconnect = window.confirm(
                    `Deseja reconectar ao arquivo "${appSettings.lastExcelFileName}"?\n\nClique em OK e selecione o arquivo.`
                );
                if (shouldReconnect) {
                    handleConnectExcel();
                }
            }
        };

        autoConnectNetworkServer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleConnectExcel = async () => {
        if (!isFileSystemAccessSupported()) {
            alert('Seu navegador não suporta acesso a arquivos. Use Chrome ou Edge.');
            return;
        }

        setIsExcelLoading(true);
        try {
            const handle = await openExcelFile();
            if (handle) {
                const data = await readAllFromExcel(handle);

                // Carregar dados
                if (data.technicians.length > 0) {
                    setTechnicians(sortTechnicians(data.technicians));
                }
                if (data.clients.length > 0) {
                    setClients(data.clients);
                }
                if (data.services.length > 0) {
                    setServices(data.services);
                }

                // Carregar usuários ou criar admin padrão
                if (data.users.length > 0) {
                    setUsers(data.users);
                } else {
                    const defaultAdmin = await createDefaultAdmin();
                    setUsers([defaultAdmin]);
                }

                setExcelHandle(handle);
                setExcelFileName(handle.name);
                setIsExcelConnected(true);
                setLoadCount(n => n + 1);

                // Salvar nome do arquivo nas configurações
                setAppSettings(prev => ({ ...prev, lastExcelFileName: handle.name }));

                showToast(`Conectado ao arquivo: ${handle.name}`);
            }
        } catch (error) {
            console.error('Erro ao conectar Excel:', error);
            showToast('Erro ao conectar ao arquivo Excel');
        } finally {
            setIsExcelLoading(false);
        }
    };

    const handleCreateNewExcel = async () => {
        if (!isFileSystemAccessSupported()) {
            alert('Seu navegador não suporta acesso a arquivos. Use Chrome ou Edge.');
            return;
        }

        setIsExcelLoading(true);
        try {
            const handle = await createNewExcelFile();
            if (handle) {
                // Criar admin padrão para novo arquivo
                const defaultAdmin = await createDefaultAdmin();
                setUsers([defaultAdmin]);

                // Salvar dados atuais no novo arquivo
                await saveAllToExcel(handle, services, technicians, clients, [defaultAdmin]);

                setExcelHandle(handle);
                setExcelFileName(handle.name);
                setIsExcelConnected(true);
                setLoadCount(n => n + 1);
                showToast(`Novo arquivo criado: ${handle.name}`);
            }
        } catch (error) {
            console.error('Erro ao criar Excel:', error);
            showToast('Erro ao criar arquivo Excel');
        } finally {
            setIsExcelLoading(false);
        }
    };

    const executeDisconnectExcel = () => {
        setExcelHandle(null);
        setExcelFileName('');
        setIsExcelConnected(false);
        markSaved();
        showToast('Desconectado do arquivo Excel');
        setCurrentUser(null); // Logout ao desconectar
    };

    const handleDisconnectExcel = () => {
        if (hasUnsavedChanges) {
            setPendingExitAction('disconnect');
            setIsUnsavedExitModalOpen(true);
        } else {
            executeDisconnectExcel();
        }
    };


    // --- Salvamento Manual Controlado ---
    const handleManualSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (isNetworkServer) {
                const ok = await saveToNetworkServer(services, technicians, clients, users);
                if (ok) {
                    markSaved();
                    showToast('Todas as alterações foram salvas na rede!');
                } else {
                    showToast('Erro ao salvar no servidor de rede.');
                }
            } else if (excelHandle) {
                await saveAllToExcel(excelHandle, services, technicians, clients, users);
                markSaved();
                showToast('Todas as alterações foram salvas no arquivo Excel!');
            }
        } catch (error) {
            console.error('Erro ao salvar alterações:', error);
            showToast('Erro ao salvar as alterações no Excel.');
        } finally {
            setIsSaving(false);
        }
    };

    // Atalho de Teclado global: Ctrl+S ou Cmd+S para salvar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleManualSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleManualSave]);

    // Alerta caso tente fechar ou recarregar a janela com alterações não salvas
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // --- Date Logic ---
    const availableYears = useMemo(() => {
        const yearsSet = new Set<number>([2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, selectedYear]);
        services.forEach(s => {
            const raw = (s.startDate || s.endDate || '').trim();
            if (raw) {
                const y = parseInt(raw.substring(0, 4), 10);
                if (!isNaN(y) && y >= 2000 && y <= 2100) {
                    yearsSet.add(y);
                }
            }
        });
        return Array.from(yearsSet).sort((a, b) => a - b);
    }, [services, selectedYear]);

    // Ajusta o ano inicial apenas UMA vez ao abrir o app caso o ano corrente não possua atividades
    const initialYearAdjustedRef = useRef(false);
    useEffect(() => {
        if (!initialYearAdjustedRef.current && services.length > 0) {
            initialYearAdjustedRef.current = true;
            const currentYear = new Date().getFullYear();
            const hasCurrentYear = services.some(s => (s.startDate || s.endDate || '').startsWith(String(currentYear)));
            if (!hasCurrentYear) {
                const serviceYears = services
                    .map(s => parseInt((s.startDate || s.endDate || '').substring(0, 4), 10))
                    .filter(y => !isNaN(y) && y >= 2000 && y <= 2100);
                if (serviceYears.length > 0) {
                    setSelectedYear(Math.max(...serviceYears));
                }
            }
        }
    }, [services]);


    const { rangeStart, rangeEnd } = useMemo(() => {
        let start: Date;
        let end: Date;
        if (selectedMonth === -1) {
            start = startOfYear(new Date(selectedYear, 0, 1));
            end = endOfYear(new Date(selectedYear, 0, 1));
        } else {
            start = startOfMonth(new Date(selectedYear, selectedMonth, 1));
            end = endOfMonth(new Date(selectedYear, selectedMonth, 1));
        }
        // Aplica offset de dias customizado apenas se não for visão de ano inteiro
        if (selectedMonth !== -1 && customDaysOffset !== 0) {
            end = addDays(end, customDaysOffset);
        }
        return { rangeStart: start, rangeEnd: end };
    }, [selectedYear, selectedMonth, customDaysOffset]);

    const servicesForSelectedPeriod = useMemo(() => {
        return filterServicesByPeriod(services, selectedYear, selectedMonth);
    }, [services, selectedYear, selectedMonth]);


    const filteredServices = useMemo(() => {
        let servicesToFilter = servicesForSelectedPeriod;

        if (searchText) {
            const searchLower = searchText.toLowerCase();
            servicesToFilter = servicesToFilter.filter(s =>
                s.client.toLowerCase().includes(searchLower) ||
                s.os.toLowerCase().includes(searchLower) ||
                s.manager.toLowerCase().includes(searchLower) ||
                s.description.toLowerCase().includes(searchLower)
            );
        }

        if (filterTechId !== 'all') {
            servicesToFilter = servicesToFilter.filter(s => s.technicianIds && s.technicianIds.includes(filterTechId));
        }
        if (filterStatus !== 'all') {
            servicesToFilter = servicesToFilter.filter(s => s.status === filterStatus);
        }

        const sorted = servicesToFilter.sort((a, b) => {
            // Sort invalid dates to the top
            if (!a.startDate) return -1;
            if (!b.startDate) return 1;
            return a.startDate.localeCompare(b.startDate);
        });

        if (isGrouped && view === 'grid') {
            return sorted.sort((a, b) => a.status.localeCompare(b.status));
        }

        return sorted;
    }, [servicesForSelectedPeriod, searchText, filterTechId, filterStatus, isGrouped, view]);

    const visibleTechnicians = useMemo(() => {
        if (filterTechId === 'all') return technicians;
        return technicians.filter(t => t.id === filterTechId);
    }, [technicians, filterTechId]);

    // --- CRUD Operations ---
    const handleSaveService = (serviceData: Omit<Service, 'id'>) => {
        const newServiceData = { ...serviceData };

        // Sempre auto-recalcula a semana a partir da startDate se válida
        const parsedStart = parseISO(newServiceData.startDate);
        if (isValid(parsedStart)) {
            newServiceData.week = getISOWeek(parsedStart);
        }

        // Auto-update Last Calibration if Confirmed and in Past
        if (newServiceData.status === ServiceStatus.CONFIRMED) {
            const end = parseISO(newServiceData.endDate);
            const today = startOfDay(new Date());
            if (isValid(end) && isBefore(end, today)) {
                newServiceData.lastCalibration = newServiceData.endDate;
            }
        }

        let recurringForecasts: Service[] = [];

        // Se possuir periodicidade de calibração definida (> 0), gera os agendamentos recorrentes automáticos (até 36 meses)
        if (newServiceData.period && newServiceData.period > 0) {
            const tempBaseService: Service = {
                ...newServiceData,
                id: editingService ? editingService.id : 'temp-id'
            };
            recurringForecasts = createRecurringCalibrationForecasts(
                tempBaseService,
                technicians,
                services,
                36 // Limite de 36 meses (3 anos)
            );
        }

        const clientNameNormalized = newServiceData.client.trim().toLowerCase();

        if (editingService) {
            setServices(prev => {
                // Atualiza o serviço editado e limpa previsões automáticas antigas não confirmadas do cliente
                const filtered = prev.filter(s => {
                    if (s.id === editingService.id) return true;
                    if (recurringForecasts.length > 0 &&
                        s.client.trim().toLowerCase() === clientNameNormalized &&
                        s.status === ServiceStatus.PREDICTED &&
                        s.description.includes('Calibração Prevista')) {
                        return false; // Substitui pela nova série projetada
                    }
                    return true;
                });

                const updated = filtered.map(s => s.id === editingService.id ? { ...s, ...newServiceData } : s);
                return recurringForecasts.length > 0 ? [...updated, ...recurringForecasts] : updated;
            });
            setEditingService(null);
            if (recurringForecasts.length > 0) {
                showToast(`Calibração atualizada e ${recurringForecasts.length} agendamento(s) futuro(s) projetado(s) até 36m!`);
            } else {
                showToast('Atividade atualizada com sucesso!');
            }
        } else {
            const newService: Service = {
                ...newServiceData,
                id: `svc-${Date.now()}`,
            };
            setServices(prev => {
                // Limpa previsões automáticas antigas não confirmadas do cliente se uma nova calibração base for criada
                const filtered = prev.filter(s => {
                    if (recurringForecasts.length > 0 &&
                        s.client.trim().toLowerCase() === clientNameNormalized &&
                        s.status === ServiceStatus.PREDICTED &&
                        s.description.includes('Calibração Prevista')) {
                        return false;
                    }
                    return true;
                });

                const updated = [...filtered, newService];
                return recurringForecasts.length > 0 ? [...updated, ...recurringForecasts] : updated;
            });
            if (recurringForecasts.length > 0) {
                showToast(`Calibração cadastrada e ${recurringForecasts.length} agendamento(s) futuro(s) projetado(s) até 36m!`);
            } else {
                showToast('Atividade criada com sucesso!');
            }
        }
        setIsModalOpen(false);
    };

    const handleQuickSave = (data: { client: string; startDate: string; endDate: string }) => {
        const week = isValid(parseISO(data.startDate)) ? getISOWeek(parseISO(data.startDate)) : 0;

        const newService: Omit<Service, 'id'> = {
            week,
            client: data.client,
            manager: '',
            os: '',
            description: '',
            hp: 0,
            ht: 0,
            hv: 0,
            startDate: data.startDate,
            endDate: data.endDate,
            technicianIds: technicians[0] ? [technicians[0].id] : [],
            status: ServiceStatus.PREDICTED,
            period: 6,
            lastCalibration: ''
        };

        handleSaveService(newService);
    };

    const updateService = (id: string, field: keyof Service, value: any) => {
        setServices(prev => prev.map(s => {
            if (s.id !== id) return s;

            const updatedService = { ...s, [field]: value };

            try {
                if (field === 'startDate') {
                    if (!value) {
                        updatedService.startDate = '';
                        updatedService.week = 0;
                    } else {
                        const newStart = parseISO(value);
                        if (!isValid(newStart)) return s;
                        // Calculate duration from old dates if possible
                        let duration = 5;
                        if (s.startDate && s.endDate) {
                            duration = calculateDuration(s.startDate, s.endDate);
                        }
                        if (duration < 1) duration = 1;

                        const newEnd = addDays(newStart, duration - 1);
                        updatedService.endDate = format(newEnd, 'yyyy-MM-dd');
                        updatedService.week = getISOWeek(newStart);
                    }
                }
                if (field === 'endDate') {
                    if (!value) {
                        updatedService.endDate = '';
                    } else {
                        const newEnd = parseISO(value);
                        const start = parseISO(s.startDate);
                        if (!isValid(newEnd) || (s.startDate && isValid(start) && newEnd < start)) return s;
                    }
                }
            } catch (e) {
                return s; // Revert if date parsing fails
            }

            // Logic: If confirmed and end date is in the past, sync lastCalibration
            if (updatedService.status === ServiceStatus.CONFIRMED) {
                // Check if the update was relevant to this rule (Status change or Date change)
                if (field === 'status' || field === 'endDate') {
                    const end = parseISO(updatedService.endDate);
                    const today = startOfDay(new Date());

                    if (isValid(end) && isBefore(end, today)) {
                        updatedService.lastCalibration = updatedService.endDate;
                    }
                }
            }

            return updatedService;
        }));
    };

    const deleteService = (id: string) => {
        setServices(prev => prev.filter(s => s.id !== id));
        showToast('Atividade removida.');
    };

    const handleServiceMove = (id: string, newStartDate: string, newTechId: string, oldTechId: string) => {
        const serviceToMove = services.find(s => s.id === id);
        if (!serviceToMove) return;

        try {
            const duration = calculateDuration(serviceToMove.startDate, serviceToMove.endDate);
            const newStart = parseISO(newStartDate);
            if (!isValid(newStart)) return;

            const newEnd = addDays(newStart, duration - 1);
            const newEndDate = format(newEnd, 'yyyy-MM-dd');
            const newWeek = getISOWeek(newStart);

            // 1. Checar se o reagendamento ultrapassa a data limite da periodicidade (atraso)
            const periodCheck = checkPeriodExceeded(serviceToMove, newStartDate);
            if (periodCheck.isExceeded) {
                const confirmed = window.confirm(
                    `⚠️ ATENÇÃO: PRAZO DE PERIODICIDADE ULTRAPASSADO!\n\n` +
                    `Cliente: ${serviceToMove.client}\n` +
                    `Este reagendamento ultrapassará a data limite de calibração em ${periodCheck.daysExceeded} dia(s) (Data limite: ${periodCheck.limitDateText}).\n\n` +
                    `Ao confirmar, as agendas futuras subsequentes deste cliente serão automaticamente recalculadas e reajustadas a partir desta nova data.\n\n` +
                    `Deseja confirmar o reagendamento?`
                );

                if (!confirmed) {
                    showToast('Reagendamento cancelado para preservar a periodicidade.');
                    return;
                }
            }

            let targetTechId = newTechId;

            // 2. Checar se o técnico de destino está em conflito nesta nova data
            const conflicts = getTechnicianConflicts(services, newTechId, newStartDate, newEndDate, id);

            if (conflicts.length > 0) {
                const conflictTech = technicians.find(t => t.id === newTechId);
                const techName = conflictTech ? `${conflictTech.name} (${conflictTech.fullName})` : 'selecionado';

                // Procurar técnicos livres neste período
                const freeTechs = findAvailableTechnicians(technicians, services, newStartDate, newEndDate, id);

                if (freeTechs.length > 0) {
                    const suggestedTech = freeTechs[0];
                    const accepted = window.confirm(
                        `⚠️ SOBREPOSIÇÃO DETECTADA!\n\n` +
                        `O técnico ${techName} já possui ${conflicts.length} atividade(s) agendada(s) entre ${format(newStart, 'dd/MM/yyyy')} e ${format(newEnd, 'dd/MM/yyyy')}.\n\n` +
                        `Deseja realocar automaticamente esta atividade para o técnico disponível "${suggestedTech.name} (${suggestedTech.fullName})"?`
                    );

                    if (accepted) {
                        targetTechId = suggestedTech.id;
                        showToast(`Atividade realocada para o técnico ${suggestedTech.name}`);
                    } else {
                        showToast('Movimentação cancelada para evitar sobreposição.');
                        return;
                    }
                } else {
                    // Não há técnicos livres -> Bloqueia a sobreposição
                    alert(
                        `🚫 SOBREPOSIÇÃO BLOQUEADA!\n\n` +
                        `O técnico ${techName} está ocupado neste período e NÃO há nenhum outro técnico disponível nesta data.\n\n` +
                        `A alteração foi cancelada.`
                    );
                    return;
                }
            }

            // Tech Swapping Logic:
            const currentTechs = serviceToMove.technicianIds || [];
            let newTechs = [...currentTechs];

            if (oldTechId && targetTechId && oldTechId !== targetTechId) {
                newTechs = newTechs.filter(t => t !== oldTechId);
                if (!newTechs.includes(targetTechId)) {
                    newTechs.push(targetTechId);
                }
            } else if (!currentTechs.includes(targetTechId)) {
                newTechs.push(targetTechId);
            }

            setServices(prev => {
                const updatedMoved = prev.map(s => {
                    if (s.id !== id) return s;

                    const updatedService: Service = {
                        ...s,
                        startDate: newStartDate,
                        endDate: newEndDate,
                        technicianIds: newTechs,
                        week: newWeek
                    };

                    // Logic: If confirmed and moved to the past, sync lastCalibration
                    if (updatedService.status === ServiceStatus.CONFIRMED) {
                        const today = startOfDay(new Date());
                        if (isValid(newEnd) && isBefore(newEnd, today)) {
                            updatedService.lastCalibration = updatedService.endDate;
                        }
                    }

                    return updatedService;
                });

                const targetUpdated = updatedMoved.find(s => s.id === id);
                if (targetUpdated && targetUpdated.period && targetUpdated.period > 0) {
                    // Reajusta em cascata todas as agendas futuras do cliente a partir da nova data
                    return recalculateFutureForecastsFromNewDate(targetUpdated, updatedMoved, technicians);
                }

                return updatedMoved;
            });

            if (periodCheck.isExceeded) {
                showToast(`Atividade reagendada e agendas futuras subsequentes reajustadas em cascata!`);
            } else {
                showToast('Atividade reagendada com sucesso!');
            }
        } catch (e) {
            console.error('Erro ao mover serviço:', e);
            showToast('Erro ao reagendar atividade');
        }
    };

    const handleServiceResize = (id: string, newStartDate: string, newEndDate: string) => {
        const serviceToResize = services.find(s => s.id === id);
        if (!serviceToResize) return;

        const newStart = parseISO(newStartDate);
        const newEnd = parseISO(newEndDate);
        if (!isValid(newStart) || !isValid(newEnd) || newEnd < newStart) return;

        // Checar conflitos para os técnicos atribuídos na nova duração
        const techIds = serviceToResize.technicianIds || [];
        for (const tId of techIds) {
            const conflicts = getTechnicianConflicts(services, tId, newStartDate, newEndDate, id);
            if (conflicts.length > 0) {
                const t = technicians.find(tech => tech.id === tId);
                const tName = t ? `${t.name} (${t.fullName})` : tId;
                const confirmResize = window.confirm(
                    `⚠️ SOBREPOSIÇÃO DETECTADA!\n\nAo alterar a duração, o técnico ${tName} terá sobreposição com ${conflicts.length} outra(s) atividade(s).\n\nDeseja confirmar a alteração mesmo assim?`
                );
                if (!confirmResize) {
                    showToast('Alteração de duração cancelada.');
                    return;
                }
            }
        }

        setServices(prev => prev.map(s => {
            if (s.id !== id) return s;

            const updatedService: Service = {
                ...s,
                startDate: newStartDate,
                endDate: newEndDate,
                week: getISOWeek(newStart),
            };

            // Logic: If confirmed and end date is in the past, sync lastCalibration
            if (updatedService.status === ServiceStatus.CONFIRMED) {
                const today = startOfDay(new Date());
                if (isBefore(newEnd, today)) {
                    updatedService.lastCalibration = newEndDate;
                }
            }

            return updatedService;
        }));
        showToast('Duração da atividade atualizada.');
    };

    const handleServiceClick = (service: Service) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    const handleAddTechnician = (tech: Technician) => {
        setTechnicians(prev => sortTechnicians([...prev, tech]));
    };

    const handleDeleteTechnician = (id: string) => {
        const hasServices = services.some(s => s.technicianIds && s.technicianIds.includes(id));
        if (hasServices) {
            alert('Não é possível excluir um técnico que possui serviços cadastrados.');
            return;
        }
        if (confirm('Confirmar exclusão do técnico?')) {
            setTechnicians(prev => prev.filter(t => t.id !== id));
        }
    };

    const handleAddClient = (clientData: Omit<Client, 'id'>) => {
        setClients(prev => [...prev, { id: `cli-${Date.now()}`, ...clientData }]);
    };

    const handleUpdateClient = (id: string, updatedData: Partial<Client>) => {
        setClients(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
    };

    const handleDeleteClient = (id: string) => {
        if (confirm('Remover este cliente da lista?')) {
            setClients(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleExport = () => exportToExcel(services, technicians);

    // --- Auth Handlers ---
    const handleLogin = (user: User) => {
        setCurrentUser(user);
        showToast(`Bem-vindo, ${user.fullName}!`);
    };

    const handleLogout = () => {
        if (hasUnsavedChanges) {
            setPendingExitAction('logout');
            setIsUnsavedExitModalOpen(true);
        } else {
            setCurrentUser(null);
            showToast('Você foi desconectado');
        }
    };

    const handleSaveAndExit = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            let ok = false;
            if (isNetworkServer) {
                ok = await saveToNetworkServer(services, technicians, clients, users);
            } else if (excelHandle) {
                await saveAllToExcel(excelHandle, services, technicians, clients, users);
                ok = true;
            } else {
                showToast('Nenhum arquivo Excel conectado para salvar.');
                setIsSaving(false);
                return;
            }

            if (ok) {
                markSaved();
                setIsUnsavedExitModalOpen(false);
                showToast('Alterações salvas com sucesso!');
                if (pendingExitAction === 'disconnect') {
                    executeDisconnectExcel();
                } else {
                    setCurrentUser(null);
                    showToast('Você foi desconectado');
                }
            } else {
                showToast('Erro ao salvar as alterações.');
            }
        } catch (error) {
            console.error('Erro ao salvar antes de sair:', error);
            showToast('Erro ao salvar alterações.');
        } finally {
            setIsSaving(false);
            setPendingExitAction(null);
        }
    };

    const handleExitWithoutSaving = () => {
        markSaved();
        setIsUnsavedExitModalOpen(false);
        if (pendingExitAction === 'disconnect') {
            executeDisconnectExcel();
        } else {
            setCurrentUser(null);
            showToast('Você foi desconectado sem salvar as alterações');
        }
        setPendingExitAction(null);
    };


    const handleAddUser = (user: User) => {
        setUsers(prev => [...prev, user]);
        showToast('Usuário adicionado com sucesso!');
    };

    const handleDeleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        showToast('Usuário removido');
    };

    const handleUpdateUser = (id: string, updates: Partial<User>) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
        showToast('Usuário atualizado!');
    };

    const handleUpdateSettings = (newSettings: AppSettings) => {
        setAppSettings(newSettings);
    };

    // Se não está logado, mostra tela de login
    if (!currentUser) {
        return (
            <LoginPage
                onLogin={handleLogin}
                onConnectExcel={handleConnectExcel}
                isExcelConnected={isExcelConnected}
                isExcelLoading={isExcelLoading}
                excelFileName={excelFileName}
                users={users}
            />
        );
    }

    // Verifica permissões do usuário
    const userCanEdit = canEdit(currentUser);
    const userCanManage = canManage(currentUser);
    const userCanExport = canExport(currentUser);

    return (
        <div className="h-screen flex flex-col font-sans text-slate-800 bg-slate-50">

            <AddServiceModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveService}
                onDelete={deleteService}
                technicians={technicians}
                clients={clients}
                serviceToEdit={editingService}
                canEdit={userCanEdit}
            />

            <QuickAddModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                onSave={handleQuickSave}
                clients={clients}
            />

            <TechManagerModal
                isOpen={isTechModalOpen}
                onClose={() => setIsTechModalOpen(false)}
                technicians={technicians}
                onAdd={handleAddTechnician}
                onDelete={handleDeleteTechnician}
            />

            <ClientManagerModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                clients={clients}
                onAdd={handleAddClient}
                onUpdate={handleUpdateClient}
                onDelete={handleDeleteClient}
            />

            <HelpModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />

            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                currentUser={currentUser}
                appSettings={appSettings}
                onUpdateSettings={handleUpdateSettings}
                excelFileName={excelFileName}
                isExcelConnected={isExcelConnected}
                users={users}
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
                onUpdateUser={handleUpdateUser}
            />

            <CalibrationAlertsModal
                isOpen={isCalibrationAlertsModalOpen}
                onClose={() => setIsCalibrationAlertsModalOpen(false)}
                services={services}
                technicians={technicians}
                clients={clients}
                onSelectService={(service) => {
                    setEditingService(service);
                    setIsModalOpen(true);
                }}
                onNavigateToDate={(date) => {
                    setSelectedYear(date.getFullYear());
                    setSelectedMonth(date.getMonth());
                }}
            />

            <UnsavedChangesModal
                isOpen={isUnsavedExitModalOpen}
                onClose={() => setIsUnsavedExitModalOpen(false)}
                onSaveAndExit={handleSaveAndExit}
                onExitWithoutSaving={handleExitWithoutSaving}
                isSaving={isSaving}
                actionType={pendingExitAction || 'logout'}
            />

            {/* --- HEADER & CONTROLS --- */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4 space-y-4 sticky top-0 z-40">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {/* 
                   LOGO IMAGE 
                   You can replace the src below with a local path like "/abb_logo.png" 
                   or "/abb_logo.bmp" if you place the file in the public folder.
                */}
                        <img
                            src="/abb_logo.png"
                            alt="ABB Logo"
                            className="h-8 w-auto object-contain"
                        />

                        <div>
                            <h1 className="text-lg font-bold text-slate-900 leading-none">Digital Visitor Calendar</h1>
                            <p className="text-xs text-slate-500 font-medium">Gestão de Técnicos</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Date Controls */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <div className="px-3 border-r border-slate-300">
                                <select
                                    value={selectedYear}
                                    onChange={(e) => {
                                        setSelectedYear(parseInt(e.target.value, 10));
                                        setCustomDaysOffset(0);
                                    }}
                                    className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer text-sm"
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="px-3">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => {
                                        setSelectedMonth(parseInt(e.target.value, 10));
                                        setCustomDaysOffset(0);
                                    }}
                                    className="bg-transparent font-medium text-slate-600 focus:outline-none cursor-pointer w-32 text-sm"
                                >
                                    <option value={-1} className="font-bold text-abb-red">Ano Inteiro</option>
                                    <option disabled>──────────</option>
                                    {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Controles +/- Dias (só no cronograma) */}
                        {view === 'timeline' && (
                            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1">
                                <button
                                    onClick={() => setCustomDaysOffset(prev => Math.max(prev - 7, -28))}
                                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-abb-red rounded-md transition-all"
                                    title="Reduzir 7 dias"
                                >
                                    <Minus size={14} /> 7d
                                </button>
                                {customDaysOffset !== 0 && (
                                    <button
                                        onClick={() => setCustomDaysOffset(0)}
                                        className="px-2 py-1.5 text-[10px] font-bold text-amber-600 hover:bg-amber-50 rounded-md transition-all"
                                        title="Resetar para período padrão"
                                    >
                                        {customDaysOffset > 0 ? `+${customDaysOffset}d` : `${customDaysOffset}d`}
                                    </button>
                                )}
                                <button
                                    onClick={() => setCustomDaysOffset(prev => Math.min(prev + 7, 90))}
                                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-abb-red rounded-md transition-all"
                                    title="Adicionar 7 dias"
                                >
                                    <Plus size={14} /> 7d
                                </button>
                            </div>
                        )}

                        {/* View Toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setView('grid')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'grid' ? 'bg-abb-red text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                <LayoutGrid size={16} /> Grid
                            </button>
                            <button
                                onClick={() => setView('timeline')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'timeline' ? 'bg-abb-red text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                <CalendarDays size={16} /> Cronograma
                            </button>
                        </div>

                        <div className="h-8 w-px bg-slate-200"></div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                            {/* Excel Connection Buttons */}
                            {isExcelConnected ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-medium text-green-700 max-w-[120px] truncate" title={excelFileName}>
                                            {excelFileName}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleDisconnectExcel}
                                        className="p-1 text-green-600 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                        title="Desconectar do Excel"
                                    >
                                        <Unplug size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleConnectExcel}
                                        disabled={isExcelLoading}
                                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all disabled:opacity-50"
                                        title="Conectar a arquivo Excel existente"
                                    >
                                        {isExcelLoading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <FileSpreadsheet size={16} />
                                        )}
                                        Conectar Excel
                                    </button>
                                    <button
                                        onClick={handleCreateNewExcel}
                                        disabled={isExcelLoading}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-200 transition-all disabled:opacity-50"
                                        title="Criar novo arquivo Excel"
                                    >
                                        <FilePlus2 size={18} />
                                    </button>
                                </div>
                            )}

                            {/* Botão Salvar com Indicador de Alterações */}
                            <button
                                onClick={handleManualSave}
                                disabled={isSaving}
                                title={
                                    hasUnsavedChanges
                                        ? 'Existem alterações não salvas! Clique para salvar no Excel (Ctrl+S)'
                                        : 'Salvar alterações no Excel (Ctrl+S)'
                                }
                                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm ${
                                    isSaving
                                        ? 'bg-amber-50 border-amber-400 text-amber-800 cursor-wait'
                                        : hasUnsavedChanges
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300 animate-pulse'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin text-amber-700" />
                                        <span>Salvando...</span>
                                    </>
                                ) : hasUnsavedChanges ? (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                        </span>
                                        <Save size={16} className="text-white" />
                                        <span>Salvar Alterações *</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} className="text-emerald-700" />
                                        <span>Salvar</span>
                                        <span className="text-[10px] font-medium bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded-full">
                                            ✓ Em dia
                                        </span>
                                    </>
                                )}
                            </button>

                            <div className="h-8 w-px bg-slate-200 mx-1"></div>

                            {/* Botão Central de Alertas de Calibração */}
                            <button
                                onClick={() => setIsCalibrationAlertsModalOpen(true)}
                                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    calibrationAlertsSummary.totalAlerts > 0
                                        ? 'bg-amber-50/80 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-sm'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Central de Alertas de Calibração"
                            >
                                <Bell
                                    size={15}
                                    className={
                                        calibrationAlertsSummary.expired > 0
                                            ? 'text-red-600 animate-bounce'
                                            : calibrationAlertsSummary.expiringSoon > 0
                                            ? 'text-amber-600'
                                            : 'text-slate-500'
                                    }
                                />
                                <span className="hidden sm:inline">Calibrações</span>
                                {calibrationAlertsSummary.expired > 0 && (
                                    <span
                                        className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black"
                                        title={`${calibrationAlertsSummary.expired} calibrações vencidas`}
                                    >
                                        {calibrationAlertsSummary.expired}
                                    </span>
                                )}
                                {calibrationAlertsSummary.expiringSoon > 0 && (
                                    <span
                                        className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black"
                                        title={`${calibrationAlertsSummary.expiringSoon} calibrações a vencer em 30 dias`}
                                    >
                                        {calibrationAlertsSummary.expiringSoon}
                                    </span>
                                )}
                            </button>

                            {userCanExport && (
                                <button onClick={handleExport} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Baixar Excel">
                                    <Download size={18} />
                                </button>
                            )}
                            {userCanManage && (
                                <>
                                    <button onClick={() => setIsTechModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Gerenciar Equipe">
                                        <Users size={18} />
                                    </button>
                                    <button onClick={() => setIsClientModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Gerenciar Clientes">
                                        <Building2 size={18} />
                                    </button>
                                </>
                            )}

                            <button onClick={() => setIsHelpModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Ajuda e Instruções">
                                <HelpCircle size={18} />
                            </button>

                            {userCanManage && (
                                <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Configurações">
                                    <Settings size={18} />
                                </button>
                            )}

                            <div className="h-8 w-px bg-slate-200 mx-1"></div>

                            {/* User Info & Logout */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                                <span className="text-xs font-medium text-slate-600 max-w-[100px] truncate" title={currentUser?.fullName}>
                                    {currentUser?.fullName}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="p-1 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    title="Sair"
                                >
                                    <LogOut size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- FILTER BAR --- */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Filter size={14} />
                        <span className="text-xs font-bold uppercase">Filtros</span>
                    </div>

                    <div className="flex items-center gap-2 relative group flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-abb-red" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por Cliente, OS, Gerente, Descrição..."
                            className="pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm w-full focus:outline-none focus:border-abb-red/50 focus:ring-2 focus:ring-abb-red/20 transition-all"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>

                    <select
                        className="bg-slate-100 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-abb-red/50 focus:ring-2 focus:ring-abb-red/20 transition-all"
                        value={filterTechId}
                        onChange={(e) => setFilterTechId(e.target.value)}
                    >
                        <option value="all">Todos Técnicos</option>
                        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <select
                        className="bg-slate-100 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-abb-red/50 focus:ring-2 focus:ring-abb-red/20 transition-all"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">Todos Status</option>
                        {Object.values(ServiceStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {view === 'grid' && (
                        <button
                            onClick={() => setIsGrouped(!isGrouped)}
                            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${isGrouped ? 'bg-abb-red/10 text-abb-red border-abb-red/20' : 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200'}`}
                        >
                            <Layers size={14} />
                            {isGrouped ? 'Agrupado' : 'Agrupar'}
                        </button>
                    )}

                    {userCanEdit && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsQuickAddOpen(true)}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md shadow-amber-500/20 transition-all text-sm"
                                title="Adição Rápida"
                            >
                                <Zap size={16} fill="currentColor" /> Rápido
                            </button>

                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-abb-red hover:brightness-110 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-medium shadow-md shadow-abb-red/20 transition-all text-sm"
                            >
                                <Plus size={16} /> Novo
                            </button>
                        </div>
                    )}

                    <div className="relative" ref={legendRef}>
                        <button
                            onClick={() => setIsLegendOpen(prev => !prev)}
                            className="text-xs font-semibold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                        >
                            Legenda
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isLegendOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isLegendOpen && (
                            <div className="absolute top-full mt-2 right-0 min-w-[240px] bg-white border border-slate-200 rounded-lg shadow-xl z-[100] p-3">
                                <div className="space-y-2.5">
                                    {legendItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className={`w-4 h-4 rounded-md ${item.color} shadow-sm flex-shrink-0`}></span>
                                            <span className="text-xs font-medium text-slate-700">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {filteredServices.length} atividades
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-grow overflow-hidden relative">
                {view === 'grid' ? (
                    <ServiceGrid
                        services={filteredServices}
                        technicians={technicians}
                        clients={clients}
                        onUpdate={updateService}
                        onDelete={deleteService}
                        canEdit={userCanEdit}
                    />
                ) : (
                    <ResourceTimeline
                        services={filteredServices}
                        technicians={visibleTechnicians}
                        onServiceMove={handleServiceMove}
                        onServiceResize={handleServiceResize}
                        onServiceClick={handleServiceClick}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        isYearView={selectedMonth === -1}
                        canEdit={userCanEdit}
                    />
                )}
            </main>

            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl z-[100] flex items-center gap-3 transition-opacity duration-300">
                    <div className="bg-green-500 rounded-full p-1">
                        <CheckCircle size={16} className="text-white" />
                    </div>
                    <span className="font-medium text-sm">{toast.message}</span>
                </div>
            )}
        </div>
    );
};

export default App;