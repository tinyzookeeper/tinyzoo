-- Table and constraint names become snake_case. Pure renames: no row is touched.
ALTER TABLE "formSettings" RENAME TO "form_settings";--> statement-breakpoint
ALTER TABLE "siteSettings" RENAME TO "site_settings";--> statement-breakpoint
ALTER TABLE "siteSettings_locales" RENAME TO "site_settings_locales";--> statement-breakpoint
ALTER TABLE "form_settings" RENAME CONSTRAINT "formSettings_pkey" TO "form_settings_pkey";--> statement-breakpoint
ALTER TABLE "site_settings" RENAME CONSTRAINT "siteSettings_pkey" TO "site_settings_pkey";--> statement-breakpoint
ALTER TABLE "site_settings" RENAME CONSTRAINT "siteSettings_og_image_id_cms_media_id_fk" TO "site_settings_og_image_id_cms_media_id_fk";--> statement-breakpoint
ALTER TABLE "site_settings_locales" RENAME CONSTRAINT "siteSettings_locales_pkey" TO "site_settings_locales_pkey";--> statement-breakpoint
ALTER TABLE "site_settings_locales" RENAME CONSTRAINT "siteSettings_locales_parent_id_siteSettings_id_fk" TO "site_settings_locales_parent_id_site_settings_id_fk";--> statement-breakpoint
ALTER INDEX "siteSettings_locales_parent_locale_unique" RENAME TO "site_settings_locales_parent_locale_unique";
