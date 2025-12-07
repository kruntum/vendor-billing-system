# Master Prompt: ระบบบริหารจัดการวางบิลผู้รับเหมาโลจิสติกส์ (High-Performance Logistics Vendor Billing System)

## 1. คำสั่งหลักและสถาปัตยกรรม (Core Instruction & Architecture)

**บทบาทของ AI Developer:** Senior Full-Stack Developer (Bun/ElysiaJS/React Expert)

**เป้าหมาย:** สร้างระบบ Monorepo ที่มีการควบคุมประเภทข้อมูลตั้งแต่ฐานข้อมูลถึงหน้าจอ (End-to-End Type Safety) เพื่อจัดการการวางบิลที่รองรับการรวมหลายรายการ (Jobs) เป็นใบวางบิลเดียว (Billing Note) โดยมีการคำนวณภาษีที่ถูกต้องตามกฎหมายไทย (VAT 7%, WHT 3%) สามารถตั้งค่าได้ว่าจะคำนวณภาษีตามราคาสุทธิหรือราคารวมภาษี และ vat/wht สามารถตั้งค่าได้เป็น % หรือเป็นเงิน หรือไม่มีภาษี แต่ต้องมีการคำนวณภาษีตามกฎหมาย

### 1.1 Tech Stack ที่ใช้ (Latest Versions)

| ส่วนประกอบ                                | เทคโนโลยีที่ใช้                   | จุดเด่น                        |
| :---------------------------------------- | :-------------------------------- | :----------------------------- |
| **Runtime/Backend**                       | **Bun** + **ElysiaJS**            | ความเร็วสูง, Type-Safe API     |
| **ORM/Database**                          | **Prisma** + **PostgreSQL**       | Type-Safe Database Interaction |
| **Frontend**                              | **React** (Vite) + **TypeScript** | ประสิทธิภาพและความยืดหยุ่น     |
| **Routing**                               | **TanStack Router**               | Type-Safe Nested Routing       |
| **Data Fetching**                         | **TanStack Query**                | State Management และ Caching   |
| **api**                                   | **axios**                         | api client                     |
| **Authentication**                        | **Elysia JWT**                    | Lightweight & Fast Auth        |
| **UI/Design**                             | **Tailwind CSS** + **Shadcn/UI**  | UI ที่เป็นมืออาชีพและรวดเร็ว   |
| **Date**                                  | **date-fns**                      | date management                |
| **Generate PDF**                          | **pdfkit**                        | generate pdf                   |
| **Generate Excel**                        | **exceljs**                       | generate excel                 |
| **Preview PDF**                           | **pdfjs-dist**                    | preview pdf                    |
| **Auto runnumber billing note or manual** | **auto runnumber billing note**   | auto runnumber billing note    |
| **Auto runnumber receipt or manual**      | **auto runnumber receipt**        | auto runnumber receipt         |

### 1.2 Type Safety Strategy (Type Sharing)

- **Database Layer:** ใช้ **Prisma Generated Types** สำหรับการจัดการข้อมูลภายใน Backend
- **API Layer (DTOs):** ใช้ **Elysia.t (TypeBox)** ในการ Validate Input/Output และสร้าง Type สำหรับ API
- **Frontend Integration:** ใช้ **Elysia Eden** หรือการแชร์ Type Definition (`export type`) จาก Backend ไปยัง Frontend เพื่อให้มั่นใจว่า Type ตรงกัน 100% (End-to-End Type Safety) โดยไม่ต้องเขียน Type ซ้ำซ้อน

---

## 2. โครงสร้างฐานข้อมูล (Prisma Schema Definition)

โปรดสร้าง **`schema.prisma`** ด้วย Models และความสัมพันธ์ดังต่อไปนี้:

