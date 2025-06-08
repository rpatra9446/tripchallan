-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'TRAILER', 'CONTAINER', 'TANKER', 'OTHER');

-- AlterEnum
ALTER TYPE "VehicleStatus" ADD VALUE 'BUSY';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "vehicleType" "VehicleType" NOT NULL DEFAULT 'TRUCK';
