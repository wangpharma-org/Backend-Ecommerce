import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from 'src/users/users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import * as AWS from 'aws-sdk';
import { RefreshTokenEntity } from './refresh-token.entity';
import * as dayjs from 'dayjs';
import * as bcrypt from 'bcrypt';
import { SALT_ROUNDS } from '../constants/app.constants'; 
import { EmployeesService } from 'src/employees/employees.service';

export interface SigninResponse {
  token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  private s3: AWS.S3;
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly httpService: HttpService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    private readonly employeeService: EmployeesService,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  async DeleteImageByUrl(url: string) {
    try {
      if (url === 'No') {
        return;
      }
      if (!url) {
        throw new Error('ไม่พบ URL ที่ต้องการลบ');
      }

      const urlParts = url.split('/');
      const key = urlParts.slice(3).join('/');

      await this.s3
        .deleteObject({
          Bucket: 'wang-storage',
          Key: key,
        })
        .promise();
    } catch (error) {
      console.error(error);
      throw new Error('Something Error in Delete Image User');
    }
  }

  async UploadImage(
    file: Express.Multer.File,
    type: string,
    mem_code: string,
    old_url: string,
  ) {
    try {
      if (!file) {
        throw new Error('Something Error in Upload Banner');
      }

      const params = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file?.originalname}`,
        Body: file?.buffer,
        ContentType: file?.mimetype,
        ACL: 'public-read',
      };

      const data = await this.s3.upload(params).promise();

      if (type === '1') {
        await this.userRepo.update(
          {
            mem_code: mem_code,
          },
          {
            mem_img1: data.Location,
          },
        );
        await this.DeleteImageByUrl(old_url);
        return data.Location;
      } else if (type === '2') {
        await this.userRepo.update(
          {
            mem_code: mem_code,
          },
          {
            mem_img2: data.Location,
          },
        );
        await this.DeleteImageByUrl(old_url);
        return data.Location;
      } else if (type === '3') {
        await this.userRepo.update(
          {
            mem_code: mem_code,
          },
          {
            mem_img3: data.Location,
          },
        );
        await this.DeleteImageByUrl(old_url);
        return data.Location;
      }
    } catch (error) {
      console.log(error);
      throw new Error('Something Error in Upload Image User');
    }
  }

  async fetchUserData(mem_code: string) {
    try {
      const userData = await this.userRepo.findOne({
        where: {
          mem_code: mem_code,
        },
      });
      return userData;
    } catch {
      throw new Error('Error in fetchUserData');
    }
  }

  async updateUserData(data: UserEntity) {
    try {
      await this.userRepo.update({ mem_code: data.mem_code }, { ...data });
      await this.updateDataToOldSystem(data);
    } catch (error) {
      console.log(error);
      throw new Error('Something Error in updateUserData');
    }
  }

  async updateDataToOldSystem(data: UserEntity) {
    try {
      const response = await lastValueFrom(
        this.httpService.post(
          'https://www.wangpharma.com/Akitokung/api/order/receive-info-member.php',
          // 'https://webhook.site/0a9cbf03-80ae-4108-bbe1-c4ec552f3b2a',
          {
            mem_address: data.mem_address,
            mem_village: data.mem_village,
            mem_alley: data.mem_alley,
            mem_road: data.mem_road,
            mem_province: data.mem_province,
            mem_amphur: data.mem_amphur,
            mem_tumbon: data.mem_tumbon,
            mem_post: data.mem_post,
            mem_invoice_type: data.mem_invoice_type,
          },
        ),
      );
      if (response.status === 200) {
        return;
      } else {
        throw new Error('Something Error in updateDataToOldSystem');
      }
    } catch {
      throw new Error('Something Error in updateDataToOldSystem');
    }
  }

  async upsertUser(
    data: {
      mem_code: string;
      mem_nameSite: string;
      mem_username: string;
      mem_password: string;
      mem_price: string;
      emp_saleoffice: string;
      latest_purchase: string;
      emp_id_ref?: string | null;
    }[],
  ) {
    try {
      const mem_code_all_user = await this.userRepo.find({
        select: {
          mem_code: true,
        },
      });
      const mem_code_all_map = mem_code_all_user.map((m) => {
        return m.mem_code;
      });

      for (const user of data) {
        if (mem_code_all_map.includes(user.mem_code)) {
          if (user.emp_id_ref) {
            const findemp = await this.employeeService.findOneByEmpCode(
              user.emp_id_ref || '',
            );
            if (!findemp) {
              user.emp_id_ref = null;
            }
          } else {
            user.emp_id_ref = null;
          }
          await this.userRepo.update(
            { mem_code: user.mem_code },
            {
              mem_price: user.mem_price,
              emp_saleoffice: user.emp_saleoffice,
              latest_purchase: user.latest_purchase,
              emp_id_ref: user?.emp_id_ref ?? null,
            },
          );
        } else {
          const hashedPassword = await bcrypt.hash(user.mem_password, SALT_ROUNDS);
          const newUser = this.userRepo.create({
            mem_code: user.mem_code,
            mem_nameSite: user.mem_nameSite,
            mem_username: user.mem_username,
            mem_password: hashedPassword,
            mem_price: user.mem_price,
            emp_saleoffice: user.emp_saleoffice,
            latest_purchase: user.latest_purchase,
            emp_id_ref: user?.emp_id_ref ?? null,
          });
          await this.userRepo.save(newUser);
        }
      }
    } catch (error) {
      console.log(error);
      throw new Error('Something Error in upsertUser');
    }
  }

  async signin(data: {
    username: string;
    password: string;
  }): Promise<SigninResponse> {
    const user = await this.userService.findOne(data.username);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const passwordMatch = await bcrypt.compare(data.password, user.mem_password);
    if (user && passwordMatch === false) {
      throw new UnauthorizedException('Invalid password');
    }
    const payload = {
      username: user.mem_username,
      name: user.mem_nameSite ?? '',
      mem_code: user.mem_code ?? '',
      price_option: user.mem_price ?? '',
      mem_address: user.mem_address ?? '',
      mem_village: user.mem_village ?? '',
      mem_alley: user.mem_alley ?? '',
      mem_tumbon: user.mem_tumbon ?? '',
      mem_amphur: user.mem_amphur ?? '',
      mem_province: user.mem_province ?? '',
      mem_post: user.mem_post ?? '',
      mem_phone: user.mem_phone ?? '',
      permission: user.permision_admin,
    };

    const payload_reflesh = {
      username: user.mem_username,
      name: user.mem_nameSite ?? '',
      mem_code: user.mem_code ?? '',
    };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });
    const refresh_token = await this.jwtService.signAsync(payload_reflesh, {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: '18h',
    });

    await this.refreshTokenRepo.save({
      mem_code: user.mem_code,
      refresh_token: refresh_token,
    });
    return { token: access_token, refresh_token: refresh_token };
  }

  async refreshToken(refresh_token: string) {
    try {
      console.log(refresh_token);
      const existingToken = await this.refreshTokenRepo.findOne({
        where: { refresh_token: refresh_token },
      });
      if (!existingToken) {
        console.log('No existing token found');
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload: { mem_code: string } = await this.jwtService.verifyAsync(
        refresh_token,
        {
          secret: process.env.ACCESS_TOKEN_SECRET,
        },
      );

      await this.refreshTokenRepo.delete({ refresh_token: refresh_token });

      const user = await this.userRepo.findOne({
        where: { mem_code: payload.mem_code },
      });

      if (user) {
        const payload = {
          username: user.mem_username,
          name: user.mem_nameSite ?? '',
          mem_code: user.mem_code ?? '',
          price_option: user.mem_price ?? '',
          mem_address: user.mem_address ?? '',
          mem_village: user.mem_village ?? '',
          mem_alley: user.mem_alley ?? '',
          mem_tumbon: user.mem_tumbon ?? '',
          mem_amphur: user.mem_amphur ?? '',
          mem_province: user.mem_province ?? '',
          mem_post: user.mem_post ?? '',
          mem_phone: user.mem_phone ?? '',
          permission: user.permision_admin,
        };

        const payload_reflesh = {
          username: user.mem_username,
          name: user.mem_nameSite ?? '',
          mem_code: user.mem_code ?? '',
        };
        const access_token = await this.jwtService.signAsync(payload, {
          expiresIn: '15m',
        });
        const refresh_token = await this.jwtService.signAsync(payload_reflesh, {
          secret: process.env.ACCESS_TOKEN_SECRET,
          expiresIn: '18h',
        });

        await this.refreshTokenRepo.save({
          mem_code: user.mem_code,
          refresh_token: refresh_token,
        });
        return { token: access_token, refresh_token: refresh_token };
      } else {
        throw new UnauthorizedException('Invalid refresh token');
      }
    } catch (error) {
      console.log(error);
      throw new Error('Refresh token expired');
      // throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async hashpassword() {
    const queryRunner = this.userRepo.manager.connection.createQueryRunner(); //ตรงนี้จะเป็นการสร้าง queryRunnerเอง
    await queryRunner.connect();
    await queryRunner.startTransaction(); //เริ่ม transaction

    try {
      // Get users within transaction แทนที่จะใช้ this.userRepo.find
      const users = await queryRunner.manager.find('UserEntity', {
        select: { mem_code: true, mem_password: true },
      });

      let hashCount = 0;
      let skipCount = 0;
      const errors: string[] = []; //เก็บ errors เพื่อตัดสินใจ rollback

      for (const user of users) {
        //เก็บ spaces ใน password (ไม่ .trim()) เว้นวรรค=เป็นส่วนนึงของรหัสผ่าน
        const password = (user as any).mem_password;
        if (!password || password.startsWith('$2')) {
          skipCount++;
          continue;
        }
        
        try {
          const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
          console.log(`Hash length: ${hashedPassword.length} for user: ${(user as any).mem_code}`);
          
          //Update within transaction แทนที่จะใช้ this.userRepo.update
          await queryRunner.manager.update('UserEntity', 
            { mem_code: (user as any).mem_code },
            { mem_password: hashedPassword }
          );
          hashCount++;
        } catch (updateError) {
          //เก็บ error แทนที่จะ throw ทันทีเพื่อrollback ได้
          errors.push(`Error updating user ${(user as any).mem_code}: ${updateError.message}`);
          console.error(`Error updating user ${(user as any).mem_code}:`, updateError.message);
        }
      }

      //ตรวจสอบ errors และ rollback ถ้ามี 
      if (errors.length > 0) {
        await queryRunner.rollbackTransaction(); //rollback
        return {
          success: false,
          message: 'Hash password failed - transaction rolled back',
          errors: errors
        };
      }

      //Commit transaction เมื่อสำเร็จทั้งหมด
      await queryRunner.commitTransaction();
      console.log(`Successfully hashed ${hashCount} passwords`);
      return {
        success: true,
        message: `Hashed ${hashCount} passwords, skipped ${skipCount}`,
        total: users.length,
        hashed: hashCount,
        skipped: skipCount
      };

    } catch (error) {
      //Rollback เมื่อเกิด error
      await queryRunner.rollbackTransaction();
      console.error('Transaction failed:', error);
      
      return {
        success: false,
        message: 'Hash password failed',
        error: error.message
      };
    } finally {
      //ปลดปล่อย connection เสมอ กัน memory leak
      await queryRunner.release();
    }
  }
}
