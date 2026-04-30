# Coding Conventions

## TypeScript
- Strict typing enabled in tsconfig.json.
- All domain entities must be defined in types.ts (e.g., Service, Technician, Client).
- Use enum for restricted string values (e.g., TechType, ServiceStatus).

## React
- Functional components exclusively.
- React Hooks for state and lifecycle management.
- Modals are separated into their own components inside components/.

## Styling
- Tailwind CSS used for almost all styling.
- Utility functions like cn (clsx + tailwind-merge) are used for conditional class name merging.

## Data Mutations
- Changes to the data should be routed through excelService.ts to ensure consistency with the physical Excel file.