```typescript
// --- Prisma Schema Definition ---

// 1. Role: กำหนดสิทธิ์การเข้าถึง
model Role {
  id    String @id @default(uuid())
  name  String @unique @db.String(10) // ENUM: 'ADMIN', 'VENDOR', 'USER'
  users User[]
}

// 2. Vendor: ข้อมูลบริษัทผู้รับเหมา
model Vendor {
  id              String         @id @default(uuid())
  company_name    String
  company_address String
  tax_id          String         @unique
  bank_account    String
  bank_name       String
  bank_branch     String
  users           User[]         // Relationship: 1 Vendor can have many Users
  jobs            Job[]          // Relationship: 1 Vendor has many Jobs
  billing_notes   BillingNote[]  // Relationship: 1 Vendor submits many Bills
  vat_config      VatConfigByVendor? // Relationship: 1 Vendor has 1 Vat Config
  receipts        Receipt[]      // Relationship: 1 Vendor has many Receipts
  services        ServiceCatalog[] // Relationship: 1 Vendor has many Service Types
  job_descriptions JobDescriptionCatalog[] // Relationship: 1 Vendor has many Job Descriptions

}

// 3. User: ผู้ใช้งานระบบ
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  password_hash   String
  role_id         String
  role            Role      @relation(fields: [role_id], references: [id])
  vendor_id       String? // FK to Vendor. This field is NULL for ADMINs or user. Required for VENDOR role.
  vendor          Vendor?   @relation(fields: [vendor_id], references: [id])
}

// 4. Job: ข้อมูลงาน/รายการสินค้าต่อ 1 เที่ยว (Header)
model Job {
  id              String       @id @default(uuid())
  vendor_id       String // FK: เจ้าของงาน
  description     String // ชื่อรายละเอียดงานหลัก (เลือกจาก JobDescriptionCatalog หรือพิมพ์เอง เช่น "ขนส่งสินค้าตู้ 20'")
  ref_invoice_no  String // เลขที่อินวอยซ์อ้างอิงจาก Vendor
  container_no    String // เบอร์ตู้คอนเทนเนอร์
  truck_plate     String // ทะเบียนรถบรรทุก
  clearance_date  DateTime // วันที่เคลียร์ตู้
  declaration_no  String // เลขที่ใบขนสินค้า
  status_job      StatusJob    @default(PENDING) // ENUM: 'PENDING', 'BILLED'
  billing_note_id String?
  billing_note    BillingNote? @relation(fields: [billing_note_id], references: [id])
  items           JobItem[]    // Relationship: 1 Job has many Items (Expenses)
}

// 4.1 JobItem: รายการค่าใช้จ่ายย่อยในแต่ละงาน
model JobItem {
  id          String   @id @default(uuid())
  job_id      String
  job         Job      @relation(fields: [job_id], references: [id])
  description String   // ชื่อค่าใช้จ่าย (เลือกจาก ServiceCatalog หรือพิมพ์เอง)
  amount      Decimal  @db.Decimal(10, 2) // จำนวนเงิน
}

// 4.2 ServiceCatalog: รายการค่าใช้จ่ายมาตรฐาน (สำหรับ Autocomplete JobItem)
model ServiceCatalog {
  id        String @id @default(uuid())
  vendor_id String
  vendor    Vendor @relation(fields: [vendor_id], references: [id])
  name      String // ชื่อค่าบริการ (เช่น "ค่ารถขนส่ง", "ค่าผ่านท่า")
  price     Decimal? @db.Decimal(10, 2) // ราคามาตรฐาน (ถ้ามี)
}

// 4.3 JobDescriptionCatalog: ชื่อรายละเอียดงานมาตรฐาน (สำหรับ Autocomplete Job Header)
model JobDescriptionCatalog {
  id        String @id @default(uuid())
  vendor_id String
  vendor    Vendor @relation(fields: [vendor_id], references: [id])
  title     String // ชื่อรายละเอียดงาน (เช่น "ขนส่งสินค้าตู้ 20'", "ขนส่งสินค้าตู้ 40'")
}

// 5. BillingNote: ข้อมูลใบวางบิล (Header)
model BillingNote {
  id              String       @id @default(uuid())
  billing_ref     String       @db.String(20) // เลขที่บิล (เช่น RUI069-2025)
  vendor_id       String
  billing_date    DateTime
  subtotal        Decimal     @db.Decimal(10, 2) // ยอดรวมก่อนภาษี (SUM(jobs.items.amount))
  vat_amount      Decimal     @db.Decimal(10, 2) // ภาษีมูลค่าเพิ่ม 7%
  wht_amount      Decimal     @db.Decimal(10, 2) // หัก ณ ที่จ่าย 3%
  net_total       Decimal     @db.Decimal(10, 2) // ยอดสุทธิที่ต้องจ่ายจริง
  status_billing_note StatusBillingNote @default(PENDING) // ENUM: 'SUBMITTED', 'APPROVED', 'PAID'
  jobs            Job[] // งานที่ถูกรวมในบิลนี้
  receipt         Receipt?
}
model VatConfigByVendor { // กำหนดค่าภาษีมูลค่าเพิ่มและหัก ณ ที่จ่ายตามบริษัท
    id              String      @id @default(uuid())
    vat_rate        Decimal     @db.Decimal(10, 2) // อัตราภาษีมูลค่าเพิ่ม
    wht_rate        Decimal     @db.Decimal(10, 2) // อัตราหัก ณ ที่จ่าย
    calculateBeforeVat Boolean  @default(false) // คำนวนก่อนภาษี
    vendor_id       String      @unique
    vendor          Vendor      @relation(fields: [vendor_id], references: [id])
}

// 6. Receipt: ใบเสร็จรับเงิน (หลักฐานการรับเงิน)
model Receipt {
    id              String      @id @default(uuid())
    receipt_ref     String      @db.String(20) // เลขที่บิล (เช่น RUI069-2025)
    billing_note_id String      @unique // ใบวางบิลที่ถูกรับเงิน
    receipt_file    String // URL/Path ไปยังไฟล์ใบเสร็จ PDF/Image
    receipt_date    DateTime
    status_receipt  StatusReceipt @default(PENDING) // ENUM: 'PENDING', 'PAID'
    billing_note    BillingNote @relation(fields: [billing_note_id], references: [id])
}
enum StatusBillingNote {
    PENDING
    BILLED
    SUBMITTED
    APPROVED
    PAID
}
enum StatusReceipt {
    PENDING
    PAID
}
enum StatusJob {
    PENDING
    BILLED
}
```

