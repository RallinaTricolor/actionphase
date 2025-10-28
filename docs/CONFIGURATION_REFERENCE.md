# Configuration Reference

**Single Source of Truth for Application Configuration**

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## Port Configuration

### Development Environment

| Service | Port | URL | Notes |
|---------|------|-----|-------|
| **Backend API** | 3000 | http://localhost:3000 | Go backend server |
| **Frontend Dev** | 5173 | http://localhost:5173 | Vite dev server |
| **PostgreSQL** | 5432 | postgres://localhost:5432 | Docker container |
| **Frontend Preview** | 4173 | http://localhost:4173 | Production build preview |

### Common Endpoints

#### Backend Health Checks
- **Ping**: `http://localhost:3000/ping` → `{"message": "pong", "status": "healthy"}`
- **Health**: `http://localhost:3000/health` → Detailed health status
- **Metrics**: `http://localhost:3000/metrics` → Prometheus metrics

#### API Base URLs
- **Development**: `http://localhost:3000/api/v1`
- **Frontend Proxy**: Vite proxies `/api` → `http://localhost:3000`

## Database Configuration

### Connection String
```
postgres://postgres:example@localhost:5432/actionphase
```

**⚠️ CRITICAL**: Database name is `actionphase`, NOT `database`

### Environment Variables
```env
DATABASE_URL=postgres://postgres:example@localhost:5432/actionphase
DB_NAME=actionphase
PGPASSWORD=example
```

## Files That Reference This Configuration

These files should link here for configuration details:
- `docs/getting-started/DEVELOPER_ONBOARDING.md`
- `.env.example`
- `frontend/vite.config.ts`
- `backend/configs/`
- Docker compose files

## How to Verify Configuration

```bash
# Check if ports are in use
lsof -i :3000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # Database

# Test backend is running
curl http://localhost:3000/ping

# Test database connection
psql postgres://postgres:example@localhost:5432/actionphase -c "SELECT version();"
```

## Common Issues

### Port Already in Use
```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9  # Backend
lsof -ti:5173 | xargs kill -9  # Frontend
```

### Database Connection Failed
- Ensure Docker is running: `docker ps`
- Check database container: `docker compose ps`
- Verify database name is `actionphase`

---

*When configuration changes, update this file and the "Last Updated" date.*
