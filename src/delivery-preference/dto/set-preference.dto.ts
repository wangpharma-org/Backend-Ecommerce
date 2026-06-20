import { IsNotEmpty, IsString } from 'class-validator';

export class SetPreferenceDto {
  @IsString()
  @IsNotEmpty()
  preference: string;
}
