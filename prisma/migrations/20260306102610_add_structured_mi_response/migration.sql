-- AlterTable
ALTER TABLE "Message" ADD COLUMN "followUpQuestion" TEXT;
ALTER TABLE "Message" ADD COLUMN "progressStage" TEXT;
ALTER TABLE "Message" ADD COLUMN "summaryReadinessScore" INTEGER;
ALTER TABLE "Message" ADD COLUMN "symbolicMarker" TEXT;
