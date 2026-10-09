import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Release 1.48.0 — รวม migration ของ release นี้ไว้ไฟล์เดียว
 *
 * คัดลอกมาจากไฟล์เดิมทุกบรรทัด (SQL, เงื่อนไข hasColumn/hasIndex, ข้อมูลตั้งต้น) ไม่ได้ generate ใหม่
 * แต่ละไฟล์เดิมเป็น method คู่ up/down ตามชื่อด้านล่าง — up รันตามลำดับเดิม, down ย้อนกลับ
 *
 *  1. 20260823000100-add-product-type            (ECWC-444)
 *  2. 20260825000100-create-product-label-rules  (ECWC-433)
 *  3. 20260826000100-add-redeem-product-settings
 *  4. 20260829000100-add-product-label-match-type (ECWC-433)
 *  5. 20260830000100-create-redeem-set-settings
 *  6. 20260831000100-add-redeem-visibility-status
 *  7. 20260906000100-create-special-collection   (ECWC-496)
 *  8. 20260906000200-create-bundle-set           (ECWC-496)
 *  9. 20260906000300-create-cart-basket          (ECWC-496)
 * 10. 20260906000400-add-fixed-price-to-cart     (ECWC-496)
 * 11. 20260907000100-add-promo-id-to-banner      (ECWC-532)
 * 12. 20260913000100-add-discount-to-shopping-order (ECWC-567)
 * 13. 20260914000100-park-bundle-set-admin       (ECWC-571)
 */
export class Release1480_20260918000100 implements MigrationInterface {
  name = 'Release1480_20260918000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.upAddProductType(queryRunner);
    await this.upCreateProductLabelRules(queryRunner);
    await this.upAddRedeemProductSettings(queryRunner);
    await this.upAddProductLabelMatchType(queryRunner);
    await this.upCreateRedeemSetSettings(queryRunner);
    await this.upAddRedeemVisibilityStatus(queryRunner);
    await this.upCreateSpecialCollection(queryRunner);
    await this.upCreateBundleSet(queryRunner);
    await this.upCreateCartBasket(queryRunner);
    await this.upAddFixedPriceToCart(queryRunner);
    await this.upAddPromoIdToBanner(queryRunner);
    await this.upAddDiscountToShoppingOrder(queryRunner);
    await this.upParkBundleSetAdmin(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.downParkBundleSetAdmin(queryRunner);
    await this.downAddDiscountToShoppingOrder(queryRunner);
    await this.downAddPromoIdToBanner(queryRunner);
    await this.downAddFixedPriceToCart(queryRunner);
    await this.downCreateCartBasket(queryRunner);
    await this.downCreateBundleSet(queryRunner);
    await this.downCreateSpecialCollection(queryRunner);
    await this.downAddRedeemVisibilityStatus(queryRunner);
    await this.downCreateRedeemSetSettings(queryRunner);
    await this.downAddProductLabelMatchType(queryRunner);
    await this.downAddRedeemProductSettings(queryRunner);
    await this.downCreateProductLabelRules(queryRunner);
    await this.downAddProductType(queryRunner);
  }

