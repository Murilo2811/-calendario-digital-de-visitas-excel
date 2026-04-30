# Testing

## Current State
- Currently, there is **no automated testing framework** configured (no Jest, Vitest, Cypress, or Playwright in package.json).

## Recommendations
- **Unit Testing**: Introduce Vitest for testing pure functions in utils.ts (e.g., calibration logic, date math).
- **Component Testing**: React Testing Library to test modal behaviors and grid rendering.
- **E2E Testing**: Playwright could be used, but testing the File System Access API in headless mode may present specific challenges.
