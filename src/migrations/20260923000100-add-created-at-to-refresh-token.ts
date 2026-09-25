import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedAtToRefreshToken20260923000100
  implements MigrationInterface
{
  name = 'AddCreatedAtToRefreshToken20260923000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // NULL ไม่มี default — record เดิมก่อน migration นี้จะเป็น null ตามที่ตกลงกัน (เคลียร์เองภายหลัง ไม่ใช่หน้าที่ cron)
    await queryRunner.query(
      `ALTER TABLE \`reflesh-token\` ADD \`created_at\` timestamp NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_refresh_token_created_at\` ON \`reflesh-token\` (\`created_at\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_refresh_token_created_at\` ON \`reflesh-token\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reflesh-token\` DROP COLUMN \`created_at\``,
    );
  }
}
