import React, { useState } from 'react';
import { User } from '../types';
import { validateUser } from '../authService';
import {
    FileSpreadsheet,
    LogIn,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    CheckCircle,
    UserPlus
} from 'lucide-react';

interface LoginPageProps {
    onLogin: (user: User) => void;
    onConnectExcel: () => Promise<void>;
    isExcelConnected: boolean;
    isExcelLoading: boolean;
    excelFileName: string;
    users: User[];
}

export const LoginPage: React.FC<LoginPageProps> = ({
    onLogin,
    onConnectExcel,
    isExcelConnected,
    isExcelLoading,
    excelFileName,
    users,
}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (!isExcelConnected) {
                setError('Conecte-se a um arquivo Excel primeiro');
                setIsLoading(false);
                return;
            }

            if (!username.trim() || !password.trim()) {
                setError('Preencha todos os campos');
                setIsLoading(false);
                return;
            }

            const user = await validateUser(username, password, users);

            if (user) {
                onLogin(user);
            } else {
                setError('Usuário ou senha inválidos');
            }
        } catch (err) {
            setError('Erro ao validar credenciais');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGuestLogin = () => {
        if (!isExcelConnected) {
            setError('Conecte-se a um arquivo Excel primeiro');
            return;
        }

        // Criar usuário visitante temporário
        const guestUser: User = {
            id: 'guest-' + Date.now(),
            username: 'visitante',
            passwordHash: '',
            role: 'user',
            fullName: 'Visitante',
            createdAt: new Date().toISOString().split('T')[0],
        };

        onLogin(guestUser);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo e Título */}
                <div className="text-center mb-8">
                    <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/ABB_logo.svg/1280px-ABB_logo.svg.png"
                        alt="ABB Logo"
                        className="h-12 mx-auto mb-4 filter brightness-0 invert"
                    />
                    <h1 className="text-2xl font-bold text-white">Digital Visitor Calendar</h1>
                    <p className="text-slate-400 text-sm mt-1">Gestão de Técnicos</p>
                </div>

                {/* Card de Login */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    {/* Status do Excel */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            1. Conectar ao Banco de Dados
                        </label>

                        {isExcelConnected ? (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle size={20} className="text-green-600" />
                                <div className="flex-grow">
                                    <p className="text-sm font-medium text-green-800">Conectado</p>
                                    <p className="text-xs text-green-600 truncate" title={excelFileName}>
                                        {excelFileName}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={onConnectExcel}
                                disabled={isExcelLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                            >
                                {isExcelLoading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <FileSpreadsheet size={18} />
                                )}
                                Conectar Excel
                            </button>
                        )}
                    </div>

                    {/* Formulário de Login */}
                    <form onSubmit={handleSubmit}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            2. Fazer Login
                        </label>

                        <div className="space-y-4">
                            {/* Usuário */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Usuário
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Digite seu usuário"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red transition-all"
                                    disabled={!isExcelConnected}
                                />
                            </div>

                            {/* Senha */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Senha
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Digite sua senha"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red transition-all pr-12"
                                        disabled={!isExcelConnected}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Erro */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {/* Botão de Login */}
                            <button
                                type="submit"
                                disabled={!isExcelConnected || isLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-abb-red hover:brightness-110 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <LogIn size={18} />
                                )}
                                Entrar
                            </button>
                        </div>
                    </form>

                    {/* Aviso de navegador */}
                    <p className="text-xs text-slate-400 text-center mt-6">
                        Use Chrome ou Edge para acessar arquivos locais
                    </p>

                    {/* Separador */}
                    <div className="flex items-center gap-4 mt-6">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="text-xs text-slate-400">ou</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* Botão de Visitante */}
                    <button
                        onClick={handleGuestLogin}
                        disabled={!isExcelConnected}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
                    >
                        <UserPlus size={18} />
                        Entrar como Visitante
                    </button>
                    <p className="text-xs text-slate-400 text-center mt-2">
                        Acesso somente para visualização
                    </p>
                </div>
            </div>
        </div>
    );
};
