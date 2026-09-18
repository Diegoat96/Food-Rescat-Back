-- Data migration: translate existing category names from English to Spanish.
-- Renames in place so `food_packages.categoryId` relationships are preserved.

UPDATE "categories" SET "name" = 'Panadería' WHERE "name" = 'Bakery';
UPDATE "categories" SET "name" = 'Lácteos' WHERE "name" = 'Dairy';
UPDATE "categories" SET "name" = 'Frutas y verduras' WHERE "name" = 'Fruits and vegetables';
UPDATE "categories" SET "name" = 'Comida preparada' WHERE "name" = 'Prepared food';
UPDATE "categories" SET "name" = 'Otro' WHERE "name" = 'Other';