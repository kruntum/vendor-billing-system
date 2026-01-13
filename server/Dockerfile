# ----------------------------------------------------
# Stage 1: The Builder Stage
# ใช้ Bun เป็น Base Image
# ----------------------------------------------------
FROM oven/bun:latest AS builder

# ตั้งค่า Working Directory
WORKDIR /app

# Copy package files
COPY server/package.json server/bun.lockb* ./

# 🔥 CRITICAL 1: Copy Prisma files และ config
COPY server/prisma ./prisma/
COPY server/prisma.config.ts ./
# ลบการ COPY server/.env ออกไป เพราะไม่ควรอยู่ใน Builder/Runner stage
# และค่า DATABASE_URL จะถูกส่งผ่าน docker-compose.yml ใน Runtime

# Install dependencies (รวมถึง Prisma CLI)
RUN bun install --frozen-lockfile

# Copy source code and config
COPY server/src ./src/
COPY server/tsconfig.json ./

# 2. Generate Prisma Client (ใช้ --bun เพื่อความเข้ากันได้ดีกับ Bun)
# การ generate client เป็นการทำงานแบบ Offline (ไม่ต้องการ DB connection) แต่ Prisma Config ต้องการ DATABASE_URL
# 🔥 FIX: Bypass check ด้วยการใส่ Dummy URL ในบรรทัดนี้เลย (ชัวร์ที่สุด)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bunx --bun prisma generate

# 🔥 CRITICAL 2: Deploy Migrations
# ลบคำสั่งนี้ออกไป! การ migrate deploy ต้องทำใน Run Time เท่านั้น
# เนื่องจาก DB service (db:5432) ยังไม่พร้อมใช้งานใน Build Time
# (ย้ายคำสั่งนี้ไปที่ docker-compose.yml)

# ----------------------------------------------------
# Stage 2: The Runner Stage (Production)
# ----------------------------------------------------
FROM oven/bun:latest AS runner

# ตั้งค่า Working Directory
WORKDIR /app

# Copy dependencies และ generated files จาก Builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma/ ./prisma/

# 🔥 CRITICAL 3: Copy prisma.config.ts มาที่ Runner Stage (ยังจำเป็นสำหรับ Runtime)
COPY server/prisma.config.ts ./
# ลบการ COPY server/.env ออกไป (ค่า Environment Variables จะถูกส่งผ่าน docker-compose.yml)

# Copy source code and package files
COPY server/src ./src/
# 🔥 CRITICAL 4: Copy Prisma Generated Client จาก Builder (เพราะ server/src จาก Host อาจไม่มีไฟล์นี้)
COPY --from=builder /app/src/generated ./src/generated
COPY server/package.json ./
COPY server/fonts ./fonts/  
# สร้าง public directory (ตามโครงสร้างไฟล์ของคุณ)
RUN mkdir -p /app/public

# Expose port
EXPOSE 8801

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun run -e "fetch('http://localhost:8801/health').then(r => r.ok ? process.exit(0) : process.exit(1))" || exit 1

# Start server
# คำสั่งนี้จะถูก Override ด้วย command ใน docker-compose.yml (สำหรับ migrate deploy)
CMD ["bun", "run", "start"]