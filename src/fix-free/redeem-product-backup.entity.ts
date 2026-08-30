import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'redeem_product_backup' })
export class RedeemProductBackupEntity {
  @PrimaryColumn({ type: 'varchar', length: 20, name: 'redeem_product_code' })
  redeemProductCode!: string;

  @Column({ type: 'varchar', length: 20, name: 'backup_product_code' })
  backupProductCode!: string;
}
