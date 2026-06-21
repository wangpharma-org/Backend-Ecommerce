import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerDeliveryPreference20260618000200 implements MigrationInterface {
  name = 'CreateCustomerDeliveryPreference20260618000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`customer_delivery_preference\` (
        \`mem_code\` varchar(50) NOT NULL,
        \`preference\` varchar(30) NOT NULL,
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`mem_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `customer_delivery_preference`');
  }
}
