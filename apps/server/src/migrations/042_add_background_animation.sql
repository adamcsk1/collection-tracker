ALTER TABLE user_settings ADD COLUMN background_animation INTEGER CHECK (background_animation IN (0, 1));