# 3. Logic ทางธุรกิจที่สำคัญ (Core Business Logic: ElysiaJS Backend)

## 3.1 Authentication & Authorization

### Login Endpoint (`POST /auth/login`):

- **Verifies credentials.**
- **Generates a JWT Token** containing `user.id`, `user.role.name`, and `user.vendor_id`.

### Middleware Protection:

- All sensitive API routes must use an **ElysiaJS JWT Middleware**.

### Vendor Data Isolation (สำคัญที่สุด):

- Vendor สามารถเข้าถึงได้เฉพาะข้อมูล (Jobs, BillingNotes) ที่มี `vendor_id` ตรงกับ `user.vendor_id` ใน Token เท่านั้น

## 3.2 Endpoint การสร้างใบวางบิล (`POST /billing`)

### Input:

- Receives an array of `job_ids: string[]`.

### Validation:

- Verify that **ALL** submitted `job_ids` belong to the authenticated `user.vendor_id`.

### Run Number:

- `BillingService` จะตรวจสอบว่ามีการส่ง `billing_ref` มาหรือไม่
- ถ้าไม่ ให้ **Generate billing_ref อัตโนมัติ**

### Calculation Logic (Flexible & Precise):

1. ดึงค่า `vat_rate`, `wht_rate`, และ `calculateBeforeVat` จากตาราง `VatConfigByVendor`
2. `subtotal = SUM(jobs.items.amount)` (รวมยอดจากทุก JobItem ในทุก Job ที่เลือก)
3. คำนวณ VAT/WHT Amount โดยอิงตามกฎ `calculateBeforeVat`
4. `net_total = (subtotal + vat_amount) - wht_amount`

### Database Transaction (Atomic):

1. **Create** a new `BillingNote` record.
2. **Update** all selected `Job` records:
   - set `status_job = BILLED`
   - เชื่อมโยง `job.billing_note_id` ไปยัง Bill ID ที่สร้างขึ้น

## 3.3 การจัดการเอกสาร (PDF & Excel)

### PDF Generation:

- `pdfkit` บน Backend ต้องสร้างเอกสาร PDF (Billing Note) ที่สมบูรณ์แบบตาม Layout ของเอกสารไทย (แสดง Container No., Truck Plate, สรุปยอดภาษี)

### Excel Export:

- Endpoint สำหรับ Export ข้อมูล Jobs/BillingNotes ไปยัง Excel โดยใช้ `exceljs`

## 3.4 Catalog Management (CRUD)

### Endpoints (`/catalogs/services` & `/catalogs/job-descriptions`):

