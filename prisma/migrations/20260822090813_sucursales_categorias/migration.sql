-- CreateTable
CREATE TABLE "sucursales" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "openingHours" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sucursales_businessId_idx" ON "sucursales"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "sucursales_id_businessId_key" ON "sucursales"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_name_key" ON "categorias"("name");

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
