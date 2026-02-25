import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, In } from 'typeorm';
import { TrackingEventEntity, EventType } from './tracking-event.entity';
import { ProductEntity } from '../products/products.entity';

export interface TrackEventDto {
  mem_code?: string;
  session_id: string;
  event_type: EventType;
  page_path?: string;
  page_title?: string;
  pro_code?: string;
  search_query?: string;
  filters?: Record<string, any>;
  extra_data?: Record<string, any>;
  referrer?: string;
  duration_ms?: number;
  device_type?: string;
  user_agent?: string;
  ip_address?: string;
}

export interface BatchTrackDto {
  events: TrackEventDto[];
}

@Injectable()
export class BehaviorTrackingService {
  constructor(
    @InjectRepository(TrackingEventEntity)
    private readonly trackingRepo: Repository<TrackingEventEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  // Track single event
  async trackEvent(dto: TrackEventDto): Promise<TrackingEventEntity> {
    const event = this.trackingRepo.create(dto);
    return this.trackingRepo.save(event);
  }

  // Track batch events (for buffered sending)
  async trackBatch(dto: BatchTrackDto): Promise<{ saved: number }> {
    const events = dto.events.map((e) => this.trackingRepo.create(e));
    const saved = await this.trackingRepo.save(events);
    return { saved: saved.length };
  }

  // Get user behavior summary
  async getUserBehavior(
    mem_code: string,
    from_date?: string,
    to_date?: string,
  ) {
    const where: any = { mem_code };

    if (from_date && to_date) {
      where.created_at = Between(new Date(from_date), new Date(to_date));
    } else if (from_date) {
      where.created_at = MoreThanOrEqual(new Date(from_date));
    }

    // Get event counts by type
    const eventCounts = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.event_type', 'event_type')
      .addSelect('COUNT(*)', 'count')
      .where('t.mem_code = :mem_code', { mem_code })
      .groupBy('t.event_type')
      .getRawMany();

    // Get most viewed products
    const topProducts = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'view_count')
      .where('t.mem_code = :mem_code', { mem_code })
      .andWhere('t.event_type = :type', { type: 'product_view' })
      .andWhere('t.pro_code IS NOT NULL')
      .groupBy('t.pro_code')
      .orderBy('view_count', 'DESC')
      .limit(10)
      .getRawMany();

    // Get recent searches
    const recentSearches = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.search_query', 'query')
      .addSelect('MAX(t.created_at)', 'last_searched')
      .where('t.mem_code = :mem_code', { mem_code })
      .andWhere('t.event_type = :type', { type: 'search' })
      .andWhere('t.search_query IS NOT NULL')
      .groupBy('t.search_query')
      .orderBy('last_searched', 'DESC')
      .limit(10)
      .getRawMany();

    // Get most visited pages
    const topPages = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.page_path', 'page_path')
      .addSelect('COUNT(*)', 'visit_count')
      .where('t.mem_code = :mem_code', { mem_code })
      .andWhere('t.event_type = :type', { type: 'page_view' })
      .groupBy('t.page_path')
      .orderBy('visit_count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      mem_code,
      event_counts: eventCounts,
      top_products: topProducts,
      recent_searches: recentSearches,
      top_pages: topPages,
    };
  }

  // Get product analytics
  async getProductAnalytics(
    pro_code: string,
    from_date?: string,
    to_date?: string,
  ) {
    const baseQuery = this.trackingRepo
      .createQueryBuilder('t')
      .where('t.pro_code = :pro_code', { pro_code });

    if (from_date && to_date) {
      baseQuery.andWhere('t.created_at BETWEEN :from AND :to', {
        from: new Date(from_date),
        to: new Date(to_date),
      });
    }

    // Views count
    const views = await baseQuery
      .clone()
      .andWhere('t.event_type = :type', { type: 'product_view' })
      .getCount();

    // Add to cart count
    const addToCart = await baseQuery
      .clone()
      .andWhere('t.event_type = :type', { type: 'product_add_cart' })
      .getCount();

    // Favorite count
    const favorites = await baseQuery
      .clone()
      .andWhere('t.event_type = :type', { type: 'product_favorite' })
      .getCount();

    // Unique viewers
    const uniqueViewers = await this.trackingRepo
      .createQueryBuilder('t')
      .select('COUNT(DISTINCT t.mem_code)', 'count')
      .where('t.pro_code = :pro_code', { pro_code })
      .andWhere('t.event_type = :type', { type: 'product_view' })
      .andWhere('t.mem_code IS NOT NULL')
      .getRawOne();

    return {
      pro_code,
      views,
      add_to_cart: addToCart,
      favorites,
      unique_viewers: parseInt(uniqueViewers?.count || '0'),
      conversion_rate:
        views > 0 ? ((addToCart / views) * 100).toFixed(2) + '%' : '0%',
    };
  }

  // Get search analytics
  async getSearchAnalytics(from_date?: string, to_date?: string) {
    const query = this.trackingRepo
      .createQueryBuilder('t')
      .where('t.event_type = :type', { type: 'search' })
      .andWhere('t.search_query IS NOT NULL');

    if (from_date && to_date) {
      query.andWhere('t.created_at BETWEEN :from AND :to', {
        from: new Date(from_date),
        to: new Date(to_date),
      });
    }

    // Top search terms
    const topSearches = await query
      .clone()
      .select('t.search_query', 'query')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.search_query')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    // Total searches
    const totalSearches = await query.clone().getCount();

    // Unique searchers
    const uniqueSearchers = await this.trackingRepo
      .createQueryBuilder('t')
      .select('COUNT(DISTINCT t.mem_code)', 'count')
      .where('t.event_type = :type', { type: 'search' })
      .andWhere('t.mem_code IS NOT NULL')
      .getRawOne();

    return {
      top_searches: topSearches,
      total_searches: totalSearches,
      unique_searchers: parseInt(uniqueSearchers?.count || '0'),
    };
  }

