import { ProductEntity } from "src/products/products.entity";
import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class HotdealEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => ProductEntity, (product) => product.inHotdeals)
    @JoinColumn({ name: 'pro_code' })
    product: ProductEntity;

    @Column({ length: 20, default: '0' })
    pro1_amount: string;

    @Column({ length: 20, nullable: false })
    pro1_unit: string;

    @ManyToOne(() => ProductEntity, (product) => product.inHotdeals)
    @JoinColumn({ name: 'pro_code2' })
    product2: ProductEntity;

    @Column({ length: 20, default: '0' })
    pro2_amount: string;

    @Column({ length: 20, nullable: false })
    pro2_unit: string;
}