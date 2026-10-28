-- Persist manual PH balance adjustments separately from calculated earned/used PH.
ALTER TABLE "EmployeeLeaveBalance"
ADD COLUMN "phAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0;
