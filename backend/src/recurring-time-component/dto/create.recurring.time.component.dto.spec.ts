import { RecurringTimeComponentFields } from './create.recurring.time.component.dto';

const recurring = (over: Partial<RecurringTimeComponentFields> = {}) =>
  ({
    type: 'RECURRING',
    recurringInterval: 1,
    recurringFrequency: 'WEEK',
    recurringByDay: ['TU'],
    firstRecurringEventAt: '2026-06-19T00:00',
    recurringTimeSlots: [{ type: 'ABSOLUTE', from: '09:00', to: '10:00' }],
    ...over,
  }) as RecurringTimeComponentFields;

describe('RecurringTimeComponentFields.__validate', () => {
  it('accepts a bounded cadence', () => {
    expect(
      RecurringTimeComponentFields.__validate(
        recurring({ lastRecurringEventAt: '2026-07-01T00:00' }),
      ),
    ).toBeUndefined();
  });

  it('accepts an unbounded cadence', () => {
    expect(RecurringTimeComponentFields.__validate(recurring())).toBeUndefined();
  });

  it('requires a first date', () => {
    expect(
      RecurringTimeComponentFields.__validate(
        recurring({ firstRecurringEventAt: undefined }),
      ),
    ).toMatch(/firstRecurringEventAt/);
  });

  it('rejects a last date before the first', () => {
    expect(
      RecurringTimeComponentFields.__validate(
        recurring({ lastRecurringEventAt: '2026-05-01T00:00' }),
      ),
    ).toMatch(/must not precede/);
  });

  it('accepts a single occurrence, where last equals first', () => {
    expect(
      RecurringTimeComponentFields.__validate(
        recurring({ lastRecurringEventAt: '2026-06-19T00:00' }),
      ),
    ).toBeUndefined();
  });

  it('compares moments, not strings, when the precision differs', () => {
    expect(
      RecurringTimeComponentFields.__validate(
        recurring({
          firstRecurringEventAt: '2026-06-19T00:00',
          lastRecurringEventAt: '2026-06-19T00:00:00',
        }),
      ),
    ).toBeUndefined();
  });
});
