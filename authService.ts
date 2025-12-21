/**
 * Auth Service - Serviço de Autenticação
 * Funções para hash de senha e validação de usuários
 */

import { User } from './types';

/**
 * Gera hash SHA-256 de uma string
 * Usa a Web Crypto API padrão do navegador
 */
export const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

/**
 * Valida credenciais do usuário
 * Retorna o usuário se válido, null caso contrário
 */
export const validateUser = async (
    username: string,
    password: string,
    users: User[]
): Promise<User | null> => {
    const passwordHash = await hashPassword(password);

    const user = users.find(u =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.passwordHash === passwordHash
    );

    return user || null;
};

/**
 * Cria usuário admin padrão
 */
export const createDefaultAdmin = async (): Promise<User> => {
    const passwordHash = await hashPassword('1612goodBme');

    return {
        id: 'user-admin-001',
        username: 'leandro fernandes',
        passwordHash,
        role: 'admin',
        fullName: 'Leandro Fernandes',
        createdAt: new Date().toISOString().split('T')[0],
    };
};

/**
 * Verifica se usuário tem permissão de admin
 */
export const isAdmin = (user: User | null): boolean => {
    return user?.role === 'admin';
};

/**
 * Verifica se usuário pode editar (apenas admin)
 */
export const canEdit = (user: User | null): boolean => {
    return user?.role === 'admin';
};

/**
 * Verifica se usuário pode visualizar (admin ou user)
 */
export const canView = (user: User | null): boolean => {
    return user !== null;
};
