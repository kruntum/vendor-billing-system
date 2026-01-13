# 🚀 คู่มือการ Deploy ขึ้น Server ด้วย Docker Hub

เอกสารนี้จะแนะนำวิธีการนำระบบ Vendor Billing System ขึ้นสู่ Docker Hub และนำไปรันบน Server จริง

---

## 📋 1. สิ่งที่ต้องเตรียม (Prerequisites)

1.  **Docker Hub Account**: สมัครสมาชิกที่ [hub.docker.com](https://hub.docker.com/)
2.  **Docker Installed**: เครื่องคอมพิวเตอร์และ Server ต้องติดตั้ง Docker เรียบร้อยแล้ว

---

## 🛠️ 2. ขั้นตอนฝั่งเครื่องเรา (Build & Push)

ทำที่เครื่องคอมพิวเตอร์ของคุณเพื่อสร้าง Image และอัปโหลดขึ้น Cloud

### 2.1 Login เข้า Docker Hub

เปิด Terminal (PowerShell หรือ CMD) แล้วพิมพ์คำสั่ง:

```bash
docker login
```

(กรอก Username และ Password ของ Docker Hub)

### 2.2 ตั้งค่าชื่อ User (สำคัญ!)

เพื่อความง่าย ให้พิมพ์คำสั่งนี้เพื่อตั้งตัวแปร (หรือจำชื่อ user ของคุณไว้แทนที่คำว่า `YOUR_USER`)
**สำหรับ Windows PowerShell:**

```powershell
$env:DOCKER_USER = "ชื่อusernameของคุณ"
# ตัวอย่าง: $env:DOCKER_USER = "mujanDev"
```

### 2.3 Build Image

สร้าง Image สำหรับ Server และ Client:

```bash
# Build Server
docker build -t $env:DOCKER_USER/vbs-server:latest -f ./server/Dockerfile .

# Build Client
docker build -t $env:DOCKER_USER/vbs-client:latest -f ./client/Dockerfile .
```

### 2.4 Push Image (อัปโหลด)

ส่ง Image ขึ้นไปบน Docker Hub:

```bash
docker push $env:DOCKER_USER/vbs-server:latest
docker push $env:DOCKER_USER/vbs-client:latest
```

---

## ☁️ 3. ขั้นตอนฝั่ง Server (Deploy)

ไปที่เครื่อง Server ที่ต้องการใช้งาน (เช่น DigitalOcean, AWS, หรือ Local Server)

### 3.1 เตรียมไฟล์

สิ่งที่คุณต้องนำไปวางบน Server มี 2 ไฟล์คือ:

1.  `docker-compose.hub.yml` (ที่เพิ่งสร้าง)
2.  `.env` (ไฟล์ตั้งค่า Database และรหัสลับ)

### 3.2 สร้างไฟล์ .env บน Server

```bash
# ตัวอย่างไฟล์ .env
DB_USER=postal_user
DB_PASSWORD=postal_password
DB_NAME=postal_db
JWT_SECRET=secret_random_string
DOCKER_USER=ชื่อusernameของคุณ  <-- เพิ่มบรรทัดนี้
```

### 3.3 รันระบบ (Start)

ใช้คำสั่งนี้เพื่อดึง Image และเริ่มทำงาน:

```bash
# ดึง Image ล่าสุดมา
docker-compose -f docker-compose.hub.yml pull

# เริ่มรันระบบ (-d เพื่อให้รันเบื้องหลัง)
docker-compose -f docker-compose.hub.yml up -d
```

---

## ✅ 4. ตรวจสอบสถานะ

เช็คว่าทุกอย่างทำงานปกติ:

```bash
docker-compose -f docker-compose.hub.yml ps
```

---

## 🔄 5. วิธีอัปเดตระบบ (เมื่อแก้โค้ด)

เมื่อคุณแก้ไขโค้ดและต้องการอัปเดต Server ให้ทำดังนี้:

1.  **ที่เครื่องเรา**:
    - Build ใหม่: `docker build ...`
    - Push ใหม่: `docker push ...`
2.  **ที่ Server**:
    - Pull ใหม่: `docker-compose -f docker-compose.hub.yml pull`
    - Restart: `docker-compose -f docker-compose.hub.yml up -d` (Docker จะเปลี่ยนเฉพาะ Container ที่มีการอัปเดต)
