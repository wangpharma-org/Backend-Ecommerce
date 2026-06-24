import { ApiProperty } from '@nestjs/swagger';

export class UploadImageUserDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Required' })
  file: unknown;

  @ApiProperty({ example: 'M00123', description: 'Required' })
  mem_code: string;

  @ApiProperty({ example: 'profile', description: 'Required; image category/usage tag' })
  type: string;

  @ApiProperty({
    example: 'https://cdn.wangpharma.com/users/old.jpg',
    description: 'Required; pass empty string if there is no previous image to remove',
  })
  old_url: string;
}
