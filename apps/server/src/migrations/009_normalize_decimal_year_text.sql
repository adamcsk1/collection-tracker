UPDATE collection_items
SET year = SUBSTR(year, 1, 4)
WHERE year GLOB '[0-9][0-9][0-9][0-9].0';
