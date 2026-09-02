-- The project palette: nine hues in two tones.
--
-- `placement` is the order the picker draws them in, filling row by row — so
-- 1..9 are the strong row left to right, and 10..18 the light row beneath it.
-- Column N and column N+9 are the same hue, which is what makes the grid read
-- as pairs.
--
-- `id` is TEXT with no database default: Prisma generates its uuids in the
-- client, so an insert run by hand has to supply them.
--
-- Safe to re-run. `placement` is unique, so a second run updates the hex codes
-- in place rather than failing or duplicating — which is also how to revise a
-- colour later.

INSERT INTO "Color" ("id", "placement", "hexCode")
VALUES
  (gen_random_uuid()::text,  1, '#ff5e53'),  -- Red
  (gen_random_uuid()::text,  2, '#f48b2d'),  -- Orange
  (gen_random_uuid()::text,  3, '#95593e'),  -- Brown
  (gen_random_uuid()::text,  4, '#3cb343'),  -- Green
  (gen_random_uuid()::text,  5, '#00908f'),  -- Teal
  (gen_random_uuid()::text,  6, '#0070a3'),  -- Blue
  (gen_random_uuid()::text,  7, '#605ad4'),  -- Violet
  (gen_random_uuid()::text,  8, '#c63dac'),  -- Pink
  (gen_random_uuid()::text,  9, '#86868b'),  -- Grey
  (gen_random_uuid()::text, 10, '#ffb6ab'),  -- Red light
  (gen_random_uuid()::text, 11, '#ffbe8e'),  -- Orange light
  (gen_random_uuid()::text, 12, '#ce9378'),  -- Brown light
  (gen_random_uuid()::text, 13, '#a2d99c'),  -- Green light
  (gen_random_uuid()::text, 14, '#4cd5d3'),  -- Teal light
  (gen_random_uuid()::text, 15, '#71c2fe'),  -- Blue light
  (gen_random_uuid()::text, 16, '#bfb2f7'),  -- Violet light
  (gen_random_uuid()::text, 17, '#f0a8dd'),  -- Pink light
  (gen_random_uuid()::text, 18, '#c4c3c6')   -- Grey light
ON CONFLICT ("placement") DO UPDATE
  SET "hexCode" = EXCLUDED."hexCode";
