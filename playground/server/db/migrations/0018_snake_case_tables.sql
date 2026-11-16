-- Table, type and constraint names become snake_case. Pure renames: no row is touched.
ALTER TABLE "contactForm" RENAME TO "contact_form";--> statement-breakpoint
ALTER TABLE "formSettings" RENAME TO "form_settings";--> statement-breakpoint
ALTER TABLE "siteSettings" RENAME TO "site_settings";--> statement-breakpoint
ALTER TYPE "public"."contactForm_status" RENAME TO "contact_form_status";--> statement-breakpoint
ALTER TYPE "public"."contactForm_topic" RENAME TO "contact_form_topic";--> statement-breakpoint
ALTER TABLE "contact_form" RENAME CONSTRAINT "contactForm_pkey" TO "contact_form_pkey";--> statement-breakpoint
ALTER TABLE "form_settings" RENAME CONSTRAINT "formSettings_pkey" TO "form_settings_pkey";--> statement-breakpoint
ALTER TABLE "site_settings" RENAME CONSTRAINT "siteSettings_pkey" TO "site_settings_pkey";--> statement-breakpoint
ALTER TABLE "site_settings" RENAME CONSTRAINT "siteSettings_logo_id_cms_media_id_fk" TO "site_settings_logo_id_cms_media_id_fk";--> statement-breakpoint
ALTER TABLE "site_settings" RENAME CONSTRAINT "siteSettings_og_image_id_cms_media_id_fk" TO "site_settings_og_image_id_cms_media_id_fk";--> statement-breakpoint
ALTER TABLE "site_settings" RENAME CONSTRAINT "siteSettings_rules_id_cms_media_id_fk" TO "site_settings_rules_id_cms_media_id_fk";
