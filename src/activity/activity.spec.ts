import { of, throwError } from 'rxjs';
import { ActivityService } from './activity.service';
import {
  channelFromUserAgent,
  normalizeClientEvent,
  serverEvent,
} from './activity.types';
import { ACTIVITY_TOPIC } from './activity.constants';

const NOW = new Date('2026-10-24T03:00:00.000Z');
const ctx = {
  mem_code: 'S001',
  channel: 'web' as const,
  source: 'ecommerce-client',
  now: NOW,
};

describe('normalizeClientEvent', () => {
  it('keeps a valid impression and takes mem_code from the token, not the body', () => {
    const e = normalizeClientEvent(
      {
        event_id: '0b5e6a50-6f1a-4c3e-9a51-6f2d1c1e9a01',
        action: 'impression',
        feature: 'company_day',
        ref: 123,
        placement: 'home_banner',
        mem_code: 'SOMEONE_ELSE',
        occurred_at: '2026-10-24T02:59:00.000Z',
        props: { tier: 'Tier 1', 'bad key': 'x', nested: { a: 1 } },
      },
      ctx,
    );
    expect(e).toMatchObject({
      v: 1,
      event_id: '0b5e6a50-6f1a-4c3e-9a51-6f2d1c1e9a01',
      mem_code: 'S001',
      actor_type: 'customer',
      channel: 'web',
      feature: 'company_day',
      ref: '123',
      action: 'impression',
      placement: 'home_banner',
      occurred_at: '2026-10-24T02:59:00.000Z',
      received_at: NOW.toISOString(),
      value: null,
      props: { tier: 'Tier 1' },
    });
  });

  it.each(['add_cart', 'order', 'remove_cart', 'hack', undefined])(
    'drops client action %s (server-only or unknown)',
    (action) => {
      expect(
        normalizeClientEvent({ action, feature: 'company_day' }, ctx),
      ).toBeNull();
    },
  );

  it.each(['', 'Company Day', '1abc', 'a'.repeat(41), null])(
    'drops invalid feature %p',
    (feature) => {
      expect(
        normalizeClientEvent({ action: 'click', feature }, ctx),
      ).toBeNull();
    },
  );

  it('replaces a client clock that is more than a day off with server time', () => {
    const e = normalizeClientEvent(
      {
        action: 'open',
        feature: 'wang_day',
        occurred_at: '2020-01-01T00:00:00Z',
      },
      ctx,
    );
    expect(e?.occurred_at).toBe(NOW.toISOString());
  });

  it('generates an event_id when the client sends none or a bad one', () => {
    const e = normalizeClientEvent(
      { action: 'open', feature: 'wang_day', event_id: 'not-a-uuid' },
      ctx,
    );
    expect(e?.event_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('channelFromUserAgent', () => {
  it('maps Flutter to app and browsers to web', () => {
    expect(channelFromUserAgent('Dart/3.4 (dart:io)')).toBe('app');
    expect(
      channelFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'),
    ).toBe('web');
    expect(channelFromUserAgent(undefined)).toBe('unknown');
    expect(channelFromUserAgent('curl/8.0')).toBe('unknown');
  });
});

describe('serverEvent', () => {
  it('marks events with an emp_code as done by sales', () => {
    expect(
      serverEvent({
        feature: 'company_day',
        action: 'order',
        mem_code: 'S1',
        emp_code: '0180',
      }).actor_type,
    ).toBe('sales');
  });
});

describe('ActivityService', () => {
  const make = (opts: { flag?: boolean; kafka?: boolean } = {}) => {
    const kafka = { emit: jest.fn().mockReturnValue(of(undefined)) };
    const flags = { getFlag: jest.fn().mockResolvedValue(opts.flag ?? true) };
    const db = {
      query: jest.fn().mockResolvedValue([
        { promo_id: 10, creditor_code: 'CR01' },
        { promo_id: 20, creditor_code: null },
      ]),
    };
    const service = new ActivityService(
      (opts.kafka === false ? null : kafka) as never,
      flags as never,
      db as never,
    );
    return { service, kafka, flags, db };
  };

  it('does not emit when the flag is off', async () => {
    const { service, kafka } = make({ flag: false });
    const sent = await service.emit([
      serverEvent({ feature: 'x', action: 'open', mem_code: 'S1' }),
    ]);
    expect(sent).toBe(0);
    expect(kafka.emit).not.toHaveBeenCalled();
  });

  it('is disabled without a broker even if the flag is on', async () => {
    const { service, flags } = make({ kafka: false });
    expect(await service.isEnabled()).toBe(false);
    expect(flags.getFlag).not.toHaveBeenCalled();
  });

  it('emits JSON keyed by mem_code to activity_event and counts failures out', async () => {
    const { service, kafka } = make();
    kafka.emit
      .mockReturnValueOnce(of(undefined))
      .mockReturnValueOnce(throwError(() => new Error('broker down')));
    const a = serverEvent({ feature: 'x', action: 'open', mem_code: 'S1' });
    const b = serverEvent({ feature: 'x', action: 'open', mem_code: 'S2' });
    expect(await service.emit([a, b])).toBe(1);
    expect(kafka.emit).toHaveBeenCalledWith(ACTIVITY_TOPIC, {
      key: 'S1',
      value: JSON.stringify(a),
    });
  });

  it('caches the flag for 30s', async () => {
    const { service, flags } = make();
    await service.isEnabled();
    await service.isEnabled();
    expect(flags.getFlag).toHaveBeenCalledTimes(1);
  });

  it('builds one order event per order × promo with baht from non-reward lines', async () => {
    const { service } = make();
    const events = await service.orderEvents(
      [
        {
          soh_running: '005-000001',
          promotion_id: 10,
          tier_id: 2,
          is_reward: 0,
          is_happy_hour: 0,
          spo_total_decimal: '1000.50',
        },
        {
          soh_running: '005-000001',
          promotion_id: 10,
          tier_id: 2,
          is_reward: 0,
          is_happy_hour: 1,
          spo_total_decimal: '500',
        },
        {
          soh_running: '005-000001',
          promotion_id: 10,
          tier_id: 2,
          is_reward: 1,
          is_happy_hour: 0,
          spo_total_decimal: '0',
        },
        {
          soh_running: '005-000002',
          promotion_id: 20,
          tier_id: null,
          is_reward: 0,
          is_happy_hour: 0,
          spo_total_decimal: 300,
        },
        {
          soh_running: '005-000002',
          promotion_id: 99,
          tier_id: null,
          is_reward: 0,
          is_happy_hour: 0,
          spo_total_decimal: 300,
        },
      ],
      { mem_code: 'S1', emp_code: ' 0180 ', channel: 'web' },
      NOW,
    );
    const byKey = Object.fromEntries(
      events.map((e) => [`${e.doc_no}|${e.feature}|${e.ref}`, e]),
    );
    expect(Object.keys(byKey).sort()).toEqual([
      '005-000001|company_day|10',
      '005-000001|happy_hour|null',
      '005-000002|wang_day|20',
    ]);
    expect(byKey['005-000001|company_day|10']).toMatchObject({
      action: 'order',
      value: 1500.5,
      qty: 2,
      emp_code: '0180',
      actor_type: 'sales',
      channel: 'web',
      props: { reward_lines: 1, tier_ids: '2' },
    });
    expect(byKey['005-000001|happy_hour|null'].value).toBe(500);
    expect(byKey['005-000002|wang_day|20'].value).toBe(300);
  });

  it('gives a gift-only promo on an order no baht (null), not 0', async () => {
    const { service } = make();
    const [e] = await service.orderEvents(
      [
        {
          soh_running: '005-000003',
          promotion_id: 20,
          tier_id: 5,
          is_reward: 1,
          is_happy_hour: 0,
          spo_total_decimal: '0',
        },
      ],
      { mem_code: 'S1', channel: 'app' },
      NOW,
    );
    expect(e).toMatchObject({
      feature: 'wang_day',
      value: null,
      qty: 0,
      actor_type: 'customer',
      props: { gift_only: true, reward_lines: 1, tier_ids: '5' },
    });
  });

  it('resolves feature "promotion" to company_day / wang_day and drops unknown promos', async () => {
    const { service } = make();
    const base = { action: 'click' as const, mem_code: 'S1' };
    const out = await service.resolvePromotionFeature([
      serverEvent({ ...base, feature: 'promotion', ref: '10' }),
      serverEvent({ ...base, feature: 'promotion', ref: '20' }),
      serverEvent({ ...base, feature: 'promotion', ref: '404' }),
      serverEvent({ ...base, feature: 'promotion', ref: 'abc' }),
      serverEvent({ ...base, feature: 'bundle_set', ref: 'X1' }),
    ]);
    expect(out.map((e) => `${e.feature}:${e.ref}`)).toEqual([
      'company_day:10',
      'wang_day:20',
      'bundle_set:X1',
    ]);
  });

  it('add_cart: one event per active promo the product counts toward, even before any tier is reached', async () => {
    const { service, kafka, db } = make();
    service.trackProductAddCart({
      mem_code: 'S1',
      pro_code: 'P1',
      qty: 6,
      placement: 'product_list',
      channel: 'web',
      reached: null,
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(String((db.query.mock.calls as unknown[][])[0][0])).toMatch(
      /promotion_condition/,
    );
    expect(((db.query.mock.calls as unknown[][])[0][1] as unknown[])[0]).toBe(
      'P1',
    );
    const sent = (kafka.emit.mock.calls as unknown[][]).map(
      (c) =>
        JSON.parse((c[1] as { value: string }).value) as Record<
          string,
          unknown
        >,
    );
    expect(
      sent.map(
        (e) => `${String(e.feature)}:${String(e.ref)}:${String(e.action)}`,
      ),
    ).toEqual(['company_day:10:add_cart', 'wang_day:20:add_cart']);
    expect(sent[0]).toMatchObject({
      pro_code: 'P1',
      qty: 6,
      placement: 'product_list',
      props: null,
    });
  });

  it('add_cart: tags the promo whose tier the cart reached', async () => {
    const { service, kafka } = make();
    service.trackProductAddCart({
      mem_code: 'S1',
      pro_code: 'P1',
      qty: 30,
      placement: 'product_list',
      reached: { promo_id: 10, tier: 'ขั้น 1' },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const sent = (kafka.emit.mock.calls as unknown[][]).map(
      (c) =>
        JSON.parse((c[1] as { value: string }).value) as {
          ref: string;
          props: unknown;
        },
    );
    expect(sent.find((e) => e.ref === '10')?.props).toEqual({
      reached_tier: 'ขั้น 1',
    });
    expect(sent.find((e) => e.ref === '20')?.props).toBeNull();
  });

  it('add_cart: products in no active promo send nothing; lookups are cached per product', async () => {
    const { service, kafka, db } = make();
    db.query.mockResolvedValue([]);
    const now = new Date('2026-10-24T03:00:00Z');
    expect(await service.activePromosForProduct('X', now)).toEqual([]);
    await service.activePromosForProduct('X', new Date(now.getTime() + 30_000));
    expect(db.query).toHaveBeenCalledTimes(1);
    await service.activePromosForProduct('X', new Date(now.getTime() + 61_000));
    expect(db.query).toHaveBeenCalledTimes(2);
    service.trackProductAddCart({
      mem_code: 'S1',
      pro_code: 'X',
      qty: 1,
      placement: null,
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(kafka.emit).not.toHaveBeenCalled();
  });
});
