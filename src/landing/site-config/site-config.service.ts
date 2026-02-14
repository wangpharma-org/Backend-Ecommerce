import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteConfigEntity, ConfigType } from './site-config.entity';

// Default configs for landing page
const DEFAULT_CONFIGS = [
  // Company Info
  {
    config_key: 'company_name',
    config_value: 'บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด',
    config_type: ConfigType.TEXT,
    description: 'ชื่อบริษัท',
    category: 'company',
  },
  {
    config_key: 'company_address',
    config_value:
      'เลขที่ 23 ซ.พัฒโน ถ.อนุสรณ์อาจารย์ทอง ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา 90110',
    config_type: ConfigType.TEXT,
    description: 'ที่อยู่บริษัท',
    category: 'company',
  },
  {
    config_key: 'company_phone',
    config_value: '074-366681-5',
    config_type: ConfigType.TEXT,
    description: 'เบอร์โทรศัพท์',
    category: 'company',
  },
  {
    config_key: 'company_email',
    config_value: 'contact@wangpharma.com',
    config_type: ConfigType.TEXT,
    description: 'อีเมล',
    category: 'company',
  },
  {
    config_key: 'company_working_hours',
    config_value: 'จันทร์ - อาทิตย์ 08:00 - 18:00 น.',
    config_type: ConfigType.TEXT,
    description: 'เวลาทำการ',
    category: 'company',
  },
  // Social Links
  {
    config_key: 'social_facebook',
    config_value: 'https://www.facebook.com/wangpharma',
    config_type: ConfigType.URL,
    description: 'Facebook URL',
    category: 'social',
  },
  {
    config_key: 'social_line',
    config_value: 'https://line.me/R/ti/p/@wangpharma',
    config_type: ConfigType.URL,
    description: 'Line URL',
    category: 'social',
  },
  {
    config_key: 'social_instagram',
    config_value: 'https://www.instagram.com/wangpharma/',
    config_type: ConfigType.URL,
    description: 'Instagram URL',
    category: 'social',
  },
  // About Section
  {
    config_key: 'about_title',
    config_value: 'เกี่ยวกับเรา',
    config_type: ConfigType.TEXT,
    description: 'หัวข้อส่วนเกี่ยวกับเรา',
    category: 'about',
  },
  {
    config_key: 'about_description',
    config_value:
      'บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด เป็นผู้จำหน่ายยาและเวชภัณฑ์ชั้นนำ ดำเนินธุรกิจมากว่า 32 ปี',
    config_type: ConfigType.TEXT,
    description: 'รายละเอียดส่วนเกี่ยวกับเรา',
    category: 'about',
  },
  {
    config_key: 'about_highlights',
    config_value: JSON.stringify([
      'จำหน่ายยาและเวชภัณฑ์ครบวงจร',
      'สินค้าคุณภาพจากผู้ผลิตชั้นนำ',
      'ระบบจัดการสต็อกที่ทันสมัย',
      'ทีมงานมืออาชีพพร้อมให้บริการ',
    ]),
    config_type: ConfigType.JSON,
    description: 'จุดเด่นของบริษัท (JSON array)',
    category: 'about',
  },
  // Services
  {
    config_key: 'services',
    config_value: JSON.stringify([
      {
        icon: 'ClockIcon',
        title: 'สั่งซื้อได้ 24 ชั่วโมง',
        description: 'ระบบสั่งซื้อออนไลน์พร้อมให้บริการตลอด 24 ชั่วโมง',
      },
      {
        icon: 'TruckIcon',
        title: 'จัดส่งรวดเร็ว 1-2 วัน',
        description: 'บริการจัดส่งสินค้าถึงมือคุณภายใน 1-2 วันทำการ',
      },
      {
        icon: 'CubeIcon',
        title: 'สินค้าครบครัน',
        description: 'มีสินค้ามากกว่า 10,000 รายการ',
      },
      {
        icon: 'ShieldCheckIcon',
        title: 'สินค้าคุณภาพ',
        description: 'สินค้าทุกชิ้นผ่านการรับรองมาตรฐาน อย.',
      },
      {
        icon: 'DevicePhoneMobileIcon',
        title: 'แอปพลิเคชันมือถือ',
        description: 'ดาวน์โหลดแอป WangPharma เพื่อสั่งซื้อสินค้าได้ง่ายๆ',
      },
      {
        icon: 'UserGroupIcon',
        title: 'ทีมงานมืออาชีพ',
        description: 'ทีมเภสัชกรและพนักงานพร้อมให้คำปรึกษา',
      },
    ]),
    config_type: ConfigType.JSON,
    description: 'รายการบริการ (JSON array)',
    category: 'services',
  },
  // Payment Methods
  {
    config_key: 'payment_methods',
    config_value: JSON.stringify([
      { name: 'โอนเงินผ่านธนาคาร', icon: 'bank' },
      { name: 'บัตรเครดิต/เดบิต', icon: 'credit-card' },
      { name: 'พร้อมเพย์', icon: 'promptpay' },
      { name: 'เครดิต (สำหรับสมาชิก)', icon: 'credit' },
    ]),
    config_type: ConfigType.JSON,
    description: 'วิธีการชำระเงิน (JSON array)',
    category: 'payment',
  },
  // Stats
  {
    config_key: 'stats_years',
    config_value: '32',
    config_type: ConfigType.TEXT,
    description: 'จำนวนปีประสบการณ์',
    category: 'stats',
  },
  {
    config_key: 'stats_products',
    config_value: '10000',
    config_type: ConfigType.TEXT,
    description: 'จำนวนรายการสินค้า',
    category: 'stats',
  },
  {
    config_key: 'stats_delivery',
    config_value: '1-2 วัน',
    config_type: ConfigType.TEXT,
    description: 'ระยะเวลาจัดส่ง',
    category: 'stats',
  },
];

