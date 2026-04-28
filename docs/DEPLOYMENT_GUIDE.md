# FormBuilder3: Production Deployment Guide

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Scaling Guide](#scaling-guide)

---

## Pre-Deployment Checklist

### Code Review
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] No secrets in code (API keys, passwords)
- [ ] All dependencies up to date
- [ ] Security vulnerabilities checked

### Documentation
- [ ] Architecture documented
- [ ] API documented
- [ ] Deployment procedure documented
- [ ] Runbooks created
- [ ] Troubleshooting guide updated

### Infrastructure
- [ ] Servers provisioned and secured
- [ ] Database instance created
- [ ] SSL/TLS certificates obtained
- [ ] Firewall rules configured
- [ ] Backup solution configured

### Configuration
- [ ] Environment variables prepared
- [ ] Database credentials secured
- [ ] API endpoints configured
- [ ] CORS settings finalized
- [ ] Session configuration reviewed

---

## Environment Setup

### System Requirements

**Backend Server:**
- OS: Linux (Ubuntu 20.04+ recommended)
- CPU: 2 cores minimum (4+ recommended)
- RAM: 4GB minimum (8GB+ recommended)
- Disk: 20GB SSD minimum

**Frontend Server:**
- OS: Linux (Ubuntu 20.04+ recommended)
- CPU: 2 cores minimum
- RAM: 2GB minimum (4GB+ recommended)
- Disk: 10GB SSD minimum

**Database Server:**
- OS: Linux (Ubuntu 20.04+ recommended)
- CPU: 4 cores minimum
- RAM: 8GB minimum (16GB+ for large datasets)
- Disk: 100GB SSD minimum (based on data volume)

### Install Java 21

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk

# Verify installation
java -version
```

**RHEL/CentOS:**
```bash
sudo dnf install -y java-21-openjdk-devel

# Verify installation
java -version
```

### Install Node.js 18+

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version && npm --version
```

### Install PostgreSQL 14+

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y postgresql-14 postgresql-contrib-14

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

**Create PostgreSQL user:**
```bash
sudo -u postgres psql
CREATE USER formbuilder WITH PASSWORD 'strong_password_here';
ALTER ROLE formbuilder WITH CREATEDB;
\q
```

---

## Database Setup

### Create Database and Schema

```bash
# Create database
createdb -U formbuilder formbuilder_prod

# Run schema
psql -U formbuilder -d formbuilder_prod < sql/schema.sql

# Verify tables created
psql -U formbuilder -d formbuilder_prod -c "\dt"
```

### Load Initial Data

```bash
# Seed roles and admin user
psql -U formbuilder -d formbuilder_prod < sql/seeder.sql
```

### Configure PostgreSQL for Production

Edit `/etc/postgresql/14/main/postgresql.conf`:

```ini
# Connection settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB

# Logging
log_statement = 'mod'
log_duration = on
log_min_duration_statement = 1000

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200
```

### Setup Backup Strategy

**Daily backup script:**
```bash
#!/bin/bash
# /home/backup/backup_formbuilder.sh

BACKUP_DIR="/backups/formbuilder"
DB_NAME="formbuilder_prod"
DB_USER="formbuilder"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Full backup
pg_dump -U $DB_USER $DB_NAME | \
  gzip > $BACKUP_DIR/formbuilder_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/formbuilder_$DATE.sql.gz"
```

**Schedule with cron:**
```bash
# Add to crontab
0 2 * * * /home/backup/backup_formbuilder.sh
```

---

## Backend Deployment

### Build Backend

```bash
cd formbuilder-backend1

# Clean and build
mvn clean package -DskipTests

# Output: target/formbuilder-0.0.1-SNAPSHOT.jar
ls -lh target/*.jar
```

### Create Application Properties

**Production configuration (`application-prod.properties`):**