- **GET:** List all items (filter by `vendor_id`).
- **POST:** Create new item.
- **PUT/DELETE:** Update or Remove item.
- **Validation:** Ensure user can only manage items belonging to their `vendor_id`.

# 4. โครงสร้างโฟลเดอร์ (Monorepo File Structure)

โครงสร้าง Monorepo หลัก

```
/vendor-billing-system
├── /client           # Frontend (React/Vite)
├── /server           # Backend (Bun/ElysiaJS/Prisma)
├── docker-compose.yml# Docker Setup (DB + Server)
├── .env              # Environment Variables
└── .gitignore
```

โปรดจัดโครงสร้างโค้ดให้เป็นมาตรฐานดังนี้:

## 4.1 โครงสร้าง Backend (`/server`)

Backend ใช้ **Layered Architecture** (Routes -> Services -> DB)

```
/server
├── /prisma
│   └── schema.prisma           # ฐานข้อมูลทั้งหมด
├── /src
│   ├── /db                     # PrismaClient Initialization
│   ├── /plugins                # Elysia Middleware (Auth.js, JWT)
│   ├── /routes                 # Layer 1: กำหนด Endpoint (auth.route.ts, billing.route.ts, catalog.route.ts)
│   ├── /services               # Layer 2: Business Logic และการคำนวณ (BillingService.ts, PdfService.ts, CatalogService.ts)
│   └── index.ts                # Main ElysiaJS Application
├── package.json
└── Dockerfile                  # สำหรับ Build Image Backend
```

## 4.2 โครงสร้าง Frontend (`/client`)

Frontend ใช้ **Feature-Based Structure** และ **TanStack Router**

```
/client
├── /src
│   ├── /lib                    # Configs, Utils (Shadcn/UI components, Axios client)
│   ├── /context                # Global State (AuthContext, User Context)
│   ├── /components             # Reusable UI Components ทั่วไป
│   ├── /features               # Logic ธุรกิจแบ่งตามฟังก์ชัน
│   │   ├── /auth               # Login/Logout Component
│   │   ├── /billing            # การสร้าง/ดูใบวางบิล (Core feature)
│   │   ├── /job-management     # การจัดการงาน (Job List, Create Job with Items)
│   │   ├── /catalogs           # การจัดการ Service Catalog และ Job Description Catalog
│   │   └── /settings           # การตั้งค่า Vat/WHT และ Run Number
│   ├── /routes                 # TanStack Router: /admin/*, /vendor/*
│   └── main.tsx                # Entry point (ตั้งค่า TanStack Query และ Router)
├── package.json
└── Dockerfile                  # สำหรับ Build Image Frontend
```

## 5. Deployment & Configuration Files

5.1 Docker Compose (`/docker-compose.yml`)

```
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5532:5432"

  server:
    build:
      context: .
      dockerfile: ./server/Dockerfile
    ports:
      - "8801:8801"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5532/${DB_NAME}
      PORT: 8801
    depends_on:
      - db
    command: sh -c "npx prisma migrate deploy && bun run start:server"

  client:
    build:
      context: .
      dockerfile: ./client/Dockerfile
    ports:
      - "8802:80" # Host:8802 -> Container:80 (Nginx default)
    environment:
      VITE_API_URL: http://server:8801 # ชี้ไปที่ Backend Service ภายใน Docker network
    depends_on:
      - server

volumes:
  postgres_data:
```

5.2 Dockerfile สำหรับ Backend (`/server/Dockerfile`)

```
# Stage 1: Build & Install dependencies
FROM oven/bun:canary-slim AS base

WORKDIR /app

# Copy project files and lock files
COPY package.json bun.lockb ./
COPY server/package.json server/bun.lockb ./server/
COPY server/prisma ./server/prisma

# Install dependencies for server only
RUN bun install --production

# Stage 2: Production Stage
FROM base AS final

WORKDIR /app

# Copy source code and static assets
COPY server/src ./server/src
COPY .env ./

# Environment variables
ENV NODE_ENV=production
ENV PORT=8801

EXPOSE 8801

# Start the application
CMD ["bun", "run", "start:server"]
```

5.3 Dockerfile สำหรับ Frontend (`/client/Dockerfile`)

