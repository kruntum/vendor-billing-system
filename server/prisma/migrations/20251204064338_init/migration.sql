-- CreateEnum
CREATE TYPE "StatusJob" AS ENUM ('PENDING', 'BILLED');

-- CreateEnum
CREATE TYPE "StatusBillingNote" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "StatusReceipt" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "company_address" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "bank_account" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "bank_branch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ref_invoice_no" TEXT NOT NULL,
    "container_no" TEXT NOT NULL,
    "truck_plate" TEXT NOT NULL,
    "clearance_date" TIMESTAMP(3) NOT NULL,
    "declaration_no" TEXT NOT NULL,
    "status_job" "StatusJob" NOT NULL DEFAULT 'PENDING',
    "billing_note_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_items" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalogs" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description_catalogs" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_notes" (
    "id" TEXT NOT NULL,
    "billing_ref" VARCHAR(20) NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "billing_date" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vat_amount" DECIMAL(12,2) NOT NULL,
    "wht_amount" DECIMAL(12,2) NOT NULL,
    "net_total" DECIMAL(12,2) NOT NULL,
    "status_billing_note" "StatusBillingNote" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_config_by_vendor" (
    "id" TEXT NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "wht_rate" DECIMAL(5,2) NOT NULL,
    "calculate_before_vat" BOOLEAN NOT NULL DEFAULT false,
    "vendor_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vat_config_by_vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "receipt_ref" VARCHAR(20) NOT NULL,
    "billing_note_id" TEXT NOT NULL,
    "receipt_file" TEXT,
    "receipt_date" TIMESTAMP(3) NOT NULL,
    "status_receipt" "StatusReceipt" NOT NULL DEFAULT 'PENDING',
    "vendor_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tax_id_key" ON "vendors"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "billing_notes_billing_ref_key" ON "billing_notes"("billing_ref");

-- CreateIndex
CREATE UNIQUE INDEX "vat_config_by_vendor_vendor_id_key" ON "vat_config_by_vendor"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_ref_key" ON "receipts"("receipt_ref");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_billing_note_id_key" ON "receipts"("billing_note_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_billing_note_id_fkey" FOREIGN KEY ("billing_note_id") REFERENCES "billing_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalogs" ADD CONSTRAINT "service_catalogs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description_catalogs" ADD CONSTRAINT "job_description_catalogs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_notes" ADD CONSTRAINT "billing_notes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_config_by_vendor" ADD CONSTRAINT "vat_config_by_vendor_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_billing_note_id_fkey" FOREIGN KEY ("billing_note_id") REFERENCES "billing_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
