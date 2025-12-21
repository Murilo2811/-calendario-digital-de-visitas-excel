import React, { useState } from 'react';
import { User, AppSettings } from '../types';
import { isAdmin, hashPassword } from '../authService';
import {
    X,
    Settings,
    FileSpreadsheet,
    Users,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Save,
    ToggleLeft,
    ToggleRight,
    Shield,
    User as UserIcon,
    AlertCircle,
    Edit3,
    Check,
    XCircle
} from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User | null;
    appSettings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
    excelFileName: string;
    isExcelConnected: boolean;
    users: User[];
    onAddUser: (user: User) => void;
    onDeleteUser: (id: string) => void;
    onUpdateUser: (id: string, updates: Partial<User>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    appSettings,
    onUpdateSettings,
    excelFileName,
    isExcelConnected,
    users,
    onAddUser,
    onDeleteUser,
    onUpdateUser,
}) => {
    const [activeTab, setActiveTab] = useState<'excel' | 'users'>('excel');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newFullName, setNewFullName] = useState('');
    const [newRole, setNewRole] = useState<'admin' | 'operador' | 'user'>('user');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [addError, setAddError] = useState('');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingRole, setEditingRole] = useState<'admin' | 'operador' | 'user'>('user');

    if (!isOpen) return null;

    const adminAccess = isAdmin(currentUser);

    const handleToggleAutoReconnect = () => {
        onUpdateSettings({
            ...appSettings,
            autoReconnectPrompt: !appSettings.autoReconnectPrompt,
        });
    };

    const handleAddUser = async () => {
        setAddError('');

        if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) {
            setAddError('Preencha todos os campos');
            return;
        }

        if (users.some(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
            setAddError('Usuário já existe');
            return;
        }

        setIsAddingUser(true);
        try {
            const passwordHash = await hashPassword(newPassword);
            const newUser: User = {
                id: `user-${Date.now()}`,
                username: newUsername.trim(),
                passwordHash,
                role: newRole,
                fullName: newFullName.trim(),
                createdAt: new Date().toISOString().split('T')[0],
            };

            onAddUser(newUser);
            setNewUsername('');
            setNewPassword('');
            setNewFullName('');
            setNewRole('user');
        } catch (err) {
            setAddError('Erro ao criar usuário');
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleDeleteUser = (id: string) => {
        if (id === currentUser?.id) {
            alert('Você não pode deletar seu próprio usuário');
            return;
        }
        if (confirm('Tem certeza que deseja remover este usuário?')) {
            onDeleteUser(id);
        }
    };

    const handleStartEdit = (user: User) => {
        setEditingUserId(user.id);
        setEditingRole(user.role);
    };

    const handleSaveEdit = (userId: string) => {
        onUpdateUser(userId, { role: editingRole });
        setEditingUserId(null);
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b bg-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                            <Settings size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Configurações</h2>
                            <p className="text-xs text-slate-500">Gerenciar aplicação e usuários</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-slate-50">
                    <button
                        onClick={() => setActiveTab('excel')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'excel'
                            ? 'bg-white border-b-2 border-abb-red text-abb-red'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FileSpreadsheet size={16} />
                        Arquivo Excel
                    </button>
                    {adminAccess && (
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'users'
                                ? 'bg-white border-b-2 border-abb-red text-abb-red'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Users size={16} />
                            Usuários
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow">

                    {/* Tab: Excel */}
                    {activeTab === 'excel' && (
                        <div className="space-y-6">
                            {/* Arquivo Conectado */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Arquivo Conectado</h3>
                                <div className={`p-4 rounded-lg border ${isExcelConnected ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                    {isExcelConnected ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                                <FileSpreadsheet size={20} className="text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-green-800">{excelFileName}</p>
                                                <p className="text-xs text-green-600">Conectado e sincronizando</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-500 py-2">
                                            Nenhum arquivo conectado
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Preferências */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Preferências</h3>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-slate-800">Lembrar arquivo ao iniciar</p>
                                            <p className="text-xs text-slate-500">
                                                Perguntar se deseja reconectar ao último arquivo usado
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleToggleAutoReconnect}
                                            className="text-abb-red"
                                        >
                                            {appSettings.autoReconnectPrompt ? (
                                                <ToggleRight size={32} />
                                            ) : (
                                                <ToggleLeft size={32} className="text-slate-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Último arquivo */}
                            {appSettings.lastExcelFileName && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-700 mb-3">Último Arquivo Usado</h3>
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <p className="text-slate-600 font-mono text-sm">
                                            {appSettings.lastExcelFileName}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: Usuários (apenas admin) */}
                    {activeTab === 'users' && adminAccess && (
                        <div className="space-y-6">
                            {/* Adicionar Usuário */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Adicionar Novo Usuário</h3>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Usuário"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Nome Completo"
                                            value={newFullName}
                                            onChange={(e) => setNewFullName(e.target.value)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                placeholder="Senha"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <select
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value as 'admin' | 'operador' | 'user')}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red bg-white"
                                        >
                                            <option value="user">Visualização</option>
                                            <option value="operador">Operador</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>

                                    {addError && (
                                        <div className="flex items-center gap-2 text-red-600 text-sm">
                                            <AlertCircle size={14} />
                                            {addError}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleAddUser}
                                        disabled={isAddingUser}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-abb-red hover:brightness-110 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                                    >
                                        <Plus size={16} />
                                        Adicionar Usuário
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Usuários */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 mb-3">
                                    Usuários Cadastrados ({users.length})
                                </h3>
                                <div className="space-y-2">
                                    {users.map((user) => (
                                        <div
                                            key={user.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${user.id === currentUser?.id
                                                ? 'bg-abb-red/5 border-abb-red/20'
                                                : 'bg-slate-50 border-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-amber-100 text-amber-600' :
                                                    user.role === 'operador' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-slate-200 text-slate-500'
                                                    }`}>
                                                    {user.role === 'admin' ? <Shield size={14} /> : <UserIcon size={14} />}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800">{user.fullName}</p>
                                                    <p className="text-xs text-slate-500">
                                                        @{user.username} · {
                                                            user.role === 'admin' ? 'Administrador' :
                                                                user.role === 'operador' ? 'Operador' :
                                                                    'Visualização'
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingUserId === user.id ? (
                                                    <>
                                                        <select
                                                            value={editingRole}
                                                            onChange={(e) => setEditingRole(e.target.value as 'admin' | 'operador' | 'user')}
                                                            className="px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-abb-red"
                                                        >
                                                            <option value="user">Visualização</option>
                                                            <option value="operador">Operador</option>
                                                            <option value="admin">Administrador</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleSaveEdit(user.id)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-all"
                                                            title="Salvar"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-all"
                                                            title="Cancelar"
                                                        >
                                                            <XCircle size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    user.id !== currentUser?.id && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStartEdit(user)}
                                                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Editar papel"
                                                            >
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Remover usuário"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {users.length === 0 && (
                                        <div className="text-center text-slate-500 py-4">
                                            Nenhum usuário cadastrado
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors text-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