```properties
# Server
server.port=8080
server.servlet.context-path=/api/v1
server.shutdown=graceful
server.servlet.session.timeout=15m

# Database
spring.datasource.url=jdbc:postgresql://db-server:5432/formbuilder_prod
spring.datasource.username=formbuilder
spring.datasource.password=${DB_PASSWORD}
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=20000

# JPA/Hibernate
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQL14Dialect

# Security
spring.security.user.name=admin
spring.security.user.password=${ADMIN_PASSWORD}

# Logging
logging.level.root=WARN
logging.level.com.example.formbuilder=INFO
logging.file.name=/var/log/formbuilder/application.log
logging.file.max-size=10MB
logging.file.max-history=10

# Performance
spring.task.execution.pool.core-size=5
spring.task.execution.pool.max-size=10
spring.task.execution.pool.queue-capacity=100
```

### Setup Systemd Service

**Create service file (`/etc/systemd/system/formbuilder.service`):**

```ini
[Unit]
Description=FormBuilder3 Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=formbuilder
WorkingDirectory=/opt/formbuilder
ExecStart=/usr/lib/jvm/java-21-openjdk-amd64/bin/java \
  -Dspring.profiles.active=prod \
  -Xmx2G \
  -Xms512M \
  -jar formbuilder-0.0.1-SNAPSHOT.jar

# Environment variables
EnvironmentFile=/etc/formbuilder/env.conf

# Restart policy
Restart=always
RestartSec=10
StandardOutput=append:/var/log/formbuilder/application.log
StandardError=append:/var/log/formbuilder/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Create environment file (`/etc/formbuilder/env.conf`):**

```bash
DB_PASSWORD=secure_password_here
ADMIN_PASSWORD=secure_admin_password
JAVA_OPTS="-Xmx2G -Xms512M"
```

**Set proper permissions:**

```bash
sudo chmod 600 /etc/formbuilder/env.conf
sudo chown formbuilder:formbuilder /etc/formbuilder/env.conf
```

### Deploy Backend

```bash
# Create application directory
sudo mkdir -p /opt/formbuilder
sudo chown formbuilder:formbuilder /opt/formbuilder

# Copy JAR
sudo cp target/formbuilder-0.0.1-SNAPSHOT.jar /opt/formbuilder/

# Create logs directory
sudo mkdir -p /var/log/formbuilder
sudo chown formbuilder:formbuilder /var/log/formbuilder

# Start service
sudo systemctl daemon-reload
sudo systemctl start formbuilder
sudo systemctl enable formbuilder

# Verify
sudo systemctl status formbuilder
sudo tail -f /var/log/formbuilder/application.log
```

### Setup Reverse Proxy (Nginx)

**Nginx configuration (`/etc/nginx/sites-available/formbuilder`):**

```nginx
upstream formbuilder_backend {
    server localhost:8080;
}

