import { ApiProperty } from '@nestjs/swagger';

export class SigninDto {
  @ApiProperty({ example: 'pharmacy01', description: 'Required; not empty' })
  username: string;

  @ApiProperty({ example: 'P@ssw0rd123', description: 'Required; not empty' })
  password: string;
}