  // Get dashboard overview
  async getDashboardStats(from_date?: string, to_date?: string) {
    const baseQuery = this.trackingRepo.createQueryBuilder('t');

    if (from_date && to_date) {
      baseQuery.where('t.created_at BETWEEN :from AND :to', {
        from: new Date(from_date),
        to: new Date(to_date),
      });
    }

    // Total events
    const totalEvents = await baseQuery.clone().getCount();

    // Events by type
    const eventsByType = await baseQuery
      .clone()
      .select('t.event_type', 'event_type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.event_type')
      .orderBy('count', 'DESC')
      .getRawMany();

    // Unique users
    const uniqueUsers = await this.trackingRepo
      .createQueryBuilder('t')
      .select('COUNT(DISTINCT t.mem_code)', 'count')
      .where('t.mem_code IS NOT NULL')
      .getRawOne();

    // Unique sessions
    const uniqueSessions = await this.trackingRepo
      .createQueryBuilder('t')
      .select('COUNT(DISTINCT t.session_id)', 'count')
      .getRawOne();

    // Events by hour (last 24h)
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const eventsByHour = await this.trackingRepo
      .createQueryBuilder('t')
      .select('HOUR(t.created_at)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('t.created_at >= :since', { since: last24h })
      .groupBy('HOUR(t.created_at)')
      .orderBy('hour', 'ASC')
      .getRawMany();

    // Device breakdown
    const deviceBreakdown = await baseQuery
      .clone()
      .select('t.device_type', 'device')
      .addSelect('COUNT(*)', 'count')
      .where('t.device_type IS NOT NULL')
      .groupBy('t.device_type')
      .getRawMany();

    return {
      total_events: totalEvents,
      events_by_type: eventsByType,
      unique_users: parseInt(uniqueUsers?.count || '0'),
      unique_sessions: parseInt(uniqueSessions?.count || '0'),
      events_by_hour: eventsByHour,
      device_breakdown: deviceBreakdown,
    };
  }

  // Get daily trend - events per day
  async getDailyTrend(from_date?: string, to_date?: string) {
    const query = this.trackingRepo.createQueryBuilder('t');

    if (from_date && to_date) {
      query.where('t.created_at BETWEEN :from AND :to', {
        from: new Date(from_date),
        to: new Date(to_date + ' 23:59:59'),
      });
    }

    const dailyEvents = await query
      .select('DATE(t.created_at)', 'date')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'product_view' THEN 1 ELSE 0 END)`,
        'product_views',
      )
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'product_add_cart' THEN 1 ELSE 0 END)`,
        'add_to_cart',
      )
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'checkout_complete' THEN 1 ELSE 0 END)`,
        'orders',
      )
      .addSelect('COUNT(DISTINCT t.mem_code)', 'unique_users')
      .groupBy('DATE(t.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      daily_events: dailyEvents.map((d) => ({
        date: d.date,
        total: parseInt(d.total || '0'),
        product_views: parseInt(d.product_views || '0'),
        add_to_cart: parseInt(d.add_to_cart || '0'),
        orders: parseInt(d.orders || '0'),
        unique_users: parseInt(d.unique_users || '0'),
      })),
    };
  }

  // Get top products by views and add to cart
  async getTopProducts(from_date?: string, to_date?: string, limit = 10) {
    const dateCondition =
      from_date && to_date
        ? 't.created_at BETWEEN :from AND :to'
        : '1=1';
    const dateParams =
      from_date && to_date
        ? { from: new Date(from_date), to: new Date(to_date + ' 23:59:59') }
        : {};

    // Top viewed products
    const topViewed = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'view_count')
      .addSelect('COUNT(DISTINCT t.mem_code)', 'unique_viewers')
      .where('t.event_type = :type', { type: 'product_view' })
      .andWhere('t.pro_code IS NOT NULL')
      .andWhere(dateCondition, dateParams)
      .groupBy('t.pro_code')
      .orderBy('view_count', 'DESC')
      .limit(limit)
      .getRawMany();

    // Top added to cart products
    const topAddedToCart = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'add_count')
      .addSelect('COUNT(DISTINCT t.mem_code)', 'unique_adders')
      .where('t.event_type = :type', { type: 'product_add_cart' })
      .andWhere('t.pro_code IS NOT NULL')
      .andWhere(dateCondition, dateParams)
      .groupBy('t.pro_code')
      .orderBy('add_count', 'DESC')
      .limit(limit)
      .getRawMany();

    // Top favorited products
    const topFavorited = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'favorite_count')
      .where('t.event_type = :type', { type: 'product_favorite' })
      .andWhere('t.pro_code IS NOT NULL')
      .andWhere(dateCondition, dateParams)
      .groupBy('t.pro_code')
      .orderBy('favorite_count', 'DESC')
      .limit(limit)
      .getRawMany();

    return {
      top_viewed: topViewed.map((p) => ({
        pro_code: p.pro_code,
        view_count: parseInt(p.view_count || '0'),
        unique_viewers: parseInt(p.unique_viewers || '0'),
      })),
      top_added_to_cart: topAddedToCart.map((p) => ({
        pro_code: p.pro_code,
        add_count: parseInt(p.add_count || '0'),
        unique_adders: parseInt(p.unique_adders || '0'),
      })),
      top_favorited: topFavorited.map((p) => ({
        pro_code: p.pro_code,
        favorite_count: parseInt(p.favorite_count || '0'),
      })),
    };
  }

  // Get recent activity feed
  async getRecentActivity(limit = 50) {
    const activities = await this.trackingRepo
      .createQueryBuilder('t')
      .select([
        't.id',
        't.event_type',
        't.mem_code',
        't.session_id',
        't.pro_code',
        't.page_path',
        't.search_query',
        't.device_type',
        't.created_at',
      ])
      .orderBy('t.created_at', 'DESC')
      .limit(limit)
      .getMany();

    return {
      activities: activities.map((a) => ({
        id: a.id,
        event_type: a.event_type,
        mem_code: a.mem_code,
        session_id: a.session_id,
        pro_code: a.pro_code,
        page_path: a.page_path,
        search_query: a.search_query,
        device_type: a.device_type,
        created_at: a.created_at,
      })),
    };
  }

  // Get user journeys (session paths)
  async getUserJourneys(limit = 20) {
    // Get recent sessions with their events
    const sessions = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.session_id', 'session_id')
      .addSelect('t.mem_code', 'mem_code')
      .addSelect('MIN(t.created_at)', 'start_time')
      .addSelect('MAX(t.created_at)', 'end_time')
      .addSelect('COUNT(*)', 'event_count')
      .addSelect('t.device_type', 'device_type')
      .groupBy('t.session_id')
      .addGroupBy('t.mem_code')
      .addGroupBy('t.device_type')
      .orderBy('start_time', 'DESC')
      .limit(limit)
      .getRawMany();

    // Get journey details for each session
    const journeys = await Promise.all(
      sessions.map(async (session) => {
        const events = await this.trackingRepo
          .createQueryBuilder('t')
          .select([
            't.event_type',
            't.page_path',
            't.pro_code',
            't.search_query',
            't.created_at',
          ])
          .where('t.session_id = :sessionId', { sessionId: session.session_id })
          .orderBy('t.created_at', 'ASC')
          .getMany();

        // Build journey path
        const path = events.map((e) => ({
          event_type: e.event_type,
          page_path: e.page_path,
          pro_code: e.pro_code,
          search_query: e.search_query,
          timestamp: e.created_at,
        }));

        // Calculate duration in seconds
        const startTime = new Date(session.start_time).getTime();
        const endTime = new Date(session.end_time).getTime();
        const duration_seconds = Math.round((endTime - startTime) / 1000);

        // Check if converted (has checkout_complete)
        const converted = events.some((e) => e.event_type === 'checkout_complete');

        return {
          session_id: session.session_id,
          mem_code: session.mem_code,
          device_type: session.device_type,
          start_time: session.start_time,
          end_time: session.end_time,
          duration_seconds,
          event_count: parseInt(session.event_count || '0'),
          converted,
          path,
        };
      }),
    );

    return { journeys };
  }

  // Get zero result searches
  async getZeroResultSearches(from_date?: string, to_date?: string, limit = 30) {
    const query = this.trackingRepo
      .createQueryBuilder('t')
      .where('t.event_type = :type', { type: 'search' })
      .andWhere('t.search_query IS NOT NULL')
      .andWhere(`JSON_EXTRACT(t.extra_data, '$.result_count') = 0`);

    if (from_date && to_date) {
      query.andWhere('t.created_at BETWEEN :from AND :to', {
        from: new Date(from_date),
        to: new Date(to_date + ' 23:59:59'),
      });
    }

    const zeroResults = await query
      .select('t.search_query', 'query')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(t.created_at)', 'last_searched')
      .groupBy('t.search_query')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    // Total zero result searches
    const totalCount = await query.clone().getCount();

    return {
      zero_result_searches: zeroResults.map((r) => ({
        query: r.query,
        count: parseInt(r.count || '0'),
        last_searched: r.last_searched,
      })),
      total_count: totalCount,
    };
  }

  // Get stock alerts based on demand (high views but low stock)
  async getStockAlerts(days = 7, limit = 20) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Get products with high view counts in the last N days
    const highDemandProducts = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'view_count')
      .addSelect('COUNT(DISTINCT t.session_id)', 'unique_viewers')
      .where('t.event_type = :type', { type: 'product_view' })
      .andWhere('t.pro_code IS NOT NULL')
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .groupBy('t.pro_code')
      .orderBy('view_count', 'DESC')
      .limit(100) // Get top 100 viewed products
      .getRawMany();

    if (highDemandProducts.length === 0) {
      return { alerts: [], summary: { critical: 0, warning: 0, watch: 0 } };
    }

    // Get stock info for these products
    const proCodes = highDemandProducts.map((p) => p.pro_code);
    const products = await this.productRepo.find({
      where: { pro_code: In(proCodes) },
      select: [
        'pro_code',
        'pro_name',
        'pro_stock',
        'pro_lowest_stock',
        'pro_imgmain',
        'pro_unit1',
      ],
    });

    // Create stock map
    const stockMap = new Map(products.map((p) => [p.pro_code, p]));

    // Calculate alerts
    const alerts = highDemandProducts
      .map((demand) => {
        const product = stockMap.get(demand.pro_code);
        if (!product) return null;

        const viewCount = parseInt(demand.view_count || '0');
        const uniqueViewers = parseInt(demand.unique_viewers || '0');
        const stock = product.pro_stock || 0;
        const lowestStock = Number(product.pro_lowest_stock) || 0;

        // Calculate demand score (views per day)
        const demandPerDay = viewCount / days;

        // Calculate stock status
        let alertLevel: 'critical' | 'warning' | 'watch' | 'ok' = 'ok';
        let message = '';

        if (stock === 0) {
          alertLevel = 'critical';
          message = 'สินค้าหมด! มีคนดู ' + viewCount + ' ครั้งใน ' + days + ' วัน';
        } else if (stock <= lowestStock) {
          alertLevel = 'critical';
          message = 'สต็อกต่ำกว่าเกณฑ์! คงเหลือ ' + stock + ' ' + product.pro_unit1;
        } else if (demandPerDay > 10 && stock < demandPerDay * 7) {
          // High demand but less than 1 week of stock
          alertLevel = 'warning';
          message =
            'Demand สูง (' +
            demandPerDay.toFixed(1) +
            ' views/วัน) แต่สต็อกอาจไม่พอ';
        } else if (demandPerDay > 5 && stock < demandPerDay * 14) {
          // Medium demand but less than 2 weeks of stock
          alertLevel = 'watch';
          message = 'ควรเฝ้าระวัง - Demand เพิ่มขึ้น';
        }

        if (alertLevel === 'ok') return null;

        return {
          pro_code: product.pro_code,
          pro_name: product.pro_name,
          pro_imgmain: product.pro_imgmain,
          pro_unit1: product.pro_unit1,
          current_stock: stock,
          lowest_stock: lowestStock,
          view_count: viewCount,
          unique_viewers: uniqueViewers,
          demand_per_day: Math.round(demandPerDay * 10) / 10,
          alert_level: alertLevel,
          message,
        };
      })
      .filter((a) => a !== null)
      .slice(0, limit);

    // Count by alert level
    const summary = {
      critical: alerts.filter((a) => a.alert_level === 'critical').length,
      warning: alerts.filter((a) => a.alert_level === 'warning').length,
      watch: alerts.filter((a) => a.alert_level === 'watch').length,
    };

    return { alerts, summary };
  }

  // Get cart conversion analytics - analyze add-to-cart vs checkout patterns
  async getCartConversionAnalytics(days = 30, limit = 20) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // 1. Get products with add_to_cart events
    const cartProducts = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'add_count')
      .addSelect('COUNT(DISTINCT t.session_id)', 'unique_sessions')
      .addSelect('COUNT(DISTINCT t.mem_code)', 'unique_users')
      .where('t.event_type = :type', { type: 'product_add_cart' })
      .andWhere('t.pro_code IS NOT NULL')
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .groupBy('t.pro_code')
      .orderBy('add_count', 'DESC')
      .limit(100)
      .getRawMany();

    if (cartProducts.length === 0) {
      return {
        products: [],
        summary: {
          total_products: 0,
          avg_conversion_rate: 0,
          high_conversion: 0,
          low_conversion: 0,
          price_sensitive: 0,
        },
      };
    }

    const proCodes = cartProducts.map((p) => p.pro_code);

    // 2. Get checkout_complete events for these products
    // Note: We need to join with order data, but for now we'll use checkout_complete events
    // and check if same session had both add_cart and checkout_complete
    const checkoutSessions = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.session_id', 'session_id')
      .where('t.event_type = :type', { type: 'checkout_complete' })
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .getRawMany();

    const completedSessionIds = new Set(checkoutSessions.map((s) => s.session_id));

    // 3. Get cart sessions per product to check conversion
    const cartSessionsPerProduct = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('t.session_id', 'session_id')
      .where('t.event_type = :type', { type: 'product_add_cart' })
      .andWhere('t.pro_code IN (:...codes)', { codes: proCodes })
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .getRawMany();

    // Group sessions by product
    const productSessions: Record<string, Set<string>> = {};
    cartSessionsPerProduct.forEach((row) => {
      if (!productSessions[row.pro_code]) {
        productSessions[row.pro_code] = new Set();
      }
      productSessions[row.pro_code].add(row.session_id);
    });

    // 4. Get remove_cart events to detect comparison behavior
    const removeEvents = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.pro_code', 'pro_code')
      .addSelect('COUNT(*)', 'remove_count')
      .where('t.event_type = :type', { type: 'product_remove_cart' })
      .andWhere('t.pro_code IN (:...codes)', { codes: proCodes })
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .groupBy('t.pro_code')
      .getRawMany();

    const removeMap: Record<string, number> = {};
    removeEvents.forEach((r) => {
      removeMap[r.pro_code] = parseInt(r.remove_count);
    });

    // 5. Get product info
    const products = await this.productRepo.find({
      where: { pro_code: In(proCodes) },
      select: ['pro_code', 'pro_name', 'pro_imgmain', 'pro_unit1'],
    });

    const productMap: Record<string, any> = {};
    products.forEach((p) => {
      productMap[p.pro_code] = p;
    });

    // 6. Calculate conversion metrics
    const analytics = cartProducts
      .map((cart) => {
        const product = productMap[cart.pro_code];
        if (!product) return null;

        const sessions = productSessions[cart.pro_code] || new Set();
        const convertedSessions = Array.from(sessions).filter((s) =>
          completedSessionIds.has(s),
        ).length;
        const totalSessions = sessions.size;
        const conversionRate =
          totalSessions > 0 ? (convertedSessions / totalSessions) * 100 : 0;

        const addCount = parseInt(cart.add_count);
        const removeCount = removeMap[cart.pro_code] || 0;
        const removeRatio = addCount > 0 ? (removeCount / addCount) * 100 : 0;

        // Determine status
        let status: 'high_conversion' | 'low_conversion' | 'price_sensitive' | 'normal';
        let message: string;

        if (conversionRate >= 50) {
          status = 'high_conversion';
          message = 'ลูกค้าตัดสินใจซื้อเร็ว - ราคาดี';
        } else if (removeRatio > 50) {
          status = 'price_sensitive';
          message = 'ถูกลบออกบ่อย - อาจแพงกว่าคู่แข่ง';
        } else if (conversionRate < 20 && addCount >= 5) {
          status = 'low_conversion';
          message = 'เพิ่มตะกร้าบ่อยแต่ไม่ค่อยซื้อ';
        } else {
          status = 'normal';
          message = 'ปกติ';
        }

        return {
          pro_code: cart.pro_code,
          pro_name: product.pro_name,
          pro_imgmain: product.pro_imgmain,
          pro_unit1: product.pro_unit1,
          add_count: addCount,
          remove_count: removeCount,
          unique_sessions: parseInt(cart.unique_sessions),
          converted_sessions: convertedSessions,
          conversion_rate: Math.round(conversionRate * 10) / 10,
          remove_ratio: Math.round(removeRatio * 10) / 10,
          status,
          message,
        };
      })
      .filter((a) => a !== null)
      .slice(0, limit);

    // Summary
    const summary = {
      total_products: analytics.length,
      avg_conversion_rate:
        analytics.length > 0
          ? Math.round(
              (analytics.reduce((sum, a) => sum + a.conversion_rate, 0) /
                analytics.length) *
                10,
            ) / 10
          : 0,
      high_conversion: analytics.filter((a) => a.status === 'high_conversion')
        .length,
      low_conversion: analytics.filter((a) => a.status === 'low_conversion')
        .length,
      price_sensitive: analytics.filter((a) => a.status === 'price_sensitive')
        .length,
    };

    return { products: analytics, summary };
  }

  // Get customer segments based on behavior patterns
  async getCustomerSegments(days = 90) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Get all users with their behavior metrics
    const userMetrics = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.mem_code', 'mem_code')
      .addSelect('COUNT(*)', 'total_events')
      .addSelect('COUNT(DISTINCT DATE(t.created_at))', 'active_days')
      .addSelect('MAX(t.created_at)', 'last_activity')
      .addSelect('MIN(t.created_at)', 'first_activity')
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'product_view' THEN 1 ELSE 0 END)`,
        'product_views',
      )
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'product_add_cart' THEN 1 ELSE 0 END)`,
        'add_to_cart',
      )
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'checkout_complete' THEN 1 ELSE 0 END)`,
        'orders',
      )
      .addSelect(
        `SUM(CASE WHEN t.event_type = 'search' THEN 1 ELSE 0 END)`,
        'searches',
      )
      .addSelect('COUNT(DISTINCT t.session_id)', 'sessions')
      .where('t.mem_code IS NOT NULL')
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .groupBy('t.mem_code')
      .getRawMany();

    if (userMetrics.length === 0) {
      return {
        segments: [],
        summary: {
          vip: 0,
          loyal: 0,
          potential: 0,
          browsers: 0,
          at_risk: 0,
          new_users: 0,
        },
      };
    }

    const now = new Date();
    const segments: any[] = [];

    // Classify each user
    for (const user of userMetrics) {
      const totalEvents = parseInt(user.total_events || '0');
      const activeDays = parseInt(user.active_days || '0');
      const orders = parseInt(user.orders || '0');
      const productViews = parseInt(user.product_views || '0');
      const addToCart = parseInt(user.add_to_cart || '0');
      const sessions = parseInt(user.sessions || '0');
      const lastActivity = new Date(user.last_activity);
      const firstActivity = new Date(user.first_activity);

      // Calculate days since last activity
      const daysSinceLastActivity = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Calculate days since first activity
      const customerAge = Math.floor(
        (now.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Calculate engagement score
      const engagementScore =
        activeDays * 2 +
        orders * 10 +
        addToCart * 3 +
        productViews * 0.5 +
        sessions;

      // Determine segment
      let segment: 'vip' | 'loyal' | 'potential' | 'browsers' | 'at_risk' | 'new_users';
      let segmentLabel: string;
      let description: string;

      if (orders >= 5 && activeDays >= 10 && daysSinceLastActivity <= 14) {
        segment = 'vip';
        segmentLabel = 'VIP';
        description = 'ลูกค้าระดับพรีเมียม ซื้อบ่อย มูลค่าสูง';
      } else if (orders >= 2 && daysSinceLastActivity <= 30 && activeDays >= 5) {
        segment = 'loyal';
        segmentLabel = 'Loyal';
        description = 'ลูกค้าประจำ กลับมาซื้อซ้ำ';
      } else if (
        orders >= 1 &&
        daysSinceLastActivity <= 30 &&
        addToCart >= 3
      ) {
        segment = 'potential';
        segmentLabel = 'Potential';
        description = 'มีโอกาสซื้อสูง เคยสั่งและมีของในตะกร้า';
      } else if (
        orders === 0 &&
        productViews >= 10 &&
        daysSinceLastActivity <= 30
      ) {
        segment = 'browsers';
        segmentLabel = 'Browsers';
        description = 'ดูสินค้าเยอะแต่ยังไม่ซื้อ';
      } else if (orders >= 1 && daysSinceLastActivity > 30) {
        segment = 'at_risk';
        segmentLabel = 'At Risk';
        description = 'เคยซื้อแต่ไม่กลับมานาน';
      } else if (customerAge <= 7) {
        segment = 'new_users';
        segmentLabel = 'New Users';
        description = 'ลูกค้าใหม่ภายใน 7 วัน';
      } else {
        segment = 'browsers';
        segmentLabel = 'Browsers';
        description = 'ดูสินค้าแต่ยังไม่ซื้อ';
      }

      segments.push({
        mem_code: user.mem_code,
        segment,
        segment_label: segmentLabel,
        description,
        metrics: {
          total_events: totalEvents,
          active_days: activeDays,
          orders,
          product_views: productViews,
          add_to_cart: addToCart,
          sessions,
        },
        engagement_score: Math.round(engagementScore),
        days_since_last_activity: daysSinceLastActivity,
        last_activity: lastActivity,
        first_activity: firstActivity,
      });
    }

    // Sort by engagement score
    segments.sort((a, b) => b.engagement_score - a.engagement_score);

    // Count summary
    const summary = {
      vip: segments.filter((s) => s.segment === 'vip').length,
      loyal: segments.filter((s) => s.segment === 'loyal').length,
      potential: segments.filter((s) => s.segment === 'potential').length,
      browsers: segments.filter((s) => s.segment === 'browsers').length,
      at_risk: segments.filter((s) => s.segment === 'at_risk').length,
      new_users: segments.filter((s) => s.segment === 'new_users').length,
    };

    return { segments, summary };
  }

  // Get retention analysis - track user return rates
  async getRetentionAnalysis(weeks = 8) {
    const now = new Date();

    // Get cohorts (users grouped by their first activity week)
    const cohorts = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.mem_code', 'mem_code')
      .addSelect('MIN(t.created_at)', 'first_activity')
      .where('t.mem_code IS NOT NULL')
      .groupBy('t.mem_code')
      .getRawMany();

    if (cohorts.length === 0) {
      return {
        cohorts: [],
        retention_rates: { day1: 0, day7: 0, day14: 0, day30: 0 },
        weekly_cohorts: [],
      };
    }

    // Group users by cohort week
    const cohortMap: Record<
      string,
      { users: string[]; week_start: Date; week_label: string }
    > = {};

    for (const user of cohorts) {
      const firstActivity = new Date(user.first_activity);
      // Get start of week (Monday)
      const weekStart = new Date(firstActivity);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);

      const weekKey = weekStart.toISOString().split('T')[0];
      if (!cohortMap[weekKey]) {
        cohortMap[weekKey] = {
          users: [],
          week_start: weekStart,
          week_label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
        };
      }
      cohortMap[weekKey].users.push(user.mem_code);
    }

    // Get all activity dates for each user
    const userActivities = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.mem_code', 'mem_code')
      .addSelect('DATE(t.created_at)', 'activity_date')
      .where('t.mem_code IS NOT NULL')
      .groupBy('t.mem_code')
      .addGroupBy('DATE(t.created_at)')
      .getRawMany();

    // Create activity map: user -> set of activity dates
    const activityMap: Record<string, Set<string>> = {};
    for (const activity of userActivities) {
      if (!activityMap[activity.mem_code]) {
        activityMap[activity.mem_code] = new Set();
      }
      const dateStr =
        activity.activity_date instanceof Date
          ? activity.activity_date.toISOString().split('T')[0]
          : String(activity.activity_date).split('T')[0];
      activityMap[activity.mem_code].add(dateStr);
    }

    // Calculate retention for each cohort
    const weeklyCohorts: {
      week_label: string;
      week_start: string;
      total_users: number;
      retention: number[]; // retention rate for week 0, 1, 2, ... (week 0 = 100%)
    }[] = [];

    const sortedWeeks = Object.keys(cohortMap).sort().slice(-weeks);

    for (const weekKey of sortedWeeks) {
      const cohort = cohortMap[weekKey];
      const cohortWeekStart = new Date(weekKey);
      const retention: number[] = [100]; // Week 0 is always 100%

      // Calculate retention for subsequent weeks
      for (let weekNum = 1; weekNum <= weeks; weekNum++) {
        const weekStart = new Date(cohortWeekStart);
        weekStart.setDate(weekStart.getDate() + weekNum * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Skip future weeks
        if (weekStart > now) {
          break;
        }

        // Count users who were active in this week
        let activeUsers = 0;
        for (const userId of cohort.users) {
          const userDates = activityMap[userId];
          if (!userDates) continue;

          // Check if user was active in this week
          for (const dateStr of userDates) {
            const date = new Date(dateStr);
            if (date >= weekStart && date < weekEnd) {
              activeUsers++;
              break;
            }
          }
        }

        const retentionRate =
          cohort.users.length > 0
            ? Math.round((activeUsers / cohort.users.length) * 100)
            : 0;
        retention.push(retentionRate);
      }

      weeklyCohorts.push({
        week_label: cohort.week_label,
        week_start: weekKey,
        total_users: cohort.users.length,
        retention,
      });
    }

    // Calculate overall retention rates (Day 1, Day 7, Day 14, Day 30)
    let day1Total = 0,
      day1Retained = 0;
    let day7Total = 0,
      day7Retained = 0;
    let day14Total = 0,
      day14Retained = 0;
    let day30Total = 0,
      day30Retained = 0;

    for (const user of cohorts) {
      const firstActivity = new Date(user.first_activity);
      const userDates = activityMap[user.mem_code];
      if (!userDates) continue;

      // Day 1 retention (active on day after first activity)
      const day1Date = new Date(firstActivity);
      day1Date.setDate(day1Date.getDate() + 1);
      if (day1Date <= now) {
        day1Total++;
        if (userDates.has(day1Date.toISOString().split('T')[0])) {
          day1Retained++;
        }
      }

      // Day 7 retention
      const day7Date = new Date(firstActivity);
      day7Date.setDate(day7Date.getDate() + 7);
      if (day7Date <= now) {
        day7Total++;
        // Check if active on day 7 or within ±1 day
        for (let d = -1; d <= 1; d++) {
          const checkDate = new Date(day7Date);
          checkDate.setDate(checkDate.getDate() + d);
          if (userDates.has(checkDate.toISOString().split('T')[0])) {
            day7Retained++;
            break;
          }
        }
      }

      // Day 14 retention
      const day14Date = new Date(firstActivity);
      day14Date.setDate(day14Date.getDate() + 14);
      if (day14Date <= now) {
        day14Total++;
        for (let d = -1; d <= 1; d++) {
          const checkDate = new Date(day14Date);
          checkDate.setDate(checkDate.getDate() + d);
          if (userDates.has(checkDate.toISOString().split('T')[0])) {
            day14Retained++;
            break;
          }
        }
      }

      // Day 30 retention
      const day30Date = new Date(firstActivity);
      day30Date.setDate(day30Date.getDate() + 30);
      if (day30Date <= now) {
        day30Total++;
        for (let d = -2; d <= 2; d++) {
          const checkDate = new Date(day30Date);
          checkDate.setDate(checkDate.getDate() + d);
          if (userDates.has(checkDate.toISOString().split('T')[0])) {
            day30Retained++;
            break;
          }
        }
      }
    }

    const retentionRates = {
      day1: day1Total > 0 ? Math.round((day1Retained / day1Total) * 100) : 0,
      day7: day7Total > 0 ? Math.round((day7Retained / day7Total) * 100) : 0,
      day14:
        day14Total > 0 ? Math.round((day14Retained / day14Total) * 100) : 0,
      day30:
        day30Total > 0 ? Math.round((day30Retained / day30Total) * 100) : 0,
    };

    return {
      cohorts: cohorts.length,
      retention_rates: retentionRates,
      weekly_cohorts: weeklyCohorts,
    };
  }

  // Get repeat purchase patterns - analyze customer purchase cycles
  async getRepeatPurchasePatterns(days = 180) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const now = new Date();

    // Get all checkout_complete events with their dates
    const purchases = await this.trackingRepo
      .createQueryBuilder('t')
      .select('t.mem_code', 'mem_code')
      .addSelect('t.created_at', 'purchase_date')
      .addSelect('t.pro_code', 'pro_code')
      .where("t.event_type = 'checkout_complete'")
      .andWhere('t.mem_code IS NOT NULL')
      .andWhere('t.created_at >= :fromDate', { fromDate })
      .orderBy('t.mem_code')
      .addOrderBy('t.created_at', 'ASC')
      .getRawMany();

    if (purchases.length === 0) {
      return {
        customers: [],
        summary: {
          total_repeat_customers: 0,
          avg_purchase_cycle: 0,
          customers_due_for_reorder: 0,
          customers_overdue: 0,
        },
        products_by_cycle: [],
      };
    }

    // Group purchases by customer
    const customerPurchases: Record<
      string,
      { dates: Date[]; products: string[] }
    > = {};

    for (const purchase of purchases) {
      if (!customerPurchases[purchase.mem_code]) {
        customerPurchases[purchase.mem_code] = { dates: [], products: [] };
      }
      customerPurchases[purchase.mem_code].dates.push(
        new Date(purchase.purchase_date),
      );
      if (purchase.pro_code) {
        customerPurchases[purchase.mem_code].products.push(purchase.pro_code);
      }
    }

    // Analyze each customer's purchase patterns
    const customers: {
      mem_code: string;
      total_purchases: number;
      first_purchase: Date;
      last_purchase: Date;
      avg_days_between_purchases: number;
      days_since_last_purchase: number;
      predicted_next_purchase: Date;
      status: 'on_track' | 'due_soon' | 'overdue' | 'new_customer';
      reorder_probability: number;
    }[] = [];

    for (const [memCode, data] of Object.entries(customerPurchases)) {
      const dates = data.dates.sort((a, b) => a.getTime() - b.getTime());
      const totalPurchases = dates.length;
      const firstPurchase = dates[0];
      const lastPurchase = dates[dates.length - 1];

      // Calculate average days between purchases
      let avgDaysBetween = 0;
      if (totalPurchases >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          const daysDiff = Math.floor(
            (dates[i].getTime() - dates[i - 1].getTime()) /
              (1000 * 60 * 60 * 24),
          );
          intervals.push(daysDiff);
        }
        avgDaysBetween = Math.round(
          intervals.reduce((a, b) => a + b, 0) / intervals.length,
        );
      }

      // Days since last purchase
      const daysSinceLastPurchase = Math.floor(
        (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Predict next purchase date
      const predictedNextPurchase = new Date(lastPurchase);
      predictedNextPurchase.setDate(
        predictedNextPurchase.getDate() + (avgDaysBetween || 30),
      );

      // Determine status
      let status: 'on_track' | 'due_soon' | 'overdue' | 'new_customer';
      let reorderProbability = 0;

      if (totalPurchases === 1) {
        status = 'new_customer';
        reorderProbability = 30; // Base probability for new customers
      } else if (avgDaysBetween > 0) {
        const daysUntilExpected = avgDaysBetween - daysSinceLastPurchase;

        if (daysUntilExpected > 7) {
          status = 'on_track';
          reorderProbability = Math.max(10, 50 - daysUntilExpected * 2);
        } else if (daysUntilExpected > -7) {
          status = 'due_soon';
          reorderProbability = 70 + Math.min(20, (7 - daysUntilExpected) * 3);
        } else {
          status = 'overdue';
          // Probability decreases the more overdue they are
          reorderProbability = Math.max(
            20,
            90 - Math.abs(daysUntilExpected) * 2,
          );
        }
      } else {
        status = 'new_customer';
        reorderProbability = 30;
      }

      customers.push({
        mem_code: memCode,
        total_purchases: totalPurchases,
        first_purchase: firstPurchase,
        last_purchase: lastPurchase,
        avg_days_between_purchases: avgDaysBetween,
        days_since_last_purchase: daysSinceLastPurchase,
        predicted_next_purchase: predictedNextPurchase,
        status,
        reorder_probability: Math.round(reorderProbability),
      });
    }

    // Sort by reorder probability (highest first) and status priority
    const statusPriority = {
      due_soon: 1,
      overdue: 2,
      on_track: 3,
      new_customer: 4,
    };
    customers.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return b.reorder_probability - a.reorder_probability;
    });

    // Calculate summary
    const repeatCustomers = customers.filter((c) => c.total_purchases >= 2);
    const avgCycle =
      repeatCustomers.length > 0
        ? Math.round(
            repeatCustomers.reduce(
              (sum, c) => sum + c.avg_days_between_purchases,
              0,
            ) / repeatCustomers.length,
          )
        : 0;

    const summary = {
      total_repeat_customers: repeatCustomers.length,
      avg_purchase_cycle: avgCycle,
      customers_due_for_reorder: customers.filter((c) => c.status === 'due_soon')
        .length,
      customers_overdue: customers.filter((c) => c.status === 'overdue').length,
    };

    // Analyze product purchase cycles
    const productCycles: Record<
      string,
      { intervals: number[]; customers: number }
    > = {};

    for (const purchase of purchases) {
      if (!purchase.pro_code) continue;

      // Find repeat purchases of the same product by same customer
      const customerProPurchases = purchases.filter(
        (p) =>
          p.mem_code === purchase.mem_code &&
          p.pro_code === purchase.pro_code,
      );

      if (customerProPurchases.length >= 2) {
        if (!productCycles[purchase.pro_code]) {
          productCycles[purchase.pro_code] = { intervals: [], customers: 0 };
        }

        const sortedDates = customerProPurchases
          .map((p) => new Date(p.purchase_date))
          .sort((a, b) => a.getTime() - b.getTime());

        for (let i = 1; i < sortedDates.length; i++) {
          const interval = Math.floor(
            (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
              (1000 * 60 * 60 * 24),
          );
          productCycles[purchase.pro_code].intervals.push(interval);
        }
      }
    }

    // Get product names and calculate average cycles
    const productCycleData: {
      pro_code: string;
      pro_name: string;
      avg_reorder_days: number;
      repeat_customers: number;
    }[] = [];

    const uniqueProducts = Object.keys(productCycles);
    if (uniqueProducts.length > 0) {
      const products = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.pro_code', 'p.pro_name'])
        .where('p.pro_code IN (:...codes)', { codes: uniqueProducts })
        .getMany();

      const productMap = new Map(products.map((p) => [p.pro_code, p.pro_name]));

      for (const [proCode, data] of Object.entries(productCycles)) {
        if (data.intervals.length > 0) {
          const avgDays = Math.round(
            data.intervals.reduce((a, b) => a + b, 0) / data.intervals.length,
          );
          // Count unique customers who repurchased
          const uniqueCustomers = new Set(
            purchases
              .filter((p) => p.pro_code === proCode)
              .map((p) => p.mem_code),
          ).size;

          productCycleData.push({
            pro_code: proCode,
            pro_name: productMap.get(proCode) || proCode,
            avg_reorder_days: avgDays,
            repeat_customers: uniqueCustomers,
          });
        }
      }

      // Sort by repeat customers
      productCycleData.sort((a, b) => b.repeat_customers - a.repeat_customers);
    }

    return {
      customers: customers.slice(0, 100), // Limit to top 100
      summary,
      products_by_cycle: productCycleData.slice(0, 20), // Top 20 products
    };
  }
}
