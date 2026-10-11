-- CreateTable
CREATE TABLE IF NOT EXISTS "attachments" (
    "id" UUID NOT NULL,
    "feedback_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attachments_object_key_key" ON "attachments"("object_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attachments_feedback_id_idx" ON "attachments"("feedback_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attachments_feedback_id_fkey'
    ) THEN
        ALTER TABLE "attachments" ADD CONSTRAINT "attachments_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
