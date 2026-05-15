ALTER TABLE collection_items ADD COLUMN user_rate REAL CHECK (user_rate IS NULL OR (user_rate >= 0 AND user_rate <= 10 AND ROUND(user_rate * 10) = user_rate * 10));
