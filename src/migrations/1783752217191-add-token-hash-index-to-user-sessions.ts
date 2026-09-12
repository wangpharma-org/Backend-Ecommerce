import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenHashIndexToUserSessions1783752217191 implements MigrationInterface {
  name = 'AddTokenHashIndexToUserSessions1783752217191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user-sessions\` ADD \`token_hash\` varchar(64) NULL`,
    );
    // backfill ด้วย SHA2 ฝั่ง MySQL — ได้ hex lowercase ตรงกับ crypto.createHash('sha256').digest('hex')
    await queryRunner.query(
      `UPDATE \`user-sessions\` SET \`token_hash\` = SHA2(\`session_token\`, 256) WHERE \`token_hash\` IS NULL`,
    );
    // ไม่ใช้ unique index เพราะข้อมูลเดิมมี session_token ซ้ำ (ดู ECWC-381)
    await queryRunner.query(
      `CREATE INDEX \`idx_user_sessions_token_hash\` ON \`user-sessions\` (\`token_hash\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`idx_user_sessions_mem_active\` ON \`user-sessions\` (\`mem_code\`, \`is_active\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_user_sessions_mem_active\` ON \`user-sessions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_user_sessions_token_hash\` ON \`user-sessions\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user-sessions\` DROP COLUMN \`token_hash\``,
    );
  }
}
