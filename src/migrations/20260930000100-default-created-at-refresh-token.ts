import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultCreatedAtRefreshToken20260930000100
  implements MigrationInterface
{
  name = 'DefaultCreatedAtRefreshToken20260930000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // @CreateDateColumn ให้ TypeORM ส่ง `DEFAULT` ตอน INSERT แต่คอลัมน์เดิมไม่มี default → ได้ NULL ทุกแถว
    // ยังคง NULL ได้เพื่อไม่แตะ record เดิม (cron cleanup ข้าม record ที่เป็น null)
    await queryRunner.query(
      `ALTER TABLE \`reflesh-token\` MODIFY \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`reflesh-token\` MODIFY \`created_at\` timestamp NULL`,
    );
  }
}
