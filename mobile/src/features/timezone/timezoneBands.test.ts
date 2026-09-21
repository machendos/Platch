import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { timezoneBands } from './timezoneBands';

const at = (iso: string) => Temporal.Instant.from(iso);
const day = (iso: string) => Temporal.PlainDate.from(iso);
const RANGE: [Temporal.PlainDate, Temporal.PlainDate] = [
  day('2026-01-01'),
  day('2026-01-31'),
];

const clock = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const shown = (bands: ReturnType<typeof timezoneBands>) =>
  bands.map((b) => `${b.kind} ${clock(b.start)}-${clock(b.end)} ${b.title}`);

describe('timezoneBands', () => {
  it('marks a forward change dead, from the old reading to the new', () => {
    expect(
      shown(
        timezoneBands(
          [
            {
              ianaTimezone: 'America/Los_Angeles',
              changesAt: at('2025-12-01T00:00:00Z'),
            },
            {
              ianaTimezone: 'America/New_York',
              changesAt: at('2026-01-01T12:00:00Z'),
              cityLabel: 'Miami',
            },
          ],
          RANGE,
        ),
      ),
    ).toEqual(['dead 04:00-07:00 Miami +3']);
  });

  it('marks a backward change doubled, ending on the old reading', () => {
    expect(
      shown(
        timezoneBands(
          [
            {
              ianaTimezone: 'America/New_York',
              changesAt: at('2025-12-01T00:00:00Z'),
            },
            {
              ianaTimezone: 'America/Los_Angeles',
              changesAt: at('2026-01-10T12:00:00Z'),
              cityLabel: 'Los Angeles',
            },
          ],
          RANGE,
        ),
      ),
    ).toEqual(['doubled 04:00-07:00 Los Angeles -3']);
  });

  it('keeps the minutes on a zone that is not a whole hour away', () => {
    expect(
      shown(
        timezoneBands(
          [
            {
              ianaTimezone: 'America/Los_Angeles',
              changesAt: at('2025-12-01T00:00:00Z'),
            },
            {
              ianaTimezone: 'Asia/Kathmandu',
              changesAt: at('2026-01-05T10:00:00Z'),
              cityLabel: 'Kathmandu',
            },
          ],
          RANGE,
        ),
      ),
    ).toEqual(['dead 02:00-15:45 Kathmandu +13:45']);
  });

  it('keeps a comma inside the city, which is what tells two of them apart', () => {
    const [band] = timezoneBands(
      [
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2025-12-01T00:00:00Z'),
        },
        {
          ianaTimezone: 'America/New_York',
          changesAt: at('2026-01-01T12:00:00Z'),
          cityLabel: 'Glendale, AZ',
        },
      ],
      RANGE,
    );

    expect(band.title).toBe('Glendale, AZ +3');
  });

  it('falls back to the zone name when a row carries no city', () => {
    const [band] = timezoneBands(
      [
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2025-12-01T00:00:00Z'),
        },
        {
          ianaTimezone: 'America/New_York',
          changesAt: at('2026-01-01T12:00:00Z'),
        },
      ],
      RANGE,
    );

    expect(band.title).toBe('New York +3');
  });

  it('draws nothing when the two zones read the same clock', () => {
    expect(
      timezoneBands(
        [
          {
            ianaTimezone: 'America/New_York',
            changesAt: at('2025-12-01T00:00:00Z'),
          },
          {
            ianaTimezone: 'America/Toronto',
            changesAt: at('2026-01-01T12:00:00Z'),
          },
        ],
        RANGE,
      ),
    ).toEqual([]);
  });

  it('ignores changes outside the range but keeps one that overlaps its edge', () => {
    const history = [
      {
        ianaTimezone: 'America/Los_Angeles',
        changesAt: at('2025-12-01T00:00:00Z'),
      },
      {
        ianaTimezone: 'America/New_York',
        changesAt: at('2025-06-01T12:00:00Z'),
      },
    ];

    expect(timezoneBands(history, RANGE)).toEqual([]);
  });

  it('needs two rows before anything can change', () => {
    expect(
      timezoneBands(
        [
          {
            ianaTimezone: 'America/Los_Angeles',
            changesAt: at('2025-12-01T00:00:00Z'),
          },
        ],
        RANGE,
      ),
    ).toEqual([]);
  });

  it('does not let a round trip paint two strips on the same hours', () => {
    const bands = timezoneBands(
      [
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2025-12-01T00:00:00Z'),
        },
        {
          ianaTimezone: 'Pacific/Honolulu',
          changesAt: at('2026-01-05T20:00:00Z'),
          cityLabel: 'Honolulu',
        },
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2026-01-05T21:00:00Z'),
          cityLabel: 'Los Angeles',
        },
      ],
      RANGE,
    );

    expect(shown(bands)).toEqual([
      'doubled 10:00-11:00 Honolulu -2',
      'dead 11:00-13:00 Los Angeles +2',
    ]);
  });

  it('drops a strip a later change has taken over completely', () => {
    const bands = timezoneBands(
      [
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2025-12-01T00:00:00Z'),
        },
        {
          ianaTimezone: 'America/New_York',
          changesAt: at('2026-01-05T10:00:00Z'),
          cityLabel: 'Miami',
        },
        {
          ianaTimezone: 'Pacific/Honolulu',
          changesAt: at('2026-01-05T11:00:00Z'),
          cityLabel: 'Honolulu',
        },
      ],
      RANGE,
    );

    expect(bands.every((band) => band.start < band.end)).toBe(true);
    expect(shown(bands)).toEqual(['doubled 01:00-06:00 Honolulu -5']);
  });

  it('leaves strips that do not meet alone', () => {
    const bands = timezoneBands(
      [
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2025-12-01T00:00:00Z'),
        },
        {
          ianaTimezone: 'America/New_York',
          changesAt: at('2026-01-05T12:00:00Z'),
          cityLabel: 'Miami',
        },
        {
          ianaTimezone: 'America/Los_Angeles',
          changesAt: at('2026-01-20T12:00:00Z'),
          cityLabel: 'Los Angeles',
        },
      ],
      RANGE,
    );

    expect(shown(bands)).toEqual([
      'dead 04:00-07:00 Miami +3',
      'doubled 04:00-07:00 Los Angeles -3',
    ]);
  });
});
