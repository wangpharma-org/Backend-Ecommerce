import { ApiProperty } from '@nestjs/swagger';

export class AttendeeDto {
  @ApiProperty({
    example: 'สมชาย ใจดี',
    description: 'Required; not empty; ชื่อผู้เข้าร่วม',
  })
  member_name: string;

  @ApiProperty({
    example: '0812345678',
    description: 'Required; not empty; เบอร์โทรศัพท์',
  })
  phone: string;

  @ApiProperty({
    example: 'กรุงเทพมหานคร',
    description: 'Required; not empty; จังหวัด',
  })
  province: string;

  @ApiProperty({
    example: 'U1234567890abcdef1234567890abcdef',
    description: 'Required; not empty; LINE ID',
  })
  line_id: string;
}

export class RegisterMeetingDto {
  @ApiProperty({
    example: 'M00001',
    description: 'Required; not empty; รหัสสมาชิก/ร้านค้า',
  })
  mem_code: string;

  @ApiProperty({
    example: 'ร้านยาสุขภาพดี',
    description: 'Required; not empty; ชื่อร้านค้า',
  })
  store_name: string;

  @ApiProperty({
    type: [AttendeeDto],
    description: 'Required; not empty; รายชื่อผู้เข้าร่วมประชุม',
  })
  attendees: AttendeeDto[];
}
