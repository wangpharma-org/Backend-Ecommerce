import {
  PreorderCampaignStatus,
  PreorderIncreasePolicy,
  PreorderMode,
} from './preorder-campaign.entity';
import { PreorderItemStatus } from './preorder-item.entity';
import { AllocationStrategy } from './preorder.allocation';

export interface PreorderActor {
  mem_code: string;
  username?: string;
  price_option?: string;
  permission?: boolean;
}

// ---------- customer ----------

export interface UpsertItemDto {
  amount: number;
  accept_terms?: boolean;
}

export interface QueueLotInfo {
  id: number;
  qty: number;
  ordered_at: Date;
  allocated_qty: number | null;
  /** ลำดับของล็อตนี้ในคิว (นับเป็นล็อต) */
  position: number;
  /** จำนวนรวมของทุกล็อตที่อยู่ก่อนหน้า */
  ahead_qty: number;
}

export interface QueueInfo {
  /** ลำดับคิวของร้าน = ลำดับของล็อตแรก (1 = คนแรก) */
  position: number;
  /** จำนวนรวมที่อยู่ก่อนหน้าล็อตแรกของร้าน */
  ahead_qty: number;
  /** จำนวนร้านทั้งหมดที่ยังจองอยู่ */
  total_members: number;
  /** ยอดจองรวมทั้งหมดที่ยังจองอยู่ */
  total_qty: number;
  /** ล็อตของร้านนี้ (ว่างถ้าไม่มีรายการ) */
  lots: QueueLotInfo[];
}

// ---------- admin ----------

export interface CreateCampaignDto {
  name: string;
  mode?: PreorderMode;
  starts_at?: string | null;
  ends_at?: string | null;
  detail_announcement?: string | null;
  breaking_announcement?: string | null;
  terms?: string | null;
  allow_cancel?: boolean;
  increase_policy?: PreorderIncreasePolicy;
  increase_grace_hours?: number | null;
}

export type UpdateCampaignDto = Partial<CreateCampaignDto>;

export interface SetCampaignStatusDto {
  status: PreorderCampaignStatus;
}

export interface AddProductDto {
  pro_code: string;
  note?: string | null;
  reason?: 'restock' | 'price_increase';
  /** ประเภทราคาตามนิยามผู้บริหาร (admin เท่านั้น) null = ไม่ระบุ */
  price_type?:
    | 'eng_chiu'
    | 'half_half'
    | 'old_price'
    | 'new_price'
    | 'discount'
    | 'pp'
    | null;
  new_price?: number | null;
  price_effective_date?: string | null;
  limit_per_member?: number | null;
  min_per_member?: number | null;
  pack_multiple?: number | null;
  supply_qty?: number | null;
  moq?: number | null;
  estimated_price?: number | null;
  price_tiers?: { min_total_qty: number; price: number }[] | null;
  eta_date?: string | null;
  sort_order?: number;
}

export interface StaffBookDto {
  amount: number;
  note?: string;
}

export type UpdateProductDto = Partial<Omit<AddProductDto, 'pro_code'>> & {
  is_active?: boolean;
};

export interface AdminUpdateItemDto {
  amount?: number;
  status?: PreorderItemStatus;
  is_paid?: boolean;
  allocated_qty?: number | null;
  note?: string;
}

export interface AllocateDto {
  strategy?: AllocationStrategy;
  /** true = บันทึกผลลง DB, false = แค่ preview */
  apply?: boolean;
  /** override supply_qty ของสินค้า */
  supply_qty?: number;
}
