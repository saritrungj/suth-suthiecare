-- Removes result page customization. Forms that point at a removed picture
-- fall back to the level picture; the page falls back to the app text.
DROP TABLE IF EXISTS organization_result_page_settings;
DROP TABLE IF EXISTS organization_result_image_assets;
