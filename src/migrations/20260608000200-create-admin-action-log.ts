import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminActionLog20260608000200 implements MigrationInterface {
  name = 'CreateAdminActionLog20260608000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`admin_action_log\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`admin_mem_code\` varchar(255) NOT NULL,
        \`admin_username\` varchar(255) NOT NULL,
        \`target_mem_code\` varchar(255) NOT NULL,
        \`target_username\` varchar(255) NOT NULL,
        \`action_type\` varchar(50) NOT NULL,
        \`old_value\` text NULL,
        \`new_value\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_admin_action_log_admin_mem_code\` (\`admin_mem_code\`),
        INDEX \`IDX_admin_action_log_target_mem_code\` (\`target_mem_code\`),
        INDEX \`IDX_admin_action_log_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `admin_action_log`');
  }
}
