// ...existing code...
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePassword } from './change-password.entity';
import { UsersService } from 'src/users/users.service';
import { HttpService } from '@nestjs/axios'; // เพิ่ม HttpService
import { firstValueFrom } from 'rxjs'; // เพิ่ม firstValueFrom
// import * as bcrypt from 'bcrypt';

@Injectable()
export class ChangePasswordService {
  private OTP_TTL_SECONDS = 15 * 60; // 15 นาที
  private REQUEST_COOLDOWN_SECONDS = 30; // ขอซ้ำได้ห่างกันอย่างน้อย 30 วินาที

  constructor(
    @InjectRepository(ChangePassword)
    private ChangePasswordRepo: Repository<ChangePassword>,
    private readonly usersService: UsersService,
    private readonly httpService: HttpService, // เพิ่ม HttpService
  ) {}

  async CheckMember(mem_code: string): Promise<{
    RefKey?: string;
    email?: boolean;
    success: boolean;
    message: string;
  }> {
    const user = await this.usersService.findOneByMemCode(mem_code);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    if (!user.mem_email) {
      return {
        success: false,
        message: 'User has no email',
      };
    }

    const { OTP, RefKey } = await this.generate6Digit(mem_code);

    // รอผลลัพธ์จากการส่ง email
    let emailSent = false;
    try {
      emailSent = await this.sendEmailCode(OTP, user.mem_email, RefKey);
      if (emailSent) {
        console.log('OTP email sent to', user.mem_email);
      } else {
        console.error('Failed to send OTP email to', user.mem_email);
      }
    } catch (error) {
      console.error('Error sending OTP email:', error);
      emailSent = false;
    }

    return {
      success: true,
      message: 'OTP sent successfully',
      email: emailSent,
      RefKey,
    };
  }

  private async generate6Digit(
    mem_code: string,
  ): Promise<{ OTP: string; RefKey: string }> {
    // 000000 - 999999
    const n = Math.floor(Math.random() * 1_000_000);
    const savedOtp = await this.ChangePasswordRepo.save({
      otp: n.toString().padStart(6, '0'),
      user: { mem_code: mem_code },
      exp_code: new Date(
        Date.now() + this.OTP_TTL_SECONDS * 1000,
      ).toISOString(),
    });

    // ใช้ id ที่ได้จาก database และเอา 7 ตัวสุดท้าย
    const refKey = savedOtp.id.toString().slice(-7).padStart(7, '0');

    return {
      OTP: n.toString().padStart(6, '0'),
      RefKey: refKey,
    };
  }

  // ฟังก์ชันสำหรับเรียก API ส่ง email
  private async sendEmailCode(
    code: string,
    email: string,
    refKey: string,
  ): Promise<boolean> {
    try {
      const url =
        process.env.EMAIL_SERVICE_URL || 'http://localhost:3080/send-code'; //Note:แก้ ENV ให้ใช้ URL ที่ถูกต้อง
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            code: code,
            email: email,
            refKey: refKey,
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
    } catch (error: any) {
      console.error(
        'Error sending email:',
        error.response?.data || error.message,
      );
      return false;
    }
  }

