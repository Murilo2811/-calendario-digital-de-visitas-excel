import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Service, Technician, ViewMode, ServiceStatus, TechType, Client, User, AppSettings } from './types';
import { INITIAL_SERVICES, TECHNICIANS, INITIAL_CLIENTS } from './constants';
import { ServiceGrid } from './components/ServiceGrid';
import { ResourceTimeline } from './components/ResourceTimeline';
import { AddServiceModal } from './components/AddServiceModal';
import { QuickAddModal } from './components/QuickAddModal';
import { TechManagerModal } from './components/TechManagerModal';
import { ClientManagerModal } from './components/ClientManagerModal';
import { HelpModal } from './components/HelpModal';
import { ConfirmDisconnectModal } from './components/ConfirmDisconnectModal';
import { LoginPage } from './components/LoginPage';
import { SettingsModal } from './components/SettingsModal';
import { createDefaultAdmin, canEdit } from './authService';
import { calculateDuration, exportToExcel } from './utils';
import {
    openExcelFile,
    createNewExcelFile,
    readAllFromExcel,
    saveAllToExcel,
    isFileSystemAccessSupported,
} from './excelService';
// FIX: Switched to deep imports for date-fns to resolve module loading errors.
// FIX: Changed date-fns imports to named exports from submodules to support date-fns v3.
import { addDays } from 'date-fns/addDays';
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
    Layers,
    HelpCircle,
    Zap,
    CheckCircle,
    FileSpreadsheet,
    Unplug,
    Loader2,
    FilePlus2,
    Settings,
    LogOut
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
    const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
    const [technicians, setTechnicians] = useState<Technician[]>(() => sortTechnicians(TECHNICIANS));
    const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isTechModalOpen, setIsTechModalOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

    const [searchText, setSearchText] = useState('');
    const [filterTechId, setFilterTechId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const legendRef = useRef<HTMLDivElement>(null);
    const [isGrouped, setIsGrouped] = useState(false);

    // Excel Connection State
    const [excelHandle, setExcelHandle] = useState<FileSystemFileHandle | null>(null);
    const [isExcelConnected, setIsExcelConnected] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    const [excelFileName, setExcelFileName] = useState<string>('');

    // Toast State
    const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    // Clock State
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    // Auth State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
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

    // Show reconnect prompt on mount
    useEffect(() => {
        if (appSettings.autoReconnectPrompt && appSettings.lastExcelFileName && !isExcelConnected && !currentUser) {
            const shouldReconnect = window.confirm(
                `Deseja reconectar ao arquivo "${appSettings.lastExcelFileName}"?\n\nClique em OK e selecione o arquivo.`
            );
            if (shouldReconnect) {
                handleConnectExcel();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
                setIsLegendOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [legendRef]);

    const legendItems = [
        { color: 'bg-slate-400', label: ServiceStatus.TRAINING_FIELD },
        { color: 'bg-yellow-400', label: ServiceStatus.PREDICTED },
        { color: 'bg-orange-400', label: ServiceStatus.WITH_ORDER },
        { color: 'bg-green-600', label: ServiceStatus.CONFIRMED },
        { color: 'bg-purple-500', label: ServiceStatus.TRAINING },
        { color: 'bg-blue-500', label: ServiceStatus.VACATION },
        { color: 'bg-cyan-400', label: ServiceStatus.NEGOTIATION },
        { color: 'bg-slate-800', label: ServiceStatus.HOLIDAY },
    ];

    const showToast = (message: string) => {
        setToast({ show: true, message });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3000);
    };

    // --- Excel Functions ---
    const saveToExcelIfConnected = useCallback(async (
        newServices: Service[],
        newTechnicians: Technician[],
        newClients: Client[],
        newUsers: User[]
    ) => {
        if (excelHandle && isExcelConnected) {
            try {
                await saveAllToExcel(excelHandle, newServices, newTechnicians, newClients, newUsers);
            } catch (error) {
                console.error('Erro ao salvar no Excel:', error);
                showToast('Erro ao salvar no Excel!');
            }
        }
    }, [excelHandle, isExcelConnected]);

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
                showToast(`Novo arquivo criado: ${handle.name}`);
            }
        } catch (error) {
            console.error('Erro ao criar Excel:', error);
            showToast('Erro ao criar arquivo Excel');
        } finally {
            setIsExcelLoading(false);
        }
    };

    const handleDisconnectExcel = () => {
        // Abre o modal de confirmação em vez de desconectar diretamente
        setIsDisconnectModalOpen(true);
    };

    const handleSaveAndDisconnect = async () => {
        if (excelHandle) {
            setIsExcelLoading(true);
            try {
                await saveAllToExcel(excelHandle, services, technicians, clients, users);
                showToast('Alterações salvas com sucesso!');
            } catch (error) {
                console.error('Erro ao salvar:', error);
                showToast('Erro ao salvar alterações');
            } finally {
                setIsExcelLoading(false);
            }
        }
        setExcelHandle(null);
        setExcelFileName('');
        setIsExcelConnected(false);
        setIsDisconnectModalOpen(false);
        showToast('Desconectado do arquivo Excel');
        setCurrentUser(null); // Logout ao desconectar
    };

    const handleDisconnectWithoutSave = () => {
        setExcelHandle(null);
        setExcelFileName('');
        setIsExcelConnected(false);
        setIsDisconnectModalOpen(false);
        showToast('Desconectado do arquivo Excel (sem salvar)');
        setCurrentUser(null); // Logout ao desconectar
    };

    // Auto-save quando dados mudam e está conectado
    useEffect(() => {
        if (isExcelConnected && excelHandle) {
            const timeoutId = setTimeout(() => {
                saveToExcelIfConnected(services, technicians, clients, users);
            }, 500); // Debounce de 500ms
            return () => clearTimeout(timeoutId);
        }
    }, [services, technicians, clients, users, isExcelConnected, excelHandle, saveToExcelIfConnected]);

    // --- Date Logic ---
    const { rangeStart, rangeEnd } = useMemo(() => {
        if (selectedMonth === -1) {
            const start = startOfYear(new Date(selectedYear, 0, 1));
            const end = endOfYear(new Date(selectedYear, 0, 1));
            return { rangeStart: start, rangeEnd: end };
        } else {
            const start = startOfMonth(new Date(selectedYear, selectedMonth, 1));
            const end = endOfMonth(new Date(selectedYear, selectedMonth, 1));
            return { rangeStart: start, rangeEnd: end };
        }
    }, [selectedYear, selectedMonth]);

    const servicesForSelectedYear = useMemo(() => {
        const yearStart = startOfYear(new Date(selectedYear, 0, 1));
        const yearEnd = endOfYear(new Date(selectedYear, 0, 1));

        return services.filter(s => {
            // ALWAYS include services with missing or invalid dates so user can fix them
            if (!s.startDate || !s.endDate) return true;

            try {
                const sStart = parseISO(s.startDate);
                const sEnd = parseISO(s.endDate);

                // If dates are invalid, include them
                if (!isValid(sStart) || !isValid(sEnd)) return true;

                // Otherwise check overlap
                return sStart <= yearEnd && sEnd >= yearStart;
            } catch {
                // If error parsing, include it
                return true;
            }
        });
    }, [services, selectedYear]);

    const filteredServices = useMemo(() => {
        let servicesToFilter = servicesForSelectedYear;

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
    }, [servicesForSelectedYear, searchText, filterTechId, filterStatus, isGrouped, view]);

    const visibleTechnicians = useMemo(() => {
        if (filterTechId === 'all') return technicians;
        return technicians.filter(t => t.id === filterTechId);
    }, [technicians, filterTechId]);

    // --- CRUD Operations ---
    const handleSaveService = (serviceData: Omit<Service, 'id'>) => {
        const newServiceData = { ...serviceData };

        // Auto-update Last Calibration if Confirmed and in Past
        if (newServiceData.status === ServiceStatus.CONFIRMED) {
            const end = parseISO(newServiceData.endDate);
            const today = startOfDay(new Date());
            if (isValid(end) && isBefore(end, today)) {
                newServiceData.lastCalibration = newServiceData.endDate;
            }
        }

        if (editingService) {
            setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, ...newServiceData } : s));
            setEditingService(null);
            showToast('Atividade atualizada com sucesso!');
        } else {
            const newService: Service = {
                ...newServiceData,
                id: `svc-${Date.now()}`,
            };
            setServices(prev => [...prev, newService]);
            showToast('Atividade criada com sucesso!');
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
                if (field === 'endDate') {
                    const newEnd = parseISO(value);
                    const start = parseISO(s.startDate);
                    if (!isValid(newEnd) || (s.startDate && isValid(start) && newEnd < start)) return s;
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
        setServices(prev => prev.map(s => {
            if (s.id !== id) return s;
            try {
                const duration = calculateDuration(s.startDate, s.endDate);
                const newStart = parseISO(newStartDate);
                const newEnd = addDays(newStart, duration - 1);
                const newWeek = getISOWeek(newStart);

                // Tech Swapping Logic:
                // Remove the 'oldTechId' (where drag started) and add 'newTechId' (where dropped)
                // If dragging within the same tech, this effectively does nothing to the list.
                const currentTechs = s.technicianIds || [];
                let newTechs = [...currentTechs];

                if (oldTechId && newTechId && oldTechId !== newTechId) {
                    // Remove old tech
                    newTechs = newTechs.filter(t => t !== oldTechId);
                    // Add new tech if not present
                    if (!newTechs.includes(newTechId)) {
                        newTechs.push(newTechId);
                    }
                } else if (!currentTechs.includes(newTechId)) {
                    // Fallback for edge cases, though timeline should provide oldTechId
                    newTechs.push(newTechId);
                }

                const updatedService = {
                    ...s,
                    startDate: newStartDate,
                    endDate: format(newEnd, 'yyyy-MM-dd'),
                    technicianIds: newTechs,
                    week: newWeek
                };

                // Logic: If confirmed and moved to the past, sync lastCalibration
                if (updatedService.status === ServiceStatus.CONFIRMED) {
                    const end = newEnd; // already a Date object from addDays
                    const today = startOfDay(new Date());
                    if (isValid(end) && isBefore(end, today)) {
                        updatedService.lastCalibration = updatedService.endDate;
                    }
                }

                return updatedService;
            } catch {
                return s;
            }
        }));
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
        setCurrentUser(null);
        showToast('Você foi desconectado');
    };

    const handleAddUser = (user: User) => {
        setUsers(prev => [...prev, user]);
        showToast('Usuário adicionado com sucesso!');
    };

    const handleDeleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        showToast('Usuário removido');
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
                onCreateExcel={handleCreateNewExcel}
                isExcelConnected={isExcelConnected}
                isExcelLoading={isExcelLoading}
                excelFileName={excelFileName}
                users={users}
            />
        );
    }

    // Verifica se usuário pode editar
    const userCanEdit = canEdit(currentUser);

    return (
        <div className="h-screen flex flex-col font-sans text-slate-800 bg-slate-50">

            <AddServiceModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveService}
                technicians={technicians}
                clients={clients}
                serviceToEdit={editingService}
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

            <ConfirmDisconnectModal
                isOpen={isDisconnectModalOpen}
                fileName={excelFileName}
                onSaveAndDisconnect={handleSaveAndDisconnect}
                onDisconnectWithoutSave={handleDisconnectWithoutSave}
                onCancel={() => setIsDisconnectModalOpen(false)}
                isSaving={isExcelLoading}
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
            />

            {/* --- HEADER & CONTROLS --- */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4 space-y-4 sticky top-0 z-30">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {/* 
                   LOGO IMAGE 
                   You can replace the src below with a local path like "/abb_logo.png" 
                   or "/abb_logo.bmp" if you place the file in the public folder.
                */}
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/ABB_logo.svg/1280px-ABB_logo.svg.png"
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
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer text-sm"
                                >
                                    {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="px-3">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
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

                            <div className="h-8 w-px bg-slate-200 mx-1"></div>

                            <button onClick={handleExport} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Baixar Excel">
                                <Download size={18} />
                            </button>
                            {userCanEdit && (
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

                            <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Configurações">
                                <Settings size={18} />
                            </button>

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

                            {userCanEdit && (
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={() => setIsQuickAddOpen(true)}
                                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md shadow-amber-500/20 transition-all text-sm"
                                        title="Adição Rápida"
                                    >
                                        <Zap size={18} fill="currentColor" /> Rápido
                                    </button>

                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="bg-abb-red hover:brightness-110 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-md shadow-abb-red/20 transition-all"
                                    >
                                        <Plus size={18} /> Novo
                                    </button>
                                </div>
                            )}
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

                    <div className="relative" ref={legendRef}>
                        <button
                            onClick={() => setIsLegendOpen(prev => !prev)}
                            className="text-xs font-semibold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                        >
                            Legenda
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isLegendOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isLegendOpen && (
                            <div className="absolute top-full mt-2 right-0 min-w-[240px] bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3">
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
                        onServiceClick={handleServiceClick}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
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