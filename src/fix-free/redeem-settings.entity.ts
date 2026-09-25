import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'redeem_settings' })
export class RedeemSettingsEntity {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id!: number;

  @Column({ type: 'int', unsigned: true, name: 'display_limit', default: 50 })
  displayLimit!: number;
}