  async sendOtp(data: { mem_username: string }): Promise<{
    code: string;
    email: string | null;
    emailSent: boolean;
    refKey: string;
  }> {
    try {
      const member = await this.usersService.findOne(data.mem_username);
      if (!member) {
        throw new Error('Member not found');
      }

      const emailUser = await this.usersService.checkEmail(data.mem_username);
      console.log('Email for user', data.mem_username, ':', emailUser);

      if (emailUser !== member.mem_email) {
        throw new Error('Email mismatch');
      }

      const otpData = await this.generate6Digit(member.mem_code);

      console.log('OTP created:', {
        code: otpData.OTP,
        refKey: otpData.RefKey,
        username: data.mem_username,
        expires_in_minutes: this.OTP_TTL_SECONDS / 60,
      });

      // ส่ง email ผ่าน API
      let emailSent = false;
      if (emailUser) {
        try {
          emailSent = await this.sendEmailCode(
            otpData.OTP,
            emailUser,
            otpData.RefKey,
          );
        } catch (error) {
          console.error('Failed to send email:', error);
          emailSent = false;
        }
      }

      return {
        code: otpData.OTP,
        email: emailUser,
        emailSent,
        refKey: otpData.RefKey,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error in sendOtp:', errorMessage);
      return {
        code: '',
        email: null,
        emailSent: false,
        refKey: '',
      };
    }
  }

  async validateOtp(data: {
    mem_code: string;
    otp: string;
    timeNow: string;
  }): Promise<{ valid: boolean; message: string; block?: boolean }> {
    const otpRecord = await this.ChangePasswordRepo.findOne({
      where: { user: { mem_code: data.mem_code }, otp: data.otp },
      order: { exp_code: 'DESC' },
      select: ['id', 'otp', 'isUsed', 'exp_code'],
    });
    if (!otpRecord) {
      // หา record ล่าสุดเพื่อ increment countError
      const latestRecord = await this.ChangePasswordRepo.findOne({
        where: { user: { mem_code: data.mem_code } },
        order: { exp_code: 'DESC' }, // เพิ่ม order เพื่อหาล่าสุด
        select: ['id', 'countError', 'exp_code', 'countError'], // เพิ่ม exp_code ใน select
      });
      console.log('Latest record for incrementing countError:', latestRecord);

      if (latestRecord && latestRecord.countError >= 3) {
        return {
          valid: false,
          message: 'OTP is blocked due to multiple failed attempts',
          block: true,
        };
      }

      if (latestRecord) {
        const currentCount = latestRecord.countError || 0;
        await this.ChangePasswordRepo.update(latestRecord.id, {
          countError: currentCount + 1,
        });
      }

      return { valid: false, message: 'member not matched' };
    }

    if (otpRecord.isUsed === 'used') {
      return { valid: false, message: 'OTP has already been used' };
    }

    if (otpRecord.isUsed === 'pending') {
      const now = new Date(data.timeNow);
      const otpTime = new Date(otpRecord.exp_code);
      const diffSeconds = (now.getTime() - otpTime.getTime()) / 1000;
      // const diffMinutes = diffSeconds / 60; // แปลงเป็นนาที

      // console.log('Current time:', now);
      // console.log('Time difference in seconds:', diffSeconds);
      // console.log('Time difference in minutes:', diffMinutes);
      // console.log('OTP TTL seconds:', this.OTP_TTL_SECONDS);

      if (diffSeconds > this.OTP_TTL_SECONDS) {
        return { valid: false, message: 'OTP has expired' };
      }

      await this.ChangePasswordRepo.update(otpRecord.id, {
        isUsed: 'used',
      });
      // this.ChangePasswordRepo.delete({
      //   user: { mem_code: data.mem_code },
      //   isUsed: false,
      // });
      return { valid: true, message: 'OTP is valid' };
    }

    // Default return statement for any unhandled cases
    return { valid: false, message: 'Invalid OTP state' };
  }

  async CheckTimeRequest(mem_code: string): Promise<{
    valid: boolean;
    message: string;
    RefKey?: string;
    emailSent?: boolean;
    remainingTime?: number;
  }> {
    try {
      // หาข้อมูลล่าสุดของ member คนนี้
      console.log('start');
      const lastRequest = await this.ChangePasswordRepo.findOne({
        where: { user: { mem_code }, isUsed: 'pending' },
        order: { exp_code: 'DESC' },
        select: ['id', 'exp_code', 'isUsed'],
      });

      if (lastRequest) {
        await this.ChangePasswordRepo.update(lastRequest.id, {
          isUsed: 'requested',
        });
        lastRequest.isUsed = 'requested';
        console.log('Updated lastRequest to requested:', lastRequest.id);
      }

      if (lastRequest && lastRequest.isUsed === 'requested') {
        // คำนวณเวลาที่สร้าง = exp_time - OTP_TTL_SECONDS
        console.log('Last request found:', lastRequest);
        const expTime = new Date(lastRequest.exp_code);
        const createTime = new Date(
          expTime.getTime() - this.OTP_TTL_SECONDS * 1000,
        );
        console.log('Create time (calculated):', createTime);

        // เวลาที่อนุญาตให้ขอใหม่ = เวลาสร้าง + OTP_TTL_SECONDS
        const allowedRequestTime = new Date(
          createTime.getTime() + this.REQUEST_COOLDOWN_SECONDS * 1000,
        );
        console.log('Allowed request time:', allowedRequestTime);
        const now = new Date();
        const timeSinceAllowed =
          (now.getTime() - allowedRequestTime.getTime()) / 1000; // วินาที
        console.log('Time since allowed (seconds):', timeSinceAllowed);

        // ถ้ายังไม่ถึง 30 วินาที ให้รอ
        if (timeSinceAllowed < this.REQUEST_COOLDOWN_SECONDS / 2) {
          console.log('Request cooldown active');
          await this.ChangePasswordRepo.update(lastRequest.id, {
            isUsed: 'pending',
          });
          lastRequest.isUsed = 'pending'; // อัปเดตค่าใน memory
          console.log('Reset lastRequest back to pending due to cooldown');

          const waitTimeSeconds =
            this.REQUEST_COOLDOWN_SECONDS - Math.floor(timeSinceAllowed);
          return {
            valid: false,
            message: `Please wait ${waitTimeSeconds} seconds before requesting a new OTP`,
            remainingTime: waitTimeSeconds,
          };
        }
        console.log('Cooldown period has passed');
        await this.ChangePasswordRepo.update(lastRequest.id, {
          isUsed: 'failed',
        });
        lastRequest.isUsed = 'failed';
        console.log('Marked old OTP as failed before creating new one');
      }
      console.log('No recent pending/requested OTP found or cooldown passed');
      if (lastRequest && lastRequest.isUsed === 'failed') {
        console.log('Last request was failed, allowing new OTP request');
        const checkMember = await this.CheckMember(mem_code);
        return {
          valid: true,
          message: 'You can request a new OTP',
          RefKey: checkMember.RefKey,
          emailSent: checkMember.email,
        };
      }

      // กรณีอื่นๆ (ไม่ควรเกิดขึ้น)
      return {
        valid: false,
        message: 'Unable to process request',
      };
    } catch (error) {
      console.error('Error in CheckTimeRequest:', error);
      return { valid: false, message: 'Error checking request time' };
    }
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
      console.log('User found for password reset:', user.mem_username);
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
