# Directory Structure

`
/
├── components/          # React components (modals, UI elements, views)
│   ├── ServiceGrid.tsx  # Grid view for activities
│   ├── ResourceTimeline.tsx # Timeline view for technicians and activities
│   └── ...
├── App.tsx              # Main application entry point and state container
├── types.ts             # Global TypeScript interfaces and enums
├── utils.ts             # Helper functions and business logic
├── excelService.ts      # Data persistence logic using File System API and xlsx
├── authService.ts       # Authentication and RBAC logic
├── constants.ts         # Global constants
├── index.css            # Tailwind directives and global styles
├── index.html           # HTML entry point
├── vite.config.ts       # Vite bundler configuration
└── package.json         # Project dependencies
`

## Key Files
- App.tsx: Manages the global state (current user, data loading, view toggling).
- excelService.ts: The most critical infrastructure file, acting as the bridge to the Excel database.
