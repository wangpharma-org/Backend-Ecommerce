import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  REASON_MAX_LENGTH,
  normalizeReason,
} from '../member-login-block.policy';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// SSN0-273: body จาก sale-backend (เรียกผ่าน x-internal-token) — ผู้ทำรายการ sale-backend อ่านจาก JWT พนักงานมาแล้ว
class MemberLoginBlockActorDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  actor_emp_code: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  actor_name?: string;
}

export class BlockMemberLoginDto extends MemberLoginBlockActorDto {
  @Transform(({ value }: { value: unknown }) => normalizeReason(value) ?? '')
  @IsString()
  @IsNotEmpty({ message: 'ต้องระบุเหตุผลการระงับ' })
  @MaxLength(REASON_MAX_LENGTH)
  reason: string;
}

export class UnblockMemberLoginDto extends MemberLoginBlockActorDto {
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => normalizeReason(value) ?? undefined,
  )
  @IsString()
  @MaxLength(REASON_MAX_LENGTH)
  reason?: string;
}
