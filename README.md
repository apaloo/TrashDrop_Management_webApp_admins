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
- Cypress for end-to-end testing

## Development Setup

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Prerequisites

- Node.js 16+
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

Runs the app in development mode.

#### `npm test`

Launches the test runner in interactive watch mode.

#### `npm run build`

Builds the app for production to the `build` folder.

#### `npm run cypress:open`

Opens the Cypress test runner for end-to-end testing.

## Project Structure

- `/src/pages`: Main feature pages
- `/src/components`: Reusable UI components
- `/src/context`: React context providers
- `/src/utils`: Utility functions including auth and Supabase client
- `/src/mock`: Mock data for development
- `/cypress`: End-to-end tests

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