server {
    listen 80;
    server_name api.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    
    # Logging
    access_log /var/log/nginx/formbuilder_access.log;
    error_log /var/log/nginx/formbuilder_error.log;
    
    # Proxy settings
    location / {
        proxy_pass http://formbuilder_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/formbuilder \
           /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Frontend Deployment

### Build Frontend

```bash
cd formbuilder-frontend1

# Install dependencies
npm install --production

# Build Next.js
npm run build

# Verify build
ls -la .next/
```

### Create Environment Configuration

**Production environment (`.env.production`):**

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=FormBuilder3
NODE_ENV=production
```

### Setup Systemd Service

**Create service file (`/etc/systemd/system/formbuilder-frontend.service`):**

```ini
[Unit]
Description=FormBuilder3 Frontend
After=network.target

[Service]
Type=simple
User=formbuilder
WorkingDirectory=/opt/formbuilder-frontend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/formbuilder/frontend.log
StandardError=append:/var/log/formbuilder/frontend-error.log

[Install]
WantedBy=multi-user.target
```

### Deploy Frontend

```bash
# Create directory
sudo mkdir -p /opt/formbuilder-frontend
sudo chown formbuilder:formbuilder /opt/formbuilder-frontend

# Copy built files
sudo cp -r .next /opt/formbuilder-frontend/
sudo cp -r public /opt/formbuilder-frontend/
sudo cp package.json package-lock.json /opt/formbuilder-frontend/
sudo cp .env.production /opt/formbuilder-frontend/

# Install production dependencies
cd /opt/formbuilder-frontend
npm install --production

# Start service
sudo systemctl daemon-reload
sudo systemctl start formbuilder-frontend
sudo systemctl enable formbuilder-frontend
```

### Setup Nginx for Frontend

**Nginx configuration (`/etc/nginx/sites-available/formbuilder-frontend`):**

```nginx
upstream formbuilder_frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name app.example.com;
    
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;
    
    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    
    # Caching for static files
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location ~ ^/(favicon.ico|robots.txt) {
        expires 1y;
    }
    
    # Proxy to Next.js
    location / {
        proxy_pass http://formbuilder_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Post-Deployment Verification

### Health Checks

**Backend health:**
```bash
curl -X GET https://api.example.com/auth/me \
  -H "Content-Type: application/json"
```

**Frontend health:**
```bash
curl -s https://app.example.com | grep -o "<title>.*</title>"
```

### Smoke Tests

**Login test:**
```bash
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Verify session
curl -b cookies.txt https://api.example.com/auth/me
```

**Create form test:**
```bash
curl -X POST https://api.example.com/forms \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"code":"test_form","name":"Test Form"}'
```

### Monitoring Setup

**Install monitoring tools:**
```bash
# Prometheus (metrics collection)
sudo apt-get install -y prometheus

# Grafana (visualization)
sudo apt-get install -y grafana-server
```

**Configure application for metrics:**

Add to `application-prod.properties`:
```properties
management.endpoints.web.exposure.include=health,metrics,prometheus
management.metrics.export.prometheus.enabled=true
```

---

## Monitoring & Maintenance

### Log Management

**Configure log rotation (`/etc/logrotate.d/formbuilder`):**

```
/var/log/formbuilder/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 formbuilder formbuilder
}
```

### Performance Tuning

**Database:**
- Monitor query performance
- Create indexes on frequently queried columns
- Archive old audit logs

**Backend:**
- Monitor memory usage (adjust Xmx as needed)
- Monitor thread usage
- Review slow logs

**Frontend:**
- Monitor build size
- Check Core Web Vitals
- Optimize images

### Security Updates

**Schedule monthly updates:**
```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Java dependencies
cd /opt/formbuilder
mvn clean package

# Restart services
sudo systemctl restart formbuilder
```

---

## Troubleshooting

### Backend Issues

**Service won't start:**
```bash
sudo journalctl -u formbuilder -n 50
```

**Database connection error:**
```bash
# Verify credentials
psql -U formbuilder -d formbuilder_prod -c "SELECT version();"
```

**High memory usage:**
```bash
# Check Java process
ps aux | grep java
jps -lv
```

### Frontend Issues

**Build failures:**
```bash
npm run build --verbose
```

**Connection timeouts:**
```bash
# Check backend is running
curl http://localhost:8080/auth/me
```

### Database Issues

**Slow queries:**
```sql
-- Enable query logging
SET log_min_duration_statement = 1000;

-- Check slow query log
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

**Connection pool exhaustion:**
```bash
# Check connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Scaling Guide

### Horizontal Scaling

**Multiple backend instances:**
1. Deploy multiple instances
2. Use load balancer (Nginx, AWS ELB)
3. Ensure stateless design (sessions not stored in process)
4. Use shared database (PostgreSQL)

**Multiple frontend instances:**
1. Deploy multiple Next.js instances
2. Use load balancer for distribution
3. Ensure static assets cached

### Vertical Scaling

**Increase hardware resources:**
- Backend: CPU, RAM, Disk
- Database: CPU, RAM, Disk (SSD critical)
- Frontend: RAM for Node.js process

### Database Scaling

**Read replicas:**
```bash
# Create replica for read-heavy operations
```

**Connection pooling:**
- Use PgBouncer for connection pooling
- Set appropriate pool sizes

**Archiving:**
- Archive old audit logs
- Archive old submissions (if needed)

---

*End of Deployment Guide*
