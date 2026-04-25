-- DropForeignKey
ALTER TABLE "task_status_history" DROP CONSTRAINT "task_status_history_statusId_fkey";

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