```
# Stage 1: Build Frontend using Bun
FROM oven/bun:canary-slim AS builder

WORKDIR /app/client

# Copy package files
COPY package.json bun.lockb ../
COPY client/package.json client/bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code and build config
COPY client/src ./src
COPY client/index.html ./
COPY client/tsconfig.json ./
COPY client/vite.config.ts ./

# Build the React project (Vite default command)
RUN bun run build

# Stage 2: Serve using Nginx
FROM nginx:alpine AS final

# Copy custom Nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from builder stage to Nginx public directory
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

# Nginx starts automatically
CMD ["nginx", "-g", "daemon off;"]
```

5.4 Nginx Configuration (`/client/nginx.conf`)

```
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to the backend service (crucial for local testing)
    location /api/ {
        # Note: 'server' is the service name in docker-compose.yml
        proxy_pass http://server:8801/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

5.5 .gitignore (`/.gitignore`)

```
# Dependencies
/node_modules
/client/node_modules
/server/node_modules

# Build artifacts
/client/dist
/server/dist
/server/tmp

# Environment variables
.env
.env.local

# Database
/server/prisma/dev.db
*.sqlite
/prisma/migrations/*.sql
/prisma/migrations/*.db
/prisma/migrations/*.ts
```

5.6 .dockerignore (`/.dockerignore`)

```
# Ignore everything not explicitly needed for the monorepo build
**/*

# Explicitly include necessary files for server build
!server/src
!server/package.json
!server/bun.lockb
!server/prisma
!server/Dockerfile
!bun.lockb
!package.json
!.env

# Explicitly include necessary files for client build
!client/src
!client/package.json
!client/bun.lockb
!client/index.html
!client/tsconfig.json
!client/vite.config.ts
!client/Dockerfile
!client/nginx.conf

# Ignore node modules from local dev
node_modules
.git
.gitignore
```

## 6. Database Seeding (Mock Data)

โปรดสร้างไฟล์ **`prisma/seed.ts`** เพื่อลงข้อมูลตัวอย่างสำหรับการทดสอบระบบ โดยมีข้อมูลดังนี้:

### 6.1 Roles

- `ADMIN`: ผู้ดูแลระบบ
- `VENDOR`: ผู้รับเหมา
- `USER`: พนักงานทั่วไป

### 6.2 Users & Vendors

1.  **Admin User:**

    - Email: `admin@system.com`
    - Password: `password123` (Hash ก่อนบันทึก)
    - Role: `ADMIN`

2.  **Vendor Company:**

    - Name: "Logistics Pro Co., Ltd."
    - Tax ID: "1234567890123"
    - Address: "123 Bangna-Trad Rd, Bangkok"
    - Bank: "KBANK", Account: "123-4-56789-0"

3.  **Vendor User:**

    - Email: `vendor@logistics.com`
    - Password: `password123`
    - Role: `VENDOR`
    - Vendor: เชื่อมโยงกับ "Logistics Pro Co., Ltd."

4.  **Vat Config (สำหรับ Vendor นี้):**
    - server

volumes:
postgres_data:

```

5.2 Dockerfile สำหรับ Backend (`/server/Dockerfile`)

```

# Stage 1: Build & Install dependencies

FROM oven/bun:canary-slim AS base

WORKDIR /app

# Copy project files and lock files

COPY package.json bun.lockb ./
COPY server/package.json server/bun.lockb ./server/
COPY server/prisma ./server/prisma

# Install dependencies for server only

RUN bun install --production

# Stage 2: Production Stage

FROM base AS final

WORKDIR /app

# Copy source code and static assets

COPY server/src ./server/src
COPY .env ./

# Environment variables

ENV NODE_ENV=production
ENV PORT=8801

EXPOSE 8801

# Start the application

CMD ["bun", "run", "start:server"]

```

5.3 Dockerfile สำหรับ Frontend (`/client/Dockerfile`)

```

# Stage 1: Build Frontend using Bun

FROM oven/bun:canary-slim AS builder

WORKDIR /app/client

# Copy package files

COPY package.json bun.lockb ../
COPY client/package.json client/bun.lockb ./

# Install dependencies

RUN bun install

# Copy source code and build config

COPY client/src ./src
COPY client/index.html ./
COPY client/tsconfig.json ./
COPY client/vite.config.ts ./

# Build the React project (Vite default command)

RUN bun run build

# Stage 2: Serve using Nginx

FROM nginx:alpine AS final

# Copy custom Nginx configuration

COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from builder stage to Nginx public directory

COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

# Nginx starts automatically

CMD ["nginx", "-g", "daemon off;"]

```

