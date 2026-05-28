-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "mediaId" TEXT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
