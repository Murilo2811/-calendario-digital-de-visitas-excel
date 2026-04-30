# Integrations

## Local File System
The application integrates deeply with the user's local file system using the **File System Access API**.
- It prompts the user to select an Excel file (.xlsx).
- It retains permission to read/write to this file by storing the FileSystemFileHandle in IndexedDB.

## Excel / Spreadsheet Processing
- Uses the xlsx library by SheetJS to parse and serialize data back and forth between JavaScript objects and the Excel file.
- The Excel file acts as the primary datastore with tabs for: Atividades (Services), Tecnicos (Technicians), Clientes (Clients), and Usuarios (Users).

*Note: There is no backend server or external API integration.*
