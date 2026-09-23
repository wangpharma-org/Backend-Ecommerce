import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDhlTracking20260831000100 implements MigrationInterface {
  name = 'CreateDhlTracking20260831000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`dhl_tracking\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`soh_running\` varchar(60) NOT NULL,
        \`tracking_number\` varchar(120) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_dhl_tracking_order_number\` (\`soh_running\`, \`tracking_number\`),
        KEY \`IDX_dhl_tracking_soh_running\` (\`soh_running\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE \`dhl_tracking\`');
  }
}
