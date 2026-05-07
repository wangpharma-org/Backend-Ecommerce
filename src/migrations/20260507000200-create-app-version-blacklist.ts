import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppVersionBlacklist20260507000200 implements MigrationInterface {
  name = 'CreateAppVersionBlacklist20260507000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app_version_blacklist (
        id int NOT NULL AUTO_INCREMENT,
        platform enum ('android', 'ios') NOT NULL,
        version varchar(50) NOT NULL,
        message varchar(255) NOT NULL DEFAULT 'เวอร์ชันนี้ไม่รองรับ กรุณาอัปเดตแอป',
        storeUrl varchar(500) NOT NULL,
        isActive tinyint NOT NULL DEFAULT 1,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX UQ_app_version_blacklist_platform_version (platform, version),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE app_version_blacklist
    `);
  }
}
