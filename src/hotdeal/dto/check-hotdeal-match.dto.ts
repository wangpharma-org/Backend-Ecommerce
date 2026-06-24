import { ApiProperty } from '@nestjs/swagger';

export class ShoppingCartItemDto {
  @ApiProperty({ example: 'กล่อง' })
  pro1_unit: string;

  @ApiProperty({ example: '2' })
  pro1_amount: string;
}

export class HotDealMatchItemDto {
  @ApiProperty({ example: 'P00123' })
  pro_code: string;

  @ApiProperty({ type: [ShoppingCartItemDto] })
  shopping_cart: ShoppingCartItemDto[];
}

export class CheckHotdealMatchDto {
  @ApiProperty({ type: [HotDealMatchItemDto], description: 'Required' })
  hotDeal: HotDealMatchItemDto[];
}
