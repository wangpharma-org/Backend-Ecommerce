import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { UserEntity } from '../users/users.entity';

/// ผู้เรียกจาก JWT (เฉพาะช่องที่ใช้ตัดสินสิทธิ์)
export interface OrderAccessActor {
  mem_code?: string | null;
  permission?: boolean;
  role?: string | null;
}

export const ORDER_ACCESS_DENIED = 'ไม่มีสิทธิ์ดูคำสั่งจองของร้านนี้';

const norm = (v: unknown): string =>
  typeof v === 'string' ? v.trim().toUpperCase() : '';

/// ใครดูคำสั่งจอง/สถานะของร้านไหนได้ — ร้านดูได้เฉพาะของตัวเอง (mem_code จาก token ไม่ใช่จาก URL)
/// admin (permission) ดูได้ทุกร้าน · เซลล์ (role Sales) ดูได้เฉพาะร้านในความดูแล ตามกติกาเดียวกับ
/// preorder (users.emp_id_ref ของร้าน = emp_id_ref ของบัญชีเซลล์ หรือ mem_code ถ้าไม่ได้ผูก)
@Injectable()
export class OrderAccessService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadRepo: Repository<ShoppingHeadEntity>,
  ) {}

  /// 403 ถ้าผู้เรียกไม่มีสิทธิ์ดูร้าน memCode
  async assertShop(actor: OrderAccessActor, memCode: string): Promise<void> {
    const target = norm(memCode);
    if (!target) throw new ForbiddenException(ORDER_ACCESS_DENIED);
    if (norm(actor.mem_code) === target) return;
    if (actor.permission === true || actor.role === 'Admin') return;
    if (actor.role === 'Sales' && (await this.inSalesCare(actor, target))) {
      return;
    }
    throw new ForbiddenException(ORDER_ACCESS_DENIED);
  }

  /// 403 ถ้าบิลนี้เป็นของร้านอื่นที่ผู้เรียกไม่มีสิทธิ์ · คืน false เมื่อหาเจ้าของบิลในฐาน e-commerce
  /// ไม่เจอ (เช่น บิลที่คีย์จากระบบเดิม) ให้ผู้เรียกตัดสินเองว่าจะไปต่อหรือไม่
  async assertOrder(
    actor: OrderAccessActor,
    sohRunning: string,
  ): Promise<boolean> {
    // mem_code ของ shopping_head เป็นคอลัมน์ FK ของ relation member (ไม่มี property ตรง ๆ)
    const row = await this.shoppingHeadRepo
      .createQueryBuilder('head')
      .select('head.mem_code', 'owner')
      .where('head.soh_running = :sohRunning', { sohRunning })
      .getRawOne<{ owner: string | null }>();
    const owner = row?.owner;
    if (!owner) return false;
    await this.assertShop(actor, owner);
    return true;
  }

  private async inSalesCare(
    actor: OrderAccessActor,
    target: string,
  ): Promise<boolean> {
    const actorCode = (actor.mem_code ?? '').trim();
    if (!actorCode) return false;
    const [me, store] = await Promise.all([
      this.userRepo.findOne({
        where: { mem_code: actorCode },
        select: ['mem_code', 'emp_id_ref'],
      }),
      this.userRepo.findOne({
        where: { mem_code: target },
        select: ['mem_code', 'emp_id_ref'],
      }),
    ]);
    const salesCode = (me?.emp_id_ref ?? '').trim() || actorCode;
    return !!store && (store.emp_id_ref ?? '').trim() === salesCode;
  }
}
