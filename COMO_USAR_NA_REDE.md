# 🚀 Guia de Implantação e Execução na Rede Local

Este aplicativo foi configurado para rodar **100% portátil** a partir de uma pasta compartilhada na rede, **sem que o usuário precise instalar nada na máquina dele** (sem Node.js, sem permissão de Administrador).

---

## 📁 Estrutura de Arquivos da Pasta de Rede

Basta copiar os seguintes arquivos e pastas para o diretório compartilhado na rede (ex: `\\servidor\Visitas\` ou `Z:\Calendario\`):

```
📁 Pasta Compartilhada na Rede
│
├── 🔴 Calendario Digital ABB.lnk       <-- ATALHO COM O ÍCONE OFICIAL DA ABB (Duplo clique)
├── 📅 Abrir Calendario.bat             <-- Inicializador em lote
├── 📌 Criar Atalho na Area de Trabalho.bat <-- Cria o ícone da ABB na sua Área de Trabalho
├── ⚙️ server.ps1                        <-- Micro-servidor nativo (oculto em background)
├── 📊 Calendario_Digital_Base.xlsx       <-- Planilha Excel central compartilhada
├── 🔴 abb.ico                           <-- Ícone oficial da ABB (multi-resolução)
└── 📁 dist/                             <-- Pasta contendo a aplicação compilada
```

---

## 🖱️ Como o Usuário Utiliza

1. O usuário abre a pasta na rede e dá **duplo clique no atalho com a logo da ABB** (**`Calendario Digital ABB.lnk`**).
   *(Opcional: O usuário também pode dar duplo clique em `Criar Atalho na Area de Trabalho.bat` para ter o ícone da ABB direto no seu Desktop com 1 clique!)*
2. O sistema abre instantaneamente uma janela dedicada em modo App Desktop com o ícone oficial da ABB na barra de tarefas.
4. O usuário entra com seu **login e senha**:
   * **Administrador padrão inicial:**
     * **Usuário:** `admin`
     * **Senha:** `admin123`
5. O sistema carrega automaticamente os dados da planilha central `Calendario_Digital_Base.xlsx` localizada na mesma pasta da rede.
6. Qualquer alteração ou nova visita agendada pode ser gravada diretamente no arquivo Excel central clicando no botão **"Salvar"** ou pelo atalho **Ctrl + S** (com proteção caso tente fechar a janela sem salvar).

---

## 🔒 Segurança e Perfis de Acesso

* **Admin:** Acesso total (gerenciar técnicos, clientes, usuários, alterar senhas e editar visitas).
* **Operador:** Criação, movimentação (Drag & Drop), edição e exclusão de visitas/calibrações.
* **Usuário (Consulta):** Visualização do cronograma, filtros e relatórios de vencimento, sem permissão de edição.

---

## 🌐 Configuração de Portas e Conectividade
* **Porta Padrão:** O sistema utiliza nativamente a porta **`3050`** (ou portas subsequentes `3051`, `3052` se a 3050 estiver em uso).
* **Isolamento de Conflitos:** A porta **`3000`** está permanentemente bloqueada de ser usada por esta aplicação em qualquer computador, evitando conflitos com outras aplicações web ou sistemas em execução na mesma máquina.
