import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePassword } from './change-password.entity';
import { UsersService } from 'src/users/users.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { SALT_ROUNDS } from '../constants/app.constants';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ChangePasswordService {
  private OTP_TTL_SECONDS = 15 * 60; // 15 นาที
  private REQUEST_COOLDOWN_SECONDS = 5 * 60; // ขอซ้ำได้ห่างกันอย่างน้อย 30 วินาที

  private FROM_EMAIL = 'Wang System <no-reply@yourdomain.com>';

  constructor(
    @InjectRepository(ChangePassword)
    private ChangePasswordRepo: Repository<ChangePassword>,
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
  ) { }

  async CheckMember(
    mem_code: string,
    reqCode?: boolean,
  ): Promise<{
    RefKey?: string;
    email?: boolean;
    success: boolean;
    message: string;
  }> {
    const user = await this.usersService.findOneByMemCode(mem_code);
    const otp = await this.ChangePasswordRepo.findOne({
      where: { user: { mem_code }, isUsed: 'used' },
      order: { exp_code: 'DESC' },
      select: ['id', 'exp_code', 'isUsed'],
    });
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
    if (
      reqCode === true &&
      otp &&
      Date.now() > new Date(otp.exp_code).getTime()
    ) {
      return {
        success: false,
        message:
          'Previous OTP is still valid, please wait before requesting a new one',
      };
    }

    const { OTP, RefKey } = await this.generate6Digit(mem_code);

    // รอผลลัพธ์จากการส่ง email
    let emailSent = false;
    try {
      emailSent = await this.sendEmailCode(OTP, user.mem_email, RefKey);
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
      if (!code || !email || !refKey) {
        throw new Error('code, email และ refKey ต้องถูกส่งมาด้วย');
      }
      const subject = 'Your verification code';
      const text = `Your code is: ${code}`;
      const html = `
     <div style="margin:0; padding:20px; background:linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); font-family:'Segoe UI', Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height:1.6; min-height:100vh;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:30px 24px; text-align:center; border-radius:12px 12px 0 0; box-shadow:0 4px 20px rgba(102, 126, 234, 0.15);">
    <img src="https://wang-storage.sgp1.digitaloceanspaces.com/1776330231507-7dhyxv-LOGO.svg" 
       alt="Wang Pharmaceutical" 
       height="32" 
       style="display:inline-block; vertical-align:middle; filter:brightness(0) invert(1);">
  </div>

  <!-- Card -->
  <div style="background:#ffffff; padding:40px 32px; border-radius:0 0 12px 12px; 
              box-shadow:0 8px 32px rgba(0, 0, 0, 0.1); max-width:600px; margin:0 auto; position:relative;">
    
    <div style="margin:0 0 24px; font-size:24px; line-height:32px; color:#2d3748; text-align:center; font-weight:600;">
      รหัสยืนยันตัวตน
    </div>
    
    <div style="text-align:center; margin:0 0 8px; font-size:14px; color:#718096;">
      กรุณาใช้รหัสด้านล่างเพื่อยืนยันตัวตนของคุณ
    </div>

    <div style="text-align:center; margin:32px 0 24px;">
      <div style="display:inline-block; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color:#ffffff; font-weight:700; font-size:48px; line-height:64px; 
                  letter-spacing:8px; padding:20px 32px; border-radius:16px; 
                  box-shadow:0 8px 24px rgba(102, 126, 234, 0.25); 
                  font-family:'Courier New', monospace; position:relative;">
        ${code}
        <div style="position:absolute; top:-8px; right:-8px; width:16px; height:16px; 
                    background:#10b981; border-radius:50%; box-shadow:0 2px 4px rgba(16, 185, 129, 0.3);"></div>
      </div>
    </div>

    <div style="text-align:center; margin:16px 0 24px;">
      <div style="font-size:13px; line-height:20px; color:#6b7280; margin-bottom:8px; font-weight:500;">
        หมายเลขอ้างอิง
      </div>
      <div style="display:inline-block; font-weight:600; font-size:18px; line-height:28px; 
                  letter-spacing:2px; color:#2d3748; background:linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); 
                  padding:12px 24px; border-radius:12px; border:2px solid #e2e8f0; 
                  font-family:'Courier New', monospace; box-shadow:0 2px 8px rgba(0, 0, 0, 0.05);">
        ${refKey}
      </div>
    </div>

    <div style="text-align:center; margin:16px 0 32px;">
      <div style="display:inline-block; background:#fef5e7; color:#d69e2e; font-size:14px; line-height:20px; 
                  font-weight:500; padding:12px 20px; border-radius:25px; 
                  border-left:4px solid #f6ad55; box-shadow:0 2px 8px rgba(246, 173, 85, 0.15);">
        รหัสนี้จะหมดอายุใน <strong>15 นาที</strong>
      </div>
    </div>

    <div style="border-top:2px solid #e2e8f0; margin:32px 0; opacity:0.6;"></div>

    <div style="background:#f8fafc; border-radius:12px; padding:20px; margin:0 0 16px; border-left:4px solid #4299e1;">
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <div style="font-size:15px; line-height:24px; color:#2d3748; font-weight:500;">
          <strong>ข้อควรระวัง:</strong> เราจะไม่ขอรหัสผ่าน หมายเลขบัตรเครดิต หรือข้อมูลส่วนตัวผ่านอีเมล 
          หากพบอีเมลน่าสงสัย โปรดอย่าคลิกลิงก์ใดๆ
        </div>
      </div>
    </div>

    <div style="background:#f0fff4; border-radius:12px; padding:20px; margin:0 0 16px; border-left:4px solid #10b981;">
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <div style="font-size:15px; line-height:24px; color:#2d3748;">
          หากคุณไม่ได้ร้องขอรหัสนี้ สามารถเพิกเฉยอีเมลนี้ได้ หรือติดต่อเราที่ 
          <a href="mailto:{{SUPPORT_EMAIL}}" style="color:#10b981; text-decoration:none; font-weight:600; 
             border-bottom:1px solid #10b981;">{{SUPPORT_EMAIL}}</a>
        </div>
      </div>
    </div>

    <div style="text-align:center; margin:24px 0 0; font-size:13px; line-height:20px; color:#718096; 
                background:#fafafa; padding:16px; border-radius:8px; font-style:italic;">
      <strong>เคล็ดลับ:</strong> หากรหัสไม่แสดงชัดเจน สามารถคัดลอกรหัส <strong>${code}</strong> 
      ไปวางในหน้ายืนยันตัวตนได้เลย 
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:32px; padding:24px 20px; text-align:center; background:rgba(255, 255, 255, 0.7); 
              border-radius:12px; box-shadow:0 2px 8px rgba(0, 0, 0, 0.05);">
    <div style="color:#4a5568; font-size:13px; line-height:20px; font-weight:500; margin-bottom:8px;">
      บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด
    </div>
    <div style="color:#718096; font-size:12px; line-height:18px;">
      เลขที่ 23 ซ.พัฒโน ถ.อนุสรณ์อาจารย์ทอง<br>
      ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา 90110
    </div>
    <div style="margin-top:16px; padding-top:16px; border-top:1px solid #e2e8f0; color:#a0aec0; font-size:11px;">
      © 2024 Wang Pharmaceutical. All rights reserved.
    </div>
  </div>
</div>

    `;

      await this.mailerService.sendMail({
        from: this.FROM_EMAIL,
        to: email,
        subject,
        text,
        html,
      });

      return true;
    } catch (error: unknown) {
      console.error(
        'Error sending email:',
        error instanceof Error ? error.message : 'Unknown error',
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

      if (emailUser !== member.mem_email) {
        throw new Error('Email mismatch');
      }

      const otpData = await this.generate6Digit(member.mem_code);
      if (emailUser !== member.mem_email) {
        throw new Error('Email mismatch');
      }

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
    mem_username: string;
    otp: string;
    timeNow: string;
  }): Promise<{ valid: boolean; message: string; block?: boolean }> {
    const otpRecord = await this.ChangePasswordRepo.findOne({
      where: { user: { mem_username: data.mem_username }, otp: data.otp },
      order: { exp_code: 'DESC' },
      select: ['id', 'otp', 'isUsed', 'exp_code'],
    });
    if (!otpRecord) {
      // หา record ล่าสุดเพื่อ increment countError
      const latestRecord = await this.ChangePasswordRepo.findOne({
        where: { user: { mem_username: data.mem_username } },
        order: { exp_code: 'DESC' }, // เพิ่ม order เพื่อหาล่าสุด
        select: ['id', 'countError', 'exp_code', 'countError'], // เพิ่ม exp_code ใน select
      });

      if (latestRecord && latestRecord.countError >= 3) {
        await this.ChangePasswordRepo.update(latestRecord.id, {
          isUsed: 'failed',
        });
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

      if (diffSeconds >= 0) {
        return { valid: false, message: 'OTP has expired' };
      }

      await this.ChangePasswordRepo.update(otpRecord.id, {
        isUsed: 'used',
      });
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
      const lastRequest = await this.ChangePasswordRepo.findOne({
        where: { user: { mem_code }, isUsed: 'pending' },
        order: { exp_code: 'DESC' },
        select: ['id', 'exp_code', 'isUsed'],
      });

      if (lastRequest) {
        // await this.ChangePasswordRepo.update(lastRequest.id, {
        //   isUsed: 'requested',
        // });
        lastRequest.isUsed = 'requested';
      }

      if (lastRequest && lastRequest.isUsed === 'requested') {
        // คำนวณเวลาที่สร้าง = exp_time - OTP_TTL_SECONDS
        const expTime = new Date(lastRequest.exp_code);
        const createTime = new Date(
          expTime.getTime() - this.OTP_TTL_SECONDS * 1000,
        );

        // เวลาที่อนุญาตให้ขอใหม่ = เวลาสร้าง + OTP_TTL_SECONDS
        const allowedRequestTime = new Date(
          createTime.getTime() + this.REQUEST_COOLDOWN_SECONDS * 1000,
        );
        const now = new Date();
        const timeSinceAllowed =
          (now.getTime() - allowedRequestTime.getTime()) / 1000; // วินาที

        // ถ้ายังไม่ถึง 30 วินาที ให้รอ
        if (timeSinceAllowed <= 0) {
          await this.ChangePasswordRepo.update(lastRequest.id, {
            isUsed: 'pending',
          });
          lastRequest.isUsed = 'pending'; // อัปเดตค่าใน memory

          const waitTimeSeconds =
            this.REQUEST_COOLDOWN_SECONDS - Math.floor(timeSinceAllowed);
          return {
            valid: false,
            message: `Please wait ${waitTimeSeconds} seconds before requesting a new OTP`,
            remainingTime: waitTimeSeconds,
          };
        }
        await this.ChangePasswordRepo.update(lastRequest.id, {
          isUsed: 'failed',
        });
        lastRequest.isUsed = 'failed';
      }
      if (lastRequest && lastRequest.isUsed === 'failed') {
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
        user.mem_password = await bcrypt.hash(data.new_password, SALT_ROUNDS);
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
    otp: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.usersService.findOne(data.mem_username);
      if (!user) {
        throw new Error('User not found');
      }
      try {
        if (!data.otp) {
          throw new Error('OTP is required');
        }
        const otpValidation = await this.checkOtp({
          mem_username: user.mem_username,
          otp: data.otp,
        });
        if (!otpValidation.valid) {
          throw new Error(otpValidation.message);
        }

        user.mem_password = await bcrypt.hash(data.new_password, SALT_ROUNDS);
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

  async checkOtp(data: {
    otp: string;
    mem_username: string;
  }): Promise<{ valid: boolean; message: string }> {
    // หา OTP record ที่ตรงกับ mem_code และ otp
    const otpRecord = await this.ChangePasswordRepo.findOne({
      where: {
        otp: data.otp,
        user: { mem_username: data.mem_username },
      },
      order: { exp_code: 'DESC' },
      select: ['id', 'otp', 'isUsed', 'exp_code'],
    });

    if (!otpRecord) {
      return { valid: false, message: 'OTP not found for this member' };
    }

    // เช็คว่าเป็น OTP อันล่าสุดของ member นี้หรือไม่
    const latestOtp = await this.ChangePasswordRepo.findOne({
      where: { user: { mem_username: data.mem_username } },
      order: { exp_code: 'DESC' },
      select: ['id', 'otp', 'exp_code'],
    });

    if (!latestOtp || latestOtp.id !== otpRecord.id) {
      return {
        valid: false,
        message: 'This is not the latest OTP for this member',
      };
    }

    if (otpRecord.isUsed === 'used') {
      const now = new Date();
      const otpTime = new Date(otpRecord.exp_code);
      const diffSeconds = (now.getTime() - otpTime.getTime()) / 1000;

      if (diffSeconds >= 0) {
        return { valid: false, message: 'OTP has expired' };
      }

      return { valid: true, message: 'OTP is valid and latest' };
    }

    return { valid: false, message: 'Invalid OTP state' };
  }
}
