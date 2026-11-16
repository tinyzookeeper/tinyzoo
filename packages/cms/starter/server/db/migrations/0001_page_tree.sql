ALTER TABLE "page" DROP CONSTRAINT "page_slug_unique";--> statement-breakpoint
DROP INDEX "page_locales_slug_unique";--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_parent_id_page_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page"("id") ON DELETE restrict ON UPDATE no action;