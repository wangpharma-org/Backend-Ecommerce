import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteConfigEntity, ConfigType } from './site-config.entity';

// Interface definitions for site config values
interface PaymentMethod {
  icon: string;
  title: string;
  description: string;
  note: string;
}

interface Service {
  icon: string;
  title: string;
  description: string;
}

interface DownloadButton {
  label: string;
  url: string;
  icon: string;
  sublabel: string;
}

interface AppDownloadSection {
  title: string;
  description: string;
  subtitle: string;
  buttons: DownloadButton[];
}

interface BankAccount {
  name: string;
  number: string;
  logo: string;
  bgColor: string;
  textColor: string;
  color: 'green' | 'blue' | 'purple' | 'orange' | 'yellow' | 'red';
}

interface FiledBanks {
  title: string;
  accounts: BankAccount[];
  accountName: string;
}

interface Policy {
  icon: string;
  title: string;
  description: string;
  link: string;
}

interface HeroSection {
  title: string;
  subtitle: string;
  stats: {
    years: string;
    yearsLabel: string;
    description: string;
  };
}

interface PaymentMethodsSection {
  title: string;
  subtitle: string;
  methods: PaymentMethod[];
}

// Union type for all possible config values
type ConfigValueType =
  | string
  | string[]
  | Service[]
  | Policy[]
  | PaymentMethodsSection
  | HeroSection
  | AppDownloadSection
  | FiledBanks;

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
    config_value: JSON.stringify({
      title: 'วิธีชำระเงิน',
      subtitle: 'เรารับชำระเงินหลากหลายช่องทาง เพื่อความสะดวกของลูกค้า',
      methods: [
        {
          icon: 'credit-card',
          title: 'เช็ค',
          description: 'ชำระด้วยเช็คธนาคาร สั่งจ่าย บจก. วังเภสัชฟาร์มาซูติคอล',
          note: 'วันที่เช็คล่วงหน้าไม่เกิน 30 วัน',
        },
        {
          icon: 'building-library',
          title: 'โอนเงิน',
          description: 'โอนเงินผ่านธนาคาร กสิกรไทย, กรุงเทพ, ไทยพาณิชย์',
          note: 'แจ้งหลักฐานการโอนเงินภายใน 24 ชั่วโมง',
        },
        {
          icon: 'banknotes',
          title: 'เงินสด',
          description: 'ชำระเงินสดเมื่อรับสินค้า (COD)',
          note: 'เฉพาะเขตพื้นที่ที่กำหนด',
        },
      ],
    }),
    config_type: ConfigType.JSON,
    description: 'วิธีการชำระเงิน (JSON object)',
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
  {
    config_key: 'filedbanks',
    config_value: JSON.stringify({
      title: 'บัญชีธนาคารสำหรับโอนเงิน',
      accounts: [
        {
          name: 'ธนาคารกสิกรไทย',
          number: 'xxx-x-xxxxx-x',
          logo: 'https://www.dpa.or.th/storage/uploads/bank/dpa_bank_kbank@2x.png',
          bgColor: '#f0fdf4',
          textColor: '#16a34a',
          color: 'green',
        },
        {
          name: 'ธนาคารกรุงเทพ',
          number: 'xxx-x-xxxxx-x',
          logo: 'https://th1-cdn.pgimgs.com/agent/900168945/APHO.130978972.R550X550.png',
          bgColor: '#eff6ff',
          textColor: '#2563eb',
          color: 'blue',
        },
        {
          name: 'ธนาคารไทยพาณิชย์',
          number: 'xxx-x-xxxxx-x',
          logo: 'https://www.dpa.or.th/storage/uploads/bank/dpa_bank_sb@2x.png',
          bgColor: '#faf5ff',
          textColor: '#9333ea',
          color: 'purple',
        },
      ],
      accountName: 'บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด',
    }),
    config_type: ConfigType.JSON,
    description: 'ข้อมูลบัญชีธนาคารสำหรับโอนเงิน (JSON object)',
    category: 'payment',
  },
  {
    config_key: 'app_download_section',
    config_value: JSON.stringify({
      title: 'สั่งจองสินค้า ยา และ\nเวชภัณฑ์ ได้ง่ายๆ\nตลอด 24 ชั่วโมง',
      description:
        'สำหรับร้านขายยา คลินิก สถานพยาบาล ที่มีใบอนุญาต และ\nโรงพยาบาลทั่วประเทศ',
      subtitle: 'แอปพลิเคชัน WangPharma',
      buttons: [
        {
          label: 'App Store',
          url: 'https://apps.apple.com/th/app/wangpharma/id1589145660',
          icon: 'appstore',
          sublabel: 'ดาวน์โหลดบน',
        },
        {
          label: 'Google Play',
          url: 'https://play.google.com/store/apps/details?id=com.wangpharma.wangshop_new&hl=th',
          icon: 'googleplay',
          sublabel: 'ดาวน์โหลดบน',
        },
      ],
    }),
    config_type: ConfigType.JSON,
    description: 'ส่วนดาวน์โหลดแอป WangPharma (JSON object)',
    category: 'app',
  },
  {
    config_key: 'policies',
    config_value: JSON.stringify([
      {
        icon: 'TruckIcon',
        title: 'นโยบายการจัดส่ง',
        description:
          'จัดส่งทั่วประเทศภายใน 1-2 วันทำการ ฟรีค่าจัดส่งเมื่อสั่งซื้อขั้นต่ำ 3,000 บาท',
        link: '/policy-delivery',
      },
      {
        icon: 'ArrowPathIcon',
        title: 'นโยบายการคืนสินค้า',
        description:
          'รับคืนสินค้าภายใน 7 วัน กรณีสินค้าชำรุดหรือไม่ตรงตามที่สั่ง',
        link: '/policy-return',
      },
      {
        icon: 'QuestionMarkCircleIcon',
        title: 'ศูนย์ช่วยเหลือ',
        description: 'ทีมงานพร้อมตอบคำถามและช่วยเหลือคุณตลอดเวลาทำการ',
        link: '/help',
      },
      {
        icon: 'DocumentTextIcon',
        title: 'ข้อตกลงและเงื่อนไข',
        description: 'เงื่อนไขการใช้บริการและข้อตกลงต่างๆ สำหรับลูกค้า',
        link: '/terms',
      },
      {
        icon: 'ShieldCheckIcon',
        title: 'นโยบายความเป็นส่วนตัว',
        description: 'เราให้ความสำคัญกับความเป็นส่วนตัวและข้อมูลของคุณ',
        link: '/privacy',
      },
      {
        icon: 'PhoneIcon',
        title: 'ติดต่อฝ่ายขาย',
        description:
          'ติดต่อทีมขายโดยตรง โทร 074-366681-5 หรือ Line: @wangpharma',
        link: '#contact',
      },
    ]),
    config_type: ConfigType.JSON,
    description: 'ข้อมูลนโยบายและลิงก์ช่วยเหลือ (JSON array)',
    category: 'policy',
  },
  {
    config_key: 'line',
    config_value: '@wangpharma',
    config_type: ConfigType.TEXT,
    description: 'ข้อมูลการติดต่อผ่าน Line',
    category: 'contact',
  },
  {
    config_key: 'office_days',
    config_value: 'จันทร์ - อาทิตย์',
    config_type: ConfigType.TEXT,
    description: 'ข้อมูลวันทำการของสำนักงาน',
    category: 'contact',
  },
  {
    config_key: 'office_hours',
    config_value: '08:00 - 18:00 น.',
    config_type: ConfigType.TEXT,
    description: 'ข้อมูลเวลาทำการของสำนักงาน',
    category: 'contact',
  },
  {
    config_key: 'response_time',
    config_value: '30 นาที',
    config_type: ConfigType.TEXT,
    description: 'ข้อมูลเวลาตอบกลับของสำนักงาน',
    category: 'contact',
  },
  {
    config_key: 'hero_section',
    config_value: JSON.stringify({
      title: 'วังเภสัช',
      subtitle: 'ผู้นำด้านการจัดจำหน่ายเวชภัณฑ์ในภาคใต้',
      stats: {
        years: '32+',
        yearsLabel: 'ปี',
        description: 'ประสบการณ์ในธุรกิจ\nเวชภัณฑ์และเวชสำอาง',
      },
    }),
    config_type: ConfigType.JSON,
    description: 'ข้อมูล Hero Section หน้าแรก (JSON object)',
    category: 'hero',
  },
  {
    config_key: 'button_links',
    config_value: JSON.stringify([
      {
        image:
          'https://wang-storage.sgp1.digitaloceanspaces.com/banners/1771059632182-exlsy7-traditional.png',
        title: 'ยาแผนโบราณ',
        description: 'ยาสมุนไพรและยาแผนโบราณ',
        href: '/login',
      },
      {
        image:
          'https://wang-storage.sgp1.digitaloceanspaces.com/banners/1771059647418-33vdc5-promotion.png',
        title: 'โปรโมชั่น',
        description: 'สินค้าลดราคาพิเศษ',
        href: '/login',
      },
      {
        image:
          'https://wang-storage.sgp1.digitaloceanspaces.com/banners/1771059663191-ml29e8-packing.png',
        title: 'บรรจุเสร็จ',
        description: 'ยาแผนปัจจุบัน',
        href: '/login',
      },
      {
        image:
          'https://wang-storage.sgp1.digitaloceanspaces.com/banners/1771059683154-n2exab-household.png',
        title: 'ประจำบ้าน',
        description: 'ยาสามัญประจำบ้าน',
        href: '/login',
      },
      {
        image:
          'https://wang-storage.sgp1.digitaloceanspaces.com/banners/1771059695015-vlegzb-free.png',
        title: 'ของแถม',
        description: 'สินค้าพร้อมของแถม',
        href: '/login',
      },
      {
        image:
          'https://wang-storage.sgp1.digitaloceanspaces.com/banners/1771059705663-7txays-equipment.png',
        title: 'เครื่องมือแพทย์',
        description: 'อุปกรณ์การแพทย์',
        href: '/login',
      },
    ]),
    config_type: ConfigType.JSON,
    description: 'ข้อมูลปุ่มลิงก์ (JSON object)',
    category: 'button',
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
  async getAllPublicConfigs(): Promise<
    Record<string, { value: ConfigValueType; hidden: boolean }>
  > {
    const configs = await this.configRepo.find();

    const result: Record<string, { value: ConfigValueType; hidden: boolean }> =
      {};
    configs.forEach((config) => {
      let value: ConfigValueType;
      if (config.config_type === ConfigType.JSON) {
        try {
          value = JSON.parse(config.config_value) as ConfigValueType;
        } catch {
          value = config.config_value;
        }
      } else {
        value = config.config_value;
      }

      result[config.config_key] = {
        value,
        hidden: config.hidden,
      };
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
    hidden: boolean,
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
      config.hidden = hidden;
      return this.configRepo.save(config);
    }

    // Create new config if not exists
    return this.configRepo.save(
      this.configRepo.create({
        config_key: key,
        config_value: value,
        config_type: type || ConfigType.TEXT,
        hidden: hidden,
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