  private async hasProductIndex(
    queryRunner: QueryRunner,
    indexName: string,
  ): Promise<boolean> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND INDEX_NAME = ?`,
      [indexName],
    )) as { total: number | string }[];
    return Number(rows[0]?.total ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // 1. 20260823000100-add-product-type
  // ECWC-444 — คอลัมน์ระบุประเภทสินค้า '00' = สินค้าแลกแต้ม, '01' = สินค้าขายปกติ
  // ---------------------------------------------------------------------------
  private async upAddProductType(queryRunner: QueryRunner): Promise<void> {
    // env ที่เปิด SYNCHRONIZE=true อาจมีคอลัมน์อยู่แล้วจาก entity
    if (!(await queryRunner.hasColumn('product', 'product_type'))) {
      await queryRunner.query(
        "ALTER TABLE `product` ADD COLUMN `product_type` varchar(10) NOT NULL DEFAULT '01'",
      );
    }

    // ไม่ backfill — ทุกแถวเป็น '01' ไปก่อน ค่อยมาเซ็ต '00' ทีหลัง

    if (!(await this.hasProductIndex(queryRunner, 'IDX_product_redeem'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_redeem` ON `product` (`product_type`, `pro_point`, `pro_stock`)',
      );
    }
    if (!(await this.hasProductIndex(queryRunner, 'IDX_product_free_redeem'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_free_redeem` ON `product` (`pro_free`, `pro_point`, `pro_stock`)',
      );
    }
  }

  private async downAddProductType(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasProductIndex(queryRunner, 'IDX_product_free_redeem')) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_free_redeem` ON `product`',
      );
    }
    if (await this.hasProductIndex(queryRunner, 'IDX_product_redeem')) {
      await queryRunner.query('DROP INDEX `IDX_product_redeem` ON `product`');
    }
    if (await queryRunner.hasColumn('product', 'product_type')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `product_type`',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 20260825000100-create-product-label-rules
  // ---------------------------------------------------------------------------
  private async upCreateProductLabelRules(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`product_label_rules\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`label\` varchar(100) NOT NULL,
        \`keyword\` varchar(255) NOT NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_product_label_rules_keyword\` (\`keyword\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async downCreateProductLabelRules(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query('DROP TABLE `product_label_rules`');
  }

  // ---------------------------------------------------------------------------
  // 3. 20260826000100-add-redeem-product-settings
  // ---------------------------------------------------------------------------
  private async upAddRedeemProductSettings(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (
      !(await queryRunner.hasColumn('product', 'pro_redeem_display_quantity'))
    ) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_display_quantity` int NULL DEFAULT NULL',
      );
    }
    if (!(await queryRunner.hasColumn('product', 'pro_redeem_rank'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_rank` int NULL DEFAULT NULL',
      );
    }
    if (
      !(await this.hasProductIndex(queryRunner, 'IDX_product_redeem_supplier'))
    ) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_redeem_supplier` ON `product` (`pro_supplier`, `pro_point`, `pro_stock`)',
      );
    }
    if (!(await this.hasProductIndex(queryRunner, 'IDX_product_redeem_rank'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_product_redeem_rank` ON `product` (`pro_redeem_rank`)',
      );
    }
  }

  private async downAddRedeemProductSettings(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (await this.hasProductIndex(queryRunner, 'IDX_product_redeem_rank')) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_redeem_rank` ON `product`',
      );
    }
    if (
      await this.hasProductIndex(queryRunner, 'IDX_product_redeem_supplier')
    ) {
      await queryRunner.query(
        'DROP INDEX `IDX_product_redeem_supplier` ON `product`',
      );
    }
    if (await queryRunner.hasColumn('product', 'pro_redeem_rank')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_rank`',
      );
    }
    if (await queryRunner.hasColumn('product', 'pro_redeem_display_quantity')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_display_quantity`',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 4. 20260829000100-add-product-label-match-type
  // ---------------------------------------------------------------------------
  private async upAddProductLabelMatchType(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`product_label_rules\`
      ADD COLUMN \`matchType\` varchar(20) NOT NULL DEFAULT 'contains' AFTER \`keyword\`
    `);
  }

  private async downAddProductLabelMatchType(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`product_label_rules\`
      DROP COLUMN \`matchType\`
    `);
  }

  // ---------------------------------------------------------------------------
  // 5. 20260830000100-create-redeem-set-settings
  // ---------------------------------------------------------------------------
  private async upCreateRedeemSetSettings(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`redeem_settings\` (
        \`id\` tinyint unsigned NOT NULL,
        \`display_limit\` int unsigned NOT NULL DEFAULT 50,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`CHK_redeem_settings_display_limit\` CHECK (\`display_limit\` > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(
      'INSERT INTO `redeem_settings` (`id`, `display_limit`) VALUES (1, 50)',
    );
    await queryRunner.query(`
      CREATE TABLE \`redeem_product_backup\` (
        \`redeem_product_code\` varchar(20) NOT NULL,
        \`backup_product_code\` varchar(20) NOT NULL,
        PRIMARY KEY (\`redeem_product_code\`),
        KEY \`IDX_redeem_product_backup_code\` (\`backup_product_code\`),
        CONSTRAINT \`FK_redeem_product_backup_primary\`
          FOREIGN KEY (\`redeem_product_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`FK_redeem_product_backup_backup\`
          FOREIGN KEY (\`backup_product_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async downCreateRedeemSetSettings(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query('DROP TABLE `redeem_product_backup`');
    await queryRunner.query('DROP TABLE `redeem_settings`');
  }

  // ---------------------------------------------------------------------------
  // 6. 20260831000100-add-redeem-visibility-status
  // ---------------------------------------------------------------------------
  private async upAddRedeemVisibilityStatus(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn('product', 'pro_redeem_hidden'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_hidden` tinyint NOT NULL DEFAULT 0',
      );
    }
    if (!(await queryRunner.hasColumn('product', 'pro_redeem_coming_soon'))) {
      await queryRunner.query(
        'ALTER TABLE `product` ADD COLUMN `pro_redeem_coming_soon` tinyint NOT NULL DEFAULT 0',
      );
    }

    await queryRunner.query(
      'ALTER TABLE `redeem_product_backup` ADD UNIQUE INDEX `UQ_redeem_product_backup_code` (`backup_product_code`)',
    );
  }

  private async downAddRedeemVisibilityStatus(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `redeem_product_backup` DROP INDEX `UQ_redeem_product_backup_code`',
    );
    if (await queryRunner.hasColumn('product', 'pro_redeem_coming_soon')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_coming_soon`',
      );
    }
    if (await queryRunner.hasColumn('product', 'pro_redeem_hidden')) {
      await queryRunner.query(
        'ALTER TABLE `product` DROP COLUMN `pro_redeem_hidden`',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 7. 20260906000100-create-special-collection
  // ---------------------------------------------------------------------------
  private async upCreateSpecialCollection(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`special_collection\` (
        \`collection_id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(200) NOT NULL,
        \`description\` varchar(500) NULL,
        \`status\` tinyint NOT NULL DEFAULT 0,
        \`start_date\` datetime NULL,
        \`end_date\` datetime NULL,
        \`audience_scope\` varchar(10) NOT NULL DEFAULT 'all',
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`deleted_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`collection_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`special_collection_item\` (
        \`item_id\` int NOT NULL AUTO_INCREMENT,
        \`collection_id\` int NOT NULL,
        \`ref_type\` varchar(20) NOT NULL,
        \`ref_id\` varchar(50) NOT NULL,
        \`title_override\` varchar(200) NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`item_id\`),
        KEY \`IDX_special_collection_item_order\` (\`collection_id\`, \`sort_order\`),
        KEY \`IDX_special_collection_item_ref\` (\`ref_type\`, \`ref_id\`),
        CONSTRAINT \`FK_special_collection_item_collection\`
          FOREIGN KEY (\`collection_id\`) REFERENCES \`special_collection\` (\`collection_id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`special_collection_audience\` (
        \`audience_id\` int NOT NULL AUTO_INCREMENT,
        \`collection_id\` int NOT NULL,
        \`mem_code\` varchar(30) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`audience_id\`),
        UNIQUE KEY \`UQ_special_collection_audience\` (\`collection_id\`, \`mem_code\`),
        KEY \`IDX_special_collection_audience_mem\` (\`mem_code\`),
        CONSTRAINT \`FK_special_collection_audience_collection\`
          FOREIGN KEY (\`collection_id\`) REFERENCES \`special_collection\` (\`collection_id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async downCreateSpecialCollection(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query('DROP TABLE `special_collection_audience`');
    await queryRunner.query('DROP TABLE `special_collection_item`');
    await queryRunner.query('DROP TABLE `special_collection`');
  }

  // ---------------------------------------------------------------------------
  // 8. 20260906000200-create-bundle-set
  // ---------------------------------------------------------------------------
  private async upCreateBundleSet(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`bundle_set\` (
        \`set_code\` varchar(30) NOT NULL,
        \`set_name\` varchar(200) NOT NULL,
        \`description\` varchar(500) NULL,
        \`price\` decimal(16,2) NOT NULL,
        \`image\` varchar(500) NULL,
        \`status\` tinyint NOT NULL DEFAULT 0,
        \`start_date\` datetime NULL,
        \`end_date\` datetime NULL,
        \`promo_id\` int NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`deleted_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`set_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`bundle_set_item\` (
        \`item_id\` int NOT NULL AUTO_INCREMENT,
        \`set_code\` varchar(30) NOT NULL,
        \`pro_code\` varchar(20) NOT NULL,
        \`unit_level\` int NOT NULL DEFAULT 1,
        \`qty\` int NOT NULL,
        \`is_gift\` tinyint NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`item_id\`),
        KEY \`IDX_bundle_set_item_order\` (\`set_code\`, \`sort_order\`),
        KEY \`IDX_bundle_set_item_product\` (\`pro_code\`),
        CONSTRAINT \`FK_bundle_set_item_set\`
          FOREIGN KEY (\`set_code\`) REFERENCES \`bundle_set\` (\`set_code\`)
          ON DELETE CASCADE,
        CONSTRAINT \`FK_bundle_set_item_product\`
          FOREIGN KEY (\`pro_code\`) REFERENCES \`product\` (\`pro_code\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async downCreateBundleSet(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `bundle_set_item`');
    await queryRunner.query('DROP TABLE `bundle_set`');
  }

  // ---------------------------------------------------------------------------
  // 9. 20260906000300-create-cart-basket
  // ---------------------------------------------------------------------------
  private async upCreateCartBasket(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`cart_basket\` (
        \`basket_id\` int NOT NULL AUTO_INCREMENT,
        \`mem_code\` varchar(30) NOT NULL,
        \`promo_id\` int NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`basket_id\`),
        KEY \`IDX_cart_basket_member\` (\`mem_code\`),
        KEY \`IDX_cart_basket_promo\` (\`promo_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ตั้งใจไม่ผูก FOREIGN KEY กับ shopping_cart — ตารางนั้นใหญ่มากบน production
    // การเพิ่ม FK ต้อง scan ทั้งตารางและล็อกยาว จัดการ cascade ในโค้ดแทน
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` ADD COLUMN `basket_id` int NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` ADD INDEX `IDX_shopping_cart_basket` (`basket_id`)',
    );
  }

  private async downCreateCartBasket(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` DROP INDEX `IDX_shopping_cart_basket`',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` DROP COLUMN `basket_id`',
    );
    await queryRunner.query('DROP TABLE `cart_basket`');
  }

  // ---------------------------------------------------------------------------
  // 10. 20260906000400-add-fixed-price-to-cart
  // กระเช้าสำเร็จรูป (bundle_set) เข้าตะกร้า — ทาง A
  // shopping_cart ไม่เคยเก็บราคา ทุกจุดคิดจาก product.pro_priceA/B/C
  // เพิ่มราคารวมต่อบรรทัดที่ล็อกไว้ (null = คิดราคาปกติ) และให้ cart_basket ชี้ set ได้
  // ---------------------------------------------------------------------------
  private async upAddFixedPriceToCart(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` ADD COLUMN `spc_fixed_total` decimal(16,2) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `cart_basket` MODIFY COLUMN `promo_id` int NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `cart_basket` ADD COLUMN `set_code` varchar(30) NULL DEFAULT NULL, ADD COLUMN `set_qty` int NULL DEFAULT NULL',
    );
  }

  private async downAddFixedPriceToCart(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `cart_basket` DROP COLUMN `set_qty`, DROP COLUMN `set_code`',
    );
    await queryRunner.query(
      'ALTER TABLE `cart_basket` MODIFY COLUMN `promo_id` int NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_cart` DROP COLUMN `spc_fixed_total`',
    );
  }

  // ---------------------------------------------------------------------------
  // 11. 20260907000100-add-promo-id-to-banner
  // ECWC-532 — แบนเนอร์รูปใหญ่ผูกกับโปรโมชั่นได้ เพื่อมีปุ่ม "สรุปโปร" เปิด modal
  // null = แบนเนอร์ธรรมดาเหมือนเดิม ไม่ผูก FK เพราะ promotion ใช้ soft delete
  // ---------------------------------------------------------------------------
  private async upAddPromoIdToBanner(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `banner` ADD COLUMN `promo_id` int NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `banner` ADD INDEX `IDX_banner_promo` (`promo_id`)',
    );
  }

  private async downAddPromoIdToBanner(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `banner` DROP INDEX `IDX_banner_promo`',
    );
    await queryRunner.query('ALTER TABLE `banner` DROP COLUMN `promo_id`');
  }

  // ---------------------------------------------------------------------------
  // 12. 20260913000100-add-discount-to-shopping-order
  // ECWC-567 — บรรทัดออเดอร์ต้องบอก "ราคาปกติ" กับ "ส่วนลด" แยกกัน
  //
  // บิลที่ส่งลูกค้าต้องตรงกับบิลที่คีย์เข้าระบบบัญชี ซึ่งเก็บได้แค่
  // รหัสสินค้า / ชื่อสินค้า / ส่วนลด / มูลค่าสินค้า จึงเฉลี่ยราคาลงบรรทัดไม่ได้
  // ของเดิมกระเช้าสำเร็จรูปยัดส่วนลดลงไปใน spo_price_unit ทำให้ปลายทางไม่มีทาง
  // รู้ราคาจริงและส่วนลด ส่วนของแถมส่ง 0/0 แล้วให้ปลายทางเดาเอาว่าลด 100%
  //
  // เพิ่มสองคอลัมน์แบบไม่แตะของเดิม เพื่อให้ย้ายทีละฝั่งได้ ไม่ต้อง deploy พร้อมกัน
  // ปลายทางอ่านของเดิมต่อไปได้จนกว่าจะพร้อมย้ายมาอ่านสองตัวนี้
  // ---------------------------------------------------------------------------
  private async upAddDiscountToShoppingOrder(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_order` ADD COLUMN `spo_price_list` decimal(16,2) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_order` ADD COLUMN `spo_discount` decimal(5,2) NULL DEFAULT NULL',
    );
  }

  private async downAddDiscountToShoppingOrder(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `shopping_order` DROP COLUMN `spo_discount`',
    );
    await queryRunner.query(
      'ALTER TABLE `shopping_order` DROP COLUMN `spo_price_list`',
    );
  }

  // ---------------------------------------------------------------------------
  // 13. 20260914000100-park-bundle-set-admin
  // ECWC-571 — พักกระเช้าสำเร็จรูปไว้ก่อน
  //
  // ยังไม่เคาะสองเรื่อง: ราคาชุดเดียวแต่ระบบมีราคา 3 เกรด (ร้านเกรด A อาจจ่าย
  // แพงกว่าซื้อแยกชิ้นโดยไม่มีใครรู้) และวิธีแสดงส่วนลดบนบิลที่คนคีย์เข้าบัญชี
  // อ่านแล้วไม่สับสน จนกว่าจะจบสองเรื่องนี้ แอดมินไม่ควรสร้างกระเช้าได้
  //
  // ต้อง seed แถวนี้ให้เป็น false เอง เพราะ FeatureFlagsService.getFlag
  // สร้าง key ที่ยังไม่มีให้อัตโนมัติด้วย is_enabled = true — ถ้าไม่ seed
  // แท็บจะโผล่บน production ทันทีที่ deploy
  // ---------------------------------------------------------------------------
  private async upParkBundleSetAdmin(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `feature_flag` (`feature_key`, `is_enabled`) SELECT 'bundle_set_admin', 0 WHERE NOT EXISTS (SELECT 1 FROM `feature_flag` WHERE `feature_key` = 'bundle_set_admin')",
    );
  }

  private async downParkBundleSetAdmin(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'bundle_set_admin'",
    );
  }
}
