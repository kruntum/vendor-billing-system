# 🐳 Docker Deployment Guide

## Quick Start

### Prerequisites

- Docker
- Docker Compose
- `.env` file (copy from `.env.example`)

### Build and Run

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Services

### 🗄️ Database (PostgreSQL)

- **Container**: `vbs_postgres`
- **Port**: `5532:5432`
- **Volume**: `postgres_data`
- **Health Check**: Every 10s

### 🔧 Server (Backend API)

- **Container**: `vbs_server`
- **Port**: `8801:8801`
- **Built with**: Bun + Elysia
- **Auto-migrations**: Yes (on startup)

### 🎨 Client (Frontend)

- **Container**: `vbs_client`
- **Port**: `8802:80`
- **Built with**: React + Vite + Nginx
- **API Proxy**: `/api` → `http://server:8801`

## Access Points

- **Frontend**: http://localhost:8802
- **Backend API**: http://localhost:8801
- **Database**: localhost:5532

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_USER=vbs_admin
DB_PASSWORD=your_secure_password
DB_NAME=vendor_billing_db

# JWT
JWT_SECRET=your_jwt_secret

# Server
PORT=8801
NODE_ENV=production
```

## Commands

### Development

```bash
# Rebuild specific service
docker-compose build server
docker-compose build client

# Restart service
docker-compose restart server

# View service logs
docker-compose logs -f server
docker-compose logs -f client
```

### Database

```bash
# Run migrations
docker-compose exec server bunx prisma migrate deploy

# Seed database
docker-compose exec server bun run prisma db seed

# Access database
docker-compose exec db psql -U vbs_admin -d vendor_billing_db
```

### Maintenance

```bash
# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Client Container (Nginx + React)      │
│  Port: 8802:80                          │
│  ┌───────────────────────────────────┐ │
│  │ /        → index.html (SPA)       │ │
│  │ /api     → proxy to server:8801   │ │
│  │ /public  → proxy to server:8801   │ │
│  └───────────────────────────────────┘ │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Server Container (Bun + Elysia)       │
│  Port: 8801:8801                        │
│  ┌───────────────────────────────────┐ │
│  │ Routes: /auth, /jobs, /billing... │ │
│  │ Prisma ORM                         │ │
│  └───────────────────────────────────┘ │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Database Container (PostgreSQL 16)    │
│  Port: 5532:5432                        │
│  Volume: postgres_data                  │
└─────────────────────────────────────────┘
```

## Health Checks

All containers include health checks:

- **Database**: `pg_isready` every 10s
- **Server**: HTTP check on `/health` every 30s
- **Client**: HTTP check on `/` every 30s

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs [service_name]

# Check container status
docker-compose ps
```

### Database connection issues

```bash
# Verify database is healthy
docker-compose ps db

# Check database logs
docker-compose logs db
```

### Port already in use

```bash
# Change ports in docker-compose.yml
# Example: "8803:80" instead of "8802:80"
```

### Rebuild from scratch

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Production Notes

1. **Change default passwords** in `.env`
2. **Generate secure JWT secret**: `openssl rand -base64 64`
3. **Use environment-specific configs** for different deployments
4. **Set up backup** for `postgres_data` volume
5. **Configure reverse proxy** (Nginx/Caddy) for SSL/TLS
6. **Monitor logs** and set up log rotation

## File Structure

```
vendor-billing-system/
├── docker-compose.yml          # Service orchestration
├── .env                         # Environment variables (not in git)
├── .env.example                 # Template for .env
│
├── server/
│   ├── Dockerfile              # Server image definition
│   ├── .dockerignore           # Files to exclude from build
│   └── ...
│
└── client/
    ├── Dockerfile              # Client image definition
    ├── .dockerignore           # Files to exclude from build
    ├── nginx.conf              # Nginx configuration
    └── ...
```
