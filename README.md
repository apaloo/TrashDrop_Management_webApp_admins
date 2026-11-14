# TrashDrop Management WebApp Admin Portal

A comprehensive administration portal for the TrashDrop waste management system, built with React and Supabase.

## Project Overview

The TrashDrop Management WebApp Admin Portal allows administrators to manage various aspects of the trash collection system including:

- **Bag Management**: Create, track, and monitor trash bag batches with QR codes
- **Illegal Dumping Reports**: Track and manage cleanup of illegal dumping incidents
- **Pickup Requests**: Schedule and manage waste pickup requests
- **Collectors Management**: Monitor and assign collectors to pickup jobs
- **Logs & Alerts**: Track system activities and important notifications

## Key Features

- Complete authentication system with Supabase integration
- Multi-step onboarding flow for new admin users
- Interactive dashboard with KPIs and visualizations
- Comprehensive settings management
- Robust filtering and search capabilities across all features
- Responsive design using Tailwind CSS

## Tech Stack

- React 19
- Tailwind CSS for styling
- Supabase for backend and authentication
- React Router v6 for navigation
- Chart.js for data visualization
- Playwright for browser tests (`browser-tests/`, against a fake Supabase)

## Development Setup

Built with [Vite](https://vite.dev) (`vite.config.mjs`); it moved from Create React App in November 2026 (TD12). The code keeps Create React App's conventions: `process.env.REACT_APP_*` variables, JSX in `.js` files, output in `build/`.

Every `REACT_APP_*` variable ships to every visitor's browser. Never put a secret in one: the build refuses to run if one holds a Supabase service role or secret key, a private key, or has SECRET, SERVICE_ROLE, PRIVATE_KEY, PASSWORD or BEARER in its name (`scripts/env-guard.cjs`).

### Prerequisites

- Node.js 22 (`.nvmrc`)
- Supabase project with proper schema setup

### Environment Variables

Create a `.env` file in the project root with the following variables:

```
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_USE_DEV_AUTH=true  # Set to false for production
```

### Available Scripts

In the project directory, you can run:

#### `npm start`

Runs the app in development mode at http://localhost:3000 (Vite).

#### `npm test`

Launches Jest in watch mode (`jest.config.js`, the same set-up Create React App used). `npm run test:ci` runs every suite once, as CI does.

#### `npm run build`

Builds the app for production to the `build` folder, then pre-renders the public pages (`scripts/prerender.js`; `PRERENDER_SKIP=1` skips it). `npm run preview` serves the build.

#### `npm run test:browser`

Runs the browser tests (Playwright, `browser-tests/`) against a build made with the placeholder Supabase settings (`REACT_APP_SUPABASE_URL=https://ci-placeholder.supabase.co REACT_APP_SUPABASE_ANON_KEY=sb_publishable_ci_placeholder npx vite build`). They use a fake Supabase, never the real one; CI runs them on every pull request.

## Project Structure

- `/src/pages`: Main feature pages
- `/src/components`: Reusable UI components
- `/src/context`: React context providers
- `/src/utils`: Utility functions including auth and Supabase client
- `/browser-tests`: Browser tests (Playwright)

## Current Status

The application now uses real-time Supabase data integration throughout the core features:

- **Dashboard**: All metrics, charts, and activity feeds pull live data from Supabase
- **Navbar**: Real-time notifications and messages with unread counts and subscriptions
- **Live Map**: Dynamic collector status and location data from Supabase

Additional features like Bag Management, Illegal Dumping Reports, and Pickup Requests have their UI components fully implemented and are ready for Supabase integration following the established patterns.

## Supabase Integration

The application uses a service-based architecture for Supabase integration:

- **Service Modules**: Encapsulate Supabase queries and subscriptions (e.g., `notificationService.js`, `messageService.js`, `dashboardService.js`)
- **Real-time Subscriptions**: Components subscribe to data changes using Supabase Channels
- **Error Handling**: Consistent patterns for error handling and loading states
- **Documentation**: See `/docs/supabase-integration.md` for detailed implementation guidelines

All services follow a consistent pattern of exposing functions for fetching data, updating data, and subscribing to real-time changes.
