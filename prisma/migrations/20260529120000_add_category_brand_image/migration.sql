-- AlterTable
ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "mediaId" TEXT;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "mediaId" TEXT;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