5.4 Nginx Configuration (`/client/nginx.conf`)

```

server {
listen 80;
server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to the backend service (crucial for local testing)
    location /api/ {
        # Note: 'server' is the service name in docker-compose.yml
        proxy_pass http://server:8801/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

}

```

5.5 .gitignore (`/.gitignore`)

```

# Dependencies

/node_modules
/client/node_modules
/server/node_modules

# Build artifacts

/client/dist
/server/dist
/server/tmp

# Environment variables

.env
.env.local

# Database

/server/prisma/dev.db
_.sqlite
/prisma/migrations/_.sql
/prisma/migrations/_.db
/prisma/migrations/_.ts

```

5.6 .dockerignore (`/.dockerignore`)

```

# Ignore everything not explicitly needed for the monorepo build

\*_/_

# Explicitly include necessary files for server build

!server/src
!server/package.json
!server/bun.lockb
!server/prisma
!server/Dockerfile
!bun.lockb
!package.json
!.env

# Explicitly include necessary files for client build

!client/src
!client/package.json
!client/bun.lockb
!client/index.html
!client/tsconfig.json
!client/vite.config.ts
!client/Dockerfile
!client/nginx.conf

# Ignore node modules from local dev

node_modules
.git
.gitignore

```

## 6. Database Seeding (Mock Data)

โปรดสร้างไฟล์ **`prisma/seed.ts`** เพื่อลงข้อมูลตัวอย่างสำหรับการทดสอบระบบ โดยมีข้อมูลดังนี้:

### 6.1 Roles

- `ADMIN`: ผู้ดูแลระบบ
- `VENDOR`: ผู้รับเหมา
- `USER`: พนักงานทั่วไป

### 6.2 Users & Vendors

1.  **Admin User:**

    - Email: `admin@system.com`
    - Password: `password123` (Hash ก่อนบันทึก)
    - Role: `ADMIN`

2.  **Vendor Company:**

    - Name: "Logistics Pro Co., Ltd."
    - Tax ID: "1234567890123"
    - Address: "123 Bangna-Trad Rd, Bangkok"
    - Bank: "KBANK", Account: "123-4-56789-0"

3.  **Vendor User:**

    - Email: `vendor@logistics.com`
    - Password: `password123`
    - Role: `VENDOR`
    - Vendor: เชื่อมโยงกับ "Logistics Pro Co., Ltd."

4.  **Vat Config (สำหรับ Vendor นี้):**
    - VAT: 7%
    - WHT: 3%
    - Calculate Before VAT: `false`

### 6.3 Sample Jobs (สำหรับ Vendor นี้)
สร้าง Job สถานะ `PENDING` จำนวน 2 รายการ (แต่ละรายการมี JobItem หลายรายการ):

1.  **Job 1:** "Transport BKK-CNX"
    -   Item 1: "ค่ารถขนส่ง" (Transport Fee) - 5000 THB
    -   Item 2: "ค่าผ่านทาง" (Toll Fee) - 500 THB

2.  **Job 2:** "Import Clearance"
    -   Item 1: "ค่าชิปปิ้ง" (Shipping Fee) - 2000 THB
    -   Item 2: "ค่าธรรมเนียมศุลกากร" (Customs Fee) - 1500 THB

### 6.4 Service Catalog (สำหรับ Vendor นี้)
สร้างรายการมาตรฐานสำหรับ Autocomplete:
- "ค่ารถขนส่ง" (Transport Fee)
- "ค่าผ่านทาง" (Toll Fee)
- "ค่าชิปปิ้ง" (Shipping Fee)
- "ค่าธรรมเนียมศุลกากร" (Customs Fee)
- "ค่าแรงงาน" (Labor Fee)

### 6.5 Job Description Catalog (สำหรับ Vendor นี้)
สร้างรายการมาตรฐานสำหรับ Autocomplete Job Header:
- "ขนส่งสินค้าตู้ 20'" (Transport 20' Container)
- "ขนส่งสินค้าตู้ 40'" (Transport 40' Container)
- "บริการเดินพิธีการศุลกากร" (Customs Clearance Service)
- "ขนส่งสินค้า LCL" (LCL Transport)
```
