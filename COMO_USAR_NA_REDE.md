# 🚀 Guia de Implantação e Execução na Rede Local

Este aplicativo foi configurado para rodar **100% portátil** a partir de uma pasta compartilhada na rede, **sem que o usuário precise instalar nada na máquina dele** (sem Node.js, sem permissão de Administrador).

---

## 📁 Estrutura de Arquivos da Pasta de Rede

Basta copiar os seguintes arquivos e pastas para o diretório compartilhado na rede (ex: `\\servidor\Visitas\` ou `Z:\Calendario\`):

```
📁 Pasta Compartilhada na Rede
│
├── 📅 Abrir Calendario.bat          <-- O usuário só dá duplo clique AQUI
├── ⚙️ server.ps1                   <-- Micro-servidor nativo (oculto em background)
├── 📊 Calendario_Digital_Base.xlsx  <-- Planilha Excel central compartilhada
└── 📁 dist/                         <-- Pasta contendo a aplicação compilada
```

---

## 🖱️ Como o Usuário Utiliza

1. O usuário abre a pasta na rede (ou um atalho criado na Área de Trabalho dele apontando para o `Abrir Calendario.bat`).
2. Dá **duplo clique** em **`Abrir Calendario.bat`**.
3. O sistema abre instantaneamente uma janela dedicada do Microsoft Edge (em modo App Desktop, sem barra de navegação).
4. O usuário entra com seu **login e senha**:
   * **Administrador padrão inicial:**
     * **Usuário:** `admin`
     * **Senha:** `admin123`
5. O sistema carrega automaticamente os dados da planilha central `Calendario_Digital_Base.xlsx` localizada na mesma pasta da rede.
6. Qualquer alteração ou nova visita agendada é **salva automaticamente em tempo real** diretamente no arquivo Excel central.

---

## 🔒 Segurança e Perfis de Acesso

* **Admin:** Acesso total (gerenciar técnicos, clientes, usuários, alterar senhas e editar visitas).
* **Operador:** Criação, movimentação (Drag & Drop), edição e exclusão de visitas/calibrações.
* **Usuário (Consulta):** Visualização do cronograma, filtros e relatórios de vencimento, sem permissão de edição.
