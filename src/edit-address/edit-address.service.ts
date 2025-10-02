import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EditAddress } from './edit-address.entity';
import { Repository } from 'typeorm';
import { UsersService } from 'src/users/users.service';

// Interface สำหรับข้อมูลที่ใช้สร้าง Address
export interface CreateAddressDto {
  name?: string;
  fullName: string;
  mem_address?: string;
  mem_village?: string;
  mem_alley?: string;
  mem_road?: string;
  mem_province: string;
  mem_amphur: string;
  mem_tumbon: string;
  mem_post: string;
  phoneNumber: string;
  Note?: string;
  defaults?: boolean;
  mem_code: string;
}

@Injectable()
export class EditAddressService {
  constructor(
    @InjectRepository(EditAddress)
    private readonly editAddressRepository: Repository<EditAddress>,
    private readonly userService: UsersService,
  ) {}

  async createAddress(addressData: CreateAddressDto): Promise<EditAddress> {
    try {
      // หา user จาก mem_code

      if (!addressData.mem_code) {
        throw new Error('mem_code is required to create an address');
      }
      const user = await this.userService.findOneByMemCode(
        addressData.mem_code,
      );
      console.log('Address Data:', addressData);
      console.log('Address Data:', addressData.mem_code);

      console.log('Found user:', user);

      if (!user) {
        throw new Error(`User with mem_code ${addressData.mem_code} not found`);
      }

      // ถ้า defaults เป็น true ให้เซ็ตที่อยู่อื่นๆ ของ user นี้เป็น false ก่อน
      if (addressData.defaults === true) {
        await this.setAllAddressesToNonDefault(addressData.mem_code);
      }

      // สร้าง address object โดยเอา mem_code ออกและใส่ user แทน
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { mem_code, ...addressWithoutMemCode } = addressData;
      const addressToCreate = {
        ...addressWithoutMemCode,
        user: user,
      };

      const newAddress = this.editAddressRepository.create(addressToCreate);
      const savedAddress = await this.editAddressRepository.save(newAddress);

      return savedAddress;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create address: ${errorMessage}`);
    }
  }

  // เมธอดสำหรับเซ็ต defaults ทั้งหมดของ mem_code เป็น false
  private async setAllAddressesToNonDefault(mem_code: string): Promise<void> {
    await this.editAddressRepository
      .createQueryBuilder('address')
      .leftJoin('address.user', 'user')
      .update(EditAddress)
      .set({ defaults: false })
      .where('user.mem_code = :mem_code', { mem_code })
      .execute();
  }

  async updateAddress(
    id: number,
    address: Partial<EditAddress>,
  ): Promise<EditAddress> {
    // ถ้า defaults เป็น true ให้หา user ของ address นี้แล้วเซ็ตที่อยู่อื่นๆ เป็น false ก่อน
    console.log('Updating address with ID:', id);
    console.log('New address data:', address);
    if (address.defaults === true) {
      const existingAddress = await this.editAddressRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (existingAddress && existingAddress.user) {
        await this.setAllAddressesToNonDefault(existingAddress.user.mem_code);
      }
    }

    await this.editAddressRepository.update(id, address);
    const updatedAddress = await this.editAddressRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!updatedAddress) {
      throw new Error('Address not found after update');
    }

    return updatedAddress;
  }

  async getAddressesByUser(mem_code: string): Promise<EditAddress[]> {
    return this.editAddressRepository.find({
      where: { user: { mem_code: mem_code } },
      relations: ['user'],
    });
  }

  async getAddressById(id: number): Promise<EditAddress | null> {
    console.log('Getting address by ID:', id);
    return this.editAddressRepository.findOne({
      where: { id },
    });
  }
}
