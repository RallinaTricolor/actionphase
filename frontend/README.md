# ActionPhase Modern Frontend

A modern React frontend built with TypeScript, Tailwind CSS, and React Query to work with the ActionPhase Go backend.

## Features

- ✅ JWT authentication with automatic token refresh
- ✅ User registration and login
- ✅ Protected routes
- ✅ API health monitoring
- ✅ Modern UI with Tailwind CSS
- ✅ TypeScript for type safety
- ✅ React Query for efficient API state management

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Go backend server:
   ```bash
   # In the project root
   just db_up    # Start PostgreSQL
   just run      # Start Go server on port 3000
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```

4. Open your browser to http://localhost:5173

## API Integration

The frontend integrates with these Go backend endpoints:

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/refresh` - Refresh JWT token (protected)
- `GET /ping` - Health check

## Architecture

- **React Router** for client-side routing
- **React Query** for server state management
- **Axios** for HTTP requests with automatic token refresh
- **Tailwind CSS** for styling
- **TypeScript** for type safety

## Development

The Vite development server is configured to proxy API requests to the Go backend running on port 3000.

### Project Structure

```
src/
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and API client
├── pages/              # Page components
└── types/              # TypeScript type definitions
```
