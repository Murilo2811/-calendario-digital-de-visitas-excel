# Architecture

## Overview
This is a **Serverless Local-First Web Application**. The application relies entirely on the client-side browser capabilities and a local Excel file for its database.

## Components
1. **Presentation Layer (React)**: 
   - Uses functional components and hooks.
   - Responsible for UI rendering, modal dialogs, timeline, and grid views.
2. **Business Logic**:
   - utils.ts: Contains pure functions for date manipulation, calibration calculations, and formatting.
3. **Data Access Layer (excelService.ts)**:
   - Abstracts the File System Access API.
   - Manages IndexedDB for handle persistence.
   - Handles the conversion of Excel rows into typed objects (Services, Technicians, etc.).
4. **Authentication Layer (authService.ts)**:
   - Simple client-side role-based access control based on user records stored in the Excel file.
   - Passwords are conventionally hashed in SHA-256 for basic security.

## Data Flow
- User interacts with the UI -> React state updates -> Changes are batched/saved -> excelService.ts serializes state -> Writes to the physical .xlsx file on the user's machine.