@Injectable()
export class SiteConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(SiteConfigEntity)
    private readonly configRepo: Repository<SiteConfigEntity>,
  ) {}

  // Initialize default configs on module start
  async onModuleInit() {
    for (const config of DEFAULT_CONFIGS) {
      const exists = await this.configRepo.findOne({
        where: { config_key: config.config_key },
      });
      if (!exists) {
        await this.configRepo.save(this.configRepo.create(config));
      }
    }
  }

  // Public: Get config by key
  async getConfig(key: string): Promise<string | null> {
    const config = await this.configRepo.findOne({
      where: { config_key: key },
    });
    return config?.config_value || null;
  }

  // Public: Get config as JSON
  async getConfigJson<T>(key: string): Promise<T | null> {
    const value = await this.getConfig(key);
    if (value) {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  // Public: Get configs by category
  async getConfigsByCategory(
    category: string,
  ): Promise<Record<string, string>> {
    const configs = await this.configRepo.find({
      where: { category },
    });

    const result: Record<string, string> = {};
    configs.forEach((config) => {
      result[config.config_key] = config.config_value;
    });
    return result;
  }

  // Public: Get all public configs
  async getAllPublicConfigs(): Promise<Record<string, any>> {
    const configs = await this.configRepo.find();

    const result: Record<string, any> = {};
    configs.forEach((config) => {
      if (config.config_type === ConfigType.JSON) {
        try {
          result[config.config_key] = JSON.parse(config.config_value);
        } catch {
          result[config.config_key] = config.config_value;
        }
      } else {
        result[config.config_key] = config.config_value;
      }
    });
    return result;
  }

  // Admin: Get all configs
  async getAllConfigs(): Promise<SiteConfigEntity[]> {
    return this.configRepo.find({
      order: { category: 'ASC', config_key: 'ASC' },
    });
  }

  // Admin: Get config entity by key
  async getConfigEntity(key: string): Promise<SiteConfigEntity | null> {
    return this.configRepo.findOne({ where: { config_key: key } });
  }

  // Admin: Update config
  async updateConfig(
    key: string,
    value: string,
    type?: ConfigType,
  ): Promise<SiteConfigEntity> {
    const config = await this.configRepo.findOne({
      where: { config_key: key },
    });

    if (config) {
      config.config_value = value;
      if (type) {
        config.config_type = type;
      }
      return this.configRepo.save(config);
    }

    // Create new config if not exists
    return this.configRepo.save(
      this.configRepo.create({
        config_key: key,
        config_value: value,
        config_type: type || ConfigType.TEXT,
      }),
    );
  }

  // Admin: Create config
  async createConfig(
    data: Partial<SiteConfigEntity>,
  ): Promise<SiteConfigEntity> {
    const config = this.configRepo.create(data);
    return this.configRepo.save(config);
  }

  // Admin: Delete config
  async deleteConfig(key: string): Promise<void> {
    await this.configRepo.delete({ config_key: key });
  }
}
