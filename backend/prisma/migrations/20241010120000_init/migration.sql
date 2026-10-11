-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('UI_UX', 'PERFORMANCE', 'BUG', 'FEATURE_REQUEST', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NEW', 'REVIEWING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "user_name" TEXT,
    "user_email" TEXT,
    "source" TEXT,
    "sentiment" "Sentiment",
    "category" "Category",
    "priority" "Priority",
    "summary" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "Status" NOT NULL DEFAULT 'NEW',
    "analysis_status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysis_error" TEXT,
    "model_version" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "is_seed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");

-- CreateIndex
CREATE INDEX "feedback_sentiment_idx" ON "feedback"("sentiment");

-- CreateIndex
CREATE INDEX "feedback_category_idx" ON "feedback"("category");

-- CreateIndex
CREATE INDEX "feedback_priority_idx" ON "feedback"("priority");

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "feedback_analysis_status_idx" ON "feedback"("analysis_status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
