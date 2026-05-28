-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('email', 'chat', 'whatsapp', 'telegram', 'viber');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryChannel" "DeliveryChannel" NOT NULL DEFAULT 'chat';
ALTER TABLE "Order" ADD COLUMN "deliveryContact" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "defaultDeliveryChannel" "DeliveryChannel";
ALTER TABLE "User" ADD COLUMN "deliveryWhatsapp" TEXT;
ALTER TABLE "User" ADD COLUMN "deliveryTelegram" TEXT;
ALTER TABLE "User" ADD COLUMN "deliveryViber" TEXT;
