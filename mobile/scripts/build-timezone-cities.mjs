#!/usr/bin/env node
/* Builds the timezone picker's city index from GeoNames.
   Run rarely and deliberately; the output is checked in.
   Usage: node scripts/build-timezone-cities.mjs [outputPath] */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DUMP = 'https://download.geonames.org/export/dump';

/* How many of the largest cities to keep. Unrelated to the 5000 in
   `cities5000.zip`, which is a population floor, not a count — that file holds
   ~70 000 places. It is the source rather than `cities15000` because it is the
   smallest dump reaching all 371 zones; the 15 000 floor misses 15 of them. */
const LARGEST_CITIES = 5000;
const OUTPUT = resolve(process.argv[2] ?? 'src/config/timezoneCities.json');

/* GeoNames `geoname` table columns, 1-based, as documented in
   https://download.geonames.org/export/dump/readme.txt */
const ASCII_NAME = 2;
const COUNTRY_CODE = 8;
const ADMIN1_CODE = 10;
const POPULATION = 14;
const TIMEZONE = 17;

const download = async (file) => {
  const response = await fetch(`${DUMP}/${file}`);
  if (!response.ok) {
    throw new Error(`${file}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const countryNames = async () => {
  const text = (await download('countryInfo.txt')).toString('utf8');
  const names = new Map();

  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const columns = line.split('\t');
    names.set(columns[0], columns[4]);
  }

  return names;
};

const regionLabels = async () => {
  const text = (await download('admin1CodesASCII.txt')).toString('utf8');
  const labels = new Map();

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const [code, , asciiName] = line.split('\t');
    const suffix = code.split('.')[1];

    /* The US and friends code their divisions with the postal letters people
       actually recognise, so "CA" is the better label. Mexico and France
       number theirs, where "Guadalupe, 19" would say nothing and the name has
       to be spelled out instead. */
    labels.set(code, /^[A-Za-z]+$/.test(suffix) ? suffix : asciiName);
  }

  return labels;
};

const cityLines = async () => {
  const directory = mkdtempSync(join(tmpdir(), 'geonames-'));
  const archive = join(directory, 'cities5000.zip');

  try {
    writeFileSync(archive, await download('cities5000.zip'));
    return execFileSync('unzip', ['-p', archive, 'cities5000.txt'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }).split('\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

/* One lookup per zone rather than per city — there are ~420 zones and ~50 000
   cities, and constructing a formatter is the expensive part. */
const zoneLabels = (() => {
  const cache = new Map();
  const now = new Date();

  const part = (timeZone, timeZoneName) =>
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName })
      .formatToParts(now)
      .find((piece) => piece.type === 'timeZoneName').value;

  return (timeZone) => {
    if (!cache.has(timeZone)) {
      try {
        cache.set(timeZone, {
          shortOffset: part(timeZone, 'shortOffset'),
          timezoneName: part(timeZone, 'longGeneric'),
        });
      } catch {
        // A zone this runtime's ICU does not know; the cities carrying it are
        // dropped rather than shipped with a label we cannot produce.
        cache.set(timeZone, null);
      }
    }

    return cache.get(timeZone);
  };
})();

const [countries, regions, lines] = await Promise.all([
  countryNames(),
  regionLabels(),
  cityLines(),
]);

let unknownZones = 0;
const cities = [];

for (const line of lines) {
  if (line.trim() === '') continue;
  const columns = line.split('\t');
  const timezone = columns[TIMEZONE];
  if (!timezone) continue;

  const labels = zoneLabels(timezone);
  if (labels === null) {
    unknownZones += 1;
    continue;
  }

  cities.push({
    city: columns[ASCII_NAME],
    region: regions.get(`${columns[COUNTRY_CODE]}.${columns[ADMIN1_CODE]}`),
    country: countries.get(columns[COUNTRY_CODE]) ?? columns[COUNTRY_CODE],
    timezone,
    shortOffset: labels.shortOffset,
    timezoneName: labels.timezoneName,
    population: Number(columns[POPULATION]) || 0,
  });
}

cities.sort((a, b) => b.population - a.population);

/* A city is kept if it is big enough, or if it is the first one seen in its
   zone. The population cut alone drops 116 of the 371 zones — Reykjavik and
   Punta Arenas among them — and a zone with no city in the file cannot be
   reached by search at all. */
const covered = new Set();
const selected = [];
let backfilled = 0;

for (const city of cities) {
  const isFirstOfZone = !covered.has(city.timezone);
  covered.add(city.timezone);

  if (selected.length < LARGEST_CITIES) {
    selected.push(city);
  } else if (isFirstOfZone) {
    selected.push(city);
    backfilled += 1;
  }
}

/* Two cities can share a name and a country — there is a Glendale in both
   Arizona and California — and where they also sit in different zones their
   rows are indistinguishable in the picker. Only those get their region folded
   into the name, so every other row stays a plain city and the UI needs no
   rule at all. */
const byName = new Map();
for (const city of selected) {
  const key = `${city.city}|${city.country}`;
  byName.set(key, [...(byName.get(key) ?? []), city]);
}

const needsRegion = new Set(
  [...byName.values()]
    .filter((group) => new Set(group.map((city) => city.timezone)).size > 1)
    .flat(),
);

const json = JSON.stringify(
  selected.map((city) => ({
    city:
      needsRegion.has(city) && city.region
        ? `${city.city}, ${city.region}`
        : city.city,
    country: city.country,
    timezone: city.timezone,
    shortOffset: city.shortOffset,
    timezoneName: city.timezoneName,
  })),
);
writeFileSync(OUTPUT, `${json}\n`);

console.log(`${selected.length} cities -> ${OUTPUT}`);
console.log(`${covered.size} zones covered, ${backfilled} added below the cut`);
console.log(`${needsRegion.size} rows disambiguated by region`);
console.log(`${Math.round(Buffer.byteLength(json) / 1024)} KB raw`);
if (unknownZones > 0) console.log(`${unknownZones} cities dropped (unknown zone)`);
