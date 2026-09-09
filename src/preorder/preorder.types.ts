import {
  PreorderCampaignStatus,
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

export interface QueueInfo {
  /** ลำดับคิวของร้าน (1 = คนแรก) */
  position: number;
  /** จำนวนรวมของร้านที่อยู่ก่อนหน้า */
  ahead_qty: number;
  /** จำนวนร้านทั้งหมดที่ยังจองอยู่ */
  total_members: number;
  /** ยอดจองรวมทั้งหมดที่ยังจองอยู่ */
  total_qty: number;
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
}

export type UpdateCampaignDto = Partial<CreateCampaignDto>;

export interface SetCampaignStatusDto {
  status: PreorderCampaignStatus;
}

export interface AddProductDto {
  pro_code: string;
  note?: string | null;
  limit_per_member?: number | null;
  supply_qty?: number | null;
  moq?: number | null;
  estimated_price?: number | null;
  eta_date?: string | null;
  sort_order?: number;
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
