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

      console.log(data);

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
          await this.userRepo.update(
            { mem_code: user.mem_code },
            {
              mem_price: user.mem_price,
              emp_saleoffice: user.emp_saleoffice,
            },
          );
        } else {
          const newUser = this.userRepo.create({
            mem_code: user.mem_code,
            mem_nameSite: user.mem_nameSite,
            mem_username: user.mem_username,
            mem_password: user.mem_password,
            mem_price: user.mem_price,
            emp_saleoffice: user.emp_saleoffice,
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
    console.log('data in auth service:', data);
    const user = await this.userService.findOne(data.username);
    if (user && user.mem_password !== data.password) {
      throw new UnauthorizedException();
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
      expiresIn: '1h',
    });
    const refresh_token = await this.jwtService.signAsync(payload_reflesh, {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: '12h',
    });

    const expire = dayjs().add(12, 'hour').toDate();
    await this.refreshTokenRepo.save({
      mem_code: user.mem_code,
      refresh_token: refresh_token,
      expire,
    });
    return { token: access_token, refresh_token: refresh_token };
  }

  async refreshToken(refresh_token: string) {
    try {
      const existingToken = await this.refreshTokenRepo.findOne({
        where: { refresh_token: refresh_token },
      });
      if (!existingToken) {
        console.log('No existing token found');
        throw new UnauthorizedException('Invalid refresh token');
      }

      console.log('ACCESS_TOKEN_SECRET : ', process.env.ACCESS_TOKEN_SECRET);

      const payload: { mem_code: string } = await this.jwtService.verifyAsync(
        refresh_token,
        {
          secret: process.env.ACCESS_TOKEN_SECRET,
        },
      );

      await this.refreshTokenRepo.delete({ mem_code: payload.mem_code });

      console.log('Payload Refresh', payload);

      const user = await this.userRepo.findOne({
        where: { mem_code: payload.mem_code },
      });

      console.log('User Refresh', user);

      if (user) {
        const data = await this.signin({
          username: user?.mem_username,
          password: user?.mem_password,
        });

        return data;
      } else {
        console.log('No user found');
        throw new UnauthorizedException('Invalid refresh token');
      }
    } catch (error) {
      console.log('refresh error: ', error);
      throw new Error('Refresh token expired');
      // throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
