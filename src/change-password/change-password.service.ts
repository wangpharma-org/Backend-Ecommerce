// ...existing code...
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePassword } from './change-password.entity';
import { UsersService } from 'src/users/users.service';
import { HttpService } from '@nestjs/axios'; // เพิ่ม HttpService
import { firstValueFrom } from 'rxjs'; // เพิ่ม firstValueFrom
import * as bcrypt from 'bcrypt';

@Injectable()
export class ChangePasswordService {
  private OTP_TTL_SECONDS = 5 * 60; // 5 นาที
  private REQUEST_COOLDOWN_SECONDS = 30; // ขอซ้ำได้ห่างกันอย่างน้อย 30 วินาที

  constructor(
    @InjectRepository(ChangePassword) private repo: Repository<ChangePassword>,
    private readonly usersService: UsersService,
    private readonly httpService: HttpService, // เพิ่ม HttpService
  ) {}

  private generate6Digit(): string {
    // 000000 - 999999
    const n = Math.floor(Math.random() * 1_000_000);
    return n.toString().padStart(6, '0');
  }

  // ฟังก์ชันสำหรับเรียก API ส่ง email
  private async sendEmailCode(code: string, email: string): Promise<boolean> {
    try {
      const url =
        process.env.EMAIL_SERVICE_URL || 'http://localhost:3080/send-code'; //Note:แก้ ENV ให้ใช้ URL ที่ถูกต้อง
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            code: code,
            email: email,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      console.log('Email sent successfully:', response.data);
      return true;
    } catch (error) {
      console.error(
        'Error sending email:',
        error.response?.data || error.message
      );
      return false;
    }
  }

  async sendOtp(data: {
    mem_username: string;
  }): Promise<{ code: string; email: string | null; emailSent: boolean }> {
    const code = this.generate6Digit();
    const emailUser = await this.usersService.checkEmail(data.mem_username);
    console.log('Email for user', data.mem_username, ':', emailUser);

    const member = await this.usersService.findOne(data.mem_username);
    if (!member || emailUser !== member.mem_email) {
      throw new Error('Member not found');
    }

    // คำนวณเวลาหมดอายุ (เวลาปัจจุบัน + 5 นาที)
    const currentTime = new Date();
    const expireTime = new Date(
      currentTime.getTime() + this.OTP_TTL_SECONDS * 1000,
    ); // 5 นาที = 300 วินาที

    // Save OTP to database พร้อม exp_code
    const otp = this.repo.create({
      otp: code,
      user: member,
      exp_code: expireTime.toISOString(), // เพิ่ม exp_code ที่เป็นเวลาหมดอายุ
    });
    await this.repo.save(otp);

    console.log('OTP created:', {
      code: code,
      username: data.mem_username,
      expires_at: expireTime.toISOString(),
      expires_in_minutes: this.OTP_TTL_SECONDS / 60,
    });

    // ส่ง email ผ่าน API
    let emailSent = false;
    if (emailUser) {
      emailSent = await this.sendEmailCode(code, emailUser);
    }

    return { code, email: emailUser, emailSent };
  }

  async CheckOldPasswordAndUpdatePassword(data: {
    mem_username: string;
    old_password: string;
    new_password: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.usersService.findOne(data.mem_username);
      if (!user) {
        throw new Error('User not found');
      }

      const isMatch = await this.usersService.comparePassword(
        data.old_password,
        user.mem_password,
      );
      if (!isMatch) {
        throw new Error('Old password is incorrect');
      }
      try {
        user.mem_password = data.new_password;
        // user.mem_password = await bcrypt.hash(data.new_password, 10);
        await this.usersService.update(user.mem_username, user);
      } catch (hashError) {
        console.error('Error hashing/updating password:', hashError);
        throw new Error('Error updating password');
      }
      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error updating password:', errorMessage);
      return { success: false, message: errorMessage };
    }
  }

  async forgotPasswordUpdate(data: {
    mem_username: string;
    new_password: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.usersService.findOne(data.mem_username);
      if (!user) {
        throw new Error('User not found');
      }

      try {
        user.mem_password = data.new_password;
        // user.mem_password = await bcrypt.hash(data.new_password, 10);
        await this.usersService.update(user.mem_username, user);
      } catch (hashError) {
        console.error('Error hashing/updating password:', hashError);
        throw new Error('Error updating password');
      }

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error updating password:', errorMessage);
      return { success: false, message: errorMessage };
    }
  }
}
