import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { UserEntity } from '../users/users.entity';
import { CustomerDeliveryPreferenceEntity } from './customer-delivery-preference.entity';
import {
  DELIVERY_PREFERENCE_ENABLED_ROUTES,
  DELIVERY_PREFERENCE_FEATURE_FLAG,
  DELIVERY_PREFERENCE_KEYS,
  DELIVERY_PREFERENCE_OPTIONS,
  DeliveryPreferenceKey,
} from './delivery-preference.constants';

export interface CheckoutOptionsResult {
  enabled: boolean;
  options: { key: string; label: string }[];
  currentPreference: DeliveryPreferenceKey | null;
}

export interface SetPreferenceResult {
  ok: boolean;
  reason?: 'not_eligible' | 'invalid_key';
}

export interface CustomerSearchResult {
  mem_code: string;
  mem_nameSite: string;
  mem_route: string | null;
  currentPreference: string | null;
}

export interface PaginatedCustomerList {
  items: CustomerSearchResult[];
  total: number;
  page: number;
  limit: number;
}

export interface PreferenceBreakdownEntry {
  key: string;
  label: string;
  count: number;
}

export interface EligibleRouteStatsResult {
  totalEligibleCustomers: number;
  totalWithPreferenceSet: number;
  breakdown: PreferenceBreakdownEntry[];
}

@Injectable()
export class DeliveryPreferenceService {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CustomerDeliveryPreferenceEntity)
    private readonly cacheRepo: Repository<CustomerDeliveryPreferenceEntity>,
  ) {}

  isRouteEligible(memRoute?: string | null): boolean {
    return !!memRoute && DELIVERY_PREFERENCE_ENABLED_ROUTES.includes(memRoute);
  }

  async getCheckoutOptions(
    memCode: string,
    memRoute?: string | null,
  ): Promise<CheckoutOptionsResult> {
    const flagEnabled = await this.featureFlagsService.getFlag(
      DELIVERY_PREFERENCE_FEATURE_FLAG,
    );
    if (!flagEnabled || !this.isRouteEligible(memRoute)) {
      return { enabled: false, options: [], currentPreference: null };
    }

    const cached = await this.cacheRepo.findOne({
      where: { mem_code: memCode },
    });

    return {
      enabled: true,
      options: [...DELIVERY_PREFERENCE_OPTIONS],
      currentPreference:
        (cached?.preference as DeliveryPreferenceKey | undefined) ?? null,
    };
  }

  private validatePreferenceKey(
    memRoute: string | undefined | null,
    preferenceKey: string,
  ): SetPreferenceResult | null {
    if (!this.isRouteEligible(memRoute)) {
      return { ok: false, reason: 'not_eligible' };
    }
    if (
      !DELIVERY_PREFERENCE_KEYS.includes(preferenceKey as DeliveryPreferenceKey)
    ) {
      return { ok: false, reason: 'invalid_key' };
    }
    return null;
  }

  async setCustomerPreference(
    memCode: string,
    memRoute: string | undefined | null,
    preferenceKey: string,
  ): Promise<SetPreferenceResult> {
    const flagEnabled = await this.featureFlagsService.getFlag(
      DELIVERY_PREFERENCE_FEATURE_FLAG,
    );
    if (!flagEnabled) {
      return { ok: false, reason: 'not_eligible' };
    }
    const invalid = this.validatePreferenceKey(memRoute, preferenceKey);
    if (invalid) {
      return invalid;
    }
    await this.cacheRepo.upsert(
      { mem_code: memCode, preference: preferenceKey },
      ['mem_code'],
    );
    return { ok: true };
  }

  /**
   * รายชื่อลูกค้าในเส้นทางหาดใหญ่ (DELIVERY_PREFERENCE_ENABLED_ROUTES) เสมอ
   * — keyword เป็นตัวกรองเพิ่มเติม (ไม่บังคับ) ไม่ต้องค้นหาก่อนถึงจะเห็นรายชื่อ
   */
  async listEligibleCustomers(
    params: { keyword?: string; page?: number; limit?: number } = {},
  ): Promise<PaginatedCustomerList> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const trimmed = params.keyword?.trim();

    const qb = this.userRepo
      .createQueryBuilder('u')
      .select(['u.mem_code', 'u.mem_nameSite', 'u.mem_route'])
      .where('u.mem_route IN (:...routes)', {
        routes: DELIVERY_PREFERENCE_ENABLED_ROUTES,
      });

    if (trimmed) {
      qb.andWhere('(u.mem_code LIKE :kw OR u.mem_nameSite LIKE :kw)', {
        kw: `%${trimmed}%`,
      });
    }

    const [users, total] = await qb
      .orderBy('u.mem_code', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const memCodes = users.map((u) => u.mem_code);
    const cachedPreferences = memCodes.length
      ? await this.cacheRepo.find({ where: { mem_code: In(memCodes) } })
      : [];
    const preferenceByCode = new Map(
      cachedPreferences.map((p) => [p.mem_code, p.preference]),
    );

    return {
      items: users.map((u) => ({
        mem_code: u.mem_code,
        mem_nameSite: u.mem_nameSite,
        mem_route: u.mem_route ?? null,
        currentPreference: preferenceByCode.get(u.mem_code) ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Breakdown ของ preference เฉพาะลูกค้าที่อยู่ในเส้นทางหาดใหญ่ (mem_route
   * ใน DELIVERY_PREFERENCE_ENABLED_ROUTES)
   */
  async getEligibleRouteStats(): Promise<EligibleRouteStatsResult> {
    const totalEligibleCustomers = await this.userRepo.count({
      where: { mem_route: In(DELIVERY_PREFERENCE_ENABLED_ROUTES) },
    });

    const rows = await this.cacheRepo
      .createQueryBuilder('cdp')
      .innerJoin(UserEntity, 'u', 'u.mem_code = cdp.mem_code')
      .select('cdp.preference', 'preference')
      .addSelect('COUNT(*)', 'count')
      .where('u.mem_route IN (:...routes)', {
        routes: DELIVERY_PREFERENCE_ENABLED_ROUTES,
      })
      .groupBy('cdp.preference')
      .getRawMany<{ preference: string; count: string }>();

    const countByKey = new Map(
      rows.map((r) => [r.preference, Number(r.count)]),
    );
    const breakdown: PreferenceBreakdownEntry[] =
      DELIVERY_PREFERENCE_OPTIONS.map((option) => ({
        key: option.key,
        label: option.label,
        count: countByKey.get(option.key) ?? 0,
      }));
    const totalWithPreferenceSet = breakdown.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );

    return { totalEligibleCustomers, totalWithPreferenceSet, breakdown };
  }
}
