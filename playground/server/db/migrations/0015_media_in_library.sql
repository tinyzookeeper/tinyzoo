ALTER TABLE "cms_media" ADD COLUMN "in_library" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Files already uploaded stay where they are: from now on only files uploaded straight
-- into a field are cleaned up when nothing uses them.
UPDATE "cms_media" SET "in_library" = true;