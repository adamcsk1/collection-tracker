UPDATE collection_items
SET rate = substr(rate, 1, length(rate) - 3)
WHERE rate GLOB '[0-9]/10'
   OR rate GLOB '[0-9].[0-9]/10'
   OR rate = '10/10'
   OR rate = '10.0/10';
