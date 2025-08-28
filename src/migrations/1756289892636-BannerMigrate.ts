import { MigrationInterface, QueryRunner } from 'typeorm';

export class BannerMigrate1756289892636 implements MigrationInterface {
  name = 'BannerMigrate1756289892636';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`Banner\` (\`banner_id\` int NOT NULL AUTO_INCREMENT, \`banner_image\` varchar(255) NOT NULL, \`date_start\` datetime NULL, \`date_end\` datetime NULL, PRIMARY KEY (\`banner_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD \`emp_id\` int NOT NULL PRIMARY KEY AUTO_INCREMENT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD \`emp_code\` varchar(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD UNIQUE INDEX \`IDX_1cc7222a8989498776679032f3\` (\`emp_code\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD \`emp_firstname\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD \`emp_lastname\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD \`emp_moblie\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` ADD \`emp_img_path\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`emp_id_ref\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_e2cbeba6e20627b1aad7cc39e63\` FOREIGN KEY (\`emp_id_ref\`) REFERENCES \`employee\`(\`emp_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_e2cbeba6e20627b1aad7cc39e63\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`emp_id_ref\``);
    await queryRunner.query(
      `ALTER TABLE \`employee\` DROP COLUMN \`emp_img_path\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` DROP COLUMN \`emp_moblie\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` DROP COLUMN \`emp_lastname\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` DROP COLUMN \`emp_firstname\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` DROP INDEX \`IDX_1cc7222a8989498776679032f3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee\` DROP COLUMN \`emp_code\``,
    );
    await queryRunner.query(`ALTER TABLE \`employee\` DROP COLUMN \`emp_id\``);
    await queryRunner.query(`DROP TABLE \`Banner\``);
  }
}
