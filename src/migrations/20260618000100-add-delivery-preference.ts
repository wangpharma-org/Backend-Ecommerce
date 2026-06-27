import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryPreference20260618000100 implements MigrationInterface {
  name = 'AddDeliveryPreference20260618000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `feature_flag` (`feature_key`, `is_enabled`) VALUES ('delivery_preference_hatyai', false)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `feature_flag` WHERE `feature_key` = 'delivery_preference_hatyai'",
    );
  }
}
