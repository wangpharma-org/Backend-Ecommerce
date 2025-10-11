import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePassword } from './change-password.entity';
import { UsersService } from 'src/users/users.service';
import { HttpService } from '@nestjs/axios'; // เพิ่ม HttpService
import * as bcrypt from 'bcrypt'; // เปิดใช้แล้ว

interface MailgunMessageData {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}

interface MailgunMessages {
  create(domain: string, data: MailgunMessageData): Promise<any>;
}

interface MailgunClient {
  messages: MailgunMessages;
}

import Mailgun from 'mailgun.js';
import * as formData from 'form-data';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ChangePasswordService {
  private OTP_TTL_SECONDS = 15 * 60; // 15 นาที
  private REQUEST_COOLDOWN_SECONDS = 5 * 60; // ขอซ้ำได้ห่างกันอย่างน้อย 30 วินาที

  private MG_DOMAIN: string;
  private FROM_EMAIL = 'Wang System <no-reply@yourdomain.com>';
  private mailgun: MailgunClient;
  constructor(
    @InjectRepository(ChangePassword)
    private ChangePasswordRepo: Repository<ChangePassword>,
    private readonly usersService: UsersService,
    private readonly httpService: HttpService, // เพิ่ม HttpService
  ) {
    const mg = new Mailgun(formData);
    this.mailgun = mg.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY || '',
    }) as MailgunClient;
    this.MG_DOMAIN = process.env.MAILGUN_DOMAIN || '';
  }

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
      console.log('Sending email to:', email);
      if (!code || !email || !refKey) {
        throw new Error('code, email และ refKey ต้องถูกส่งมาด้วย');
      }
      console.log('Using Mailgun domain:', this.MG_DOMAIN);
      if (!this.MG_DOMAIN) {
        throw new Error('Mailgun domain is not configured');
      }
      const subject = 'Your verification code';
      const text = `Your code is: ${code}`;
      const html = `
     <div style="margin:0; padding:0; background:#f4f6f8; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; line-height:1.6;">
  <!-- Header -->
  <div style="background:#cc4d4df3; padding:20px 24px; text-align:center; border-top-left-radius:8px; border-top-right-radius:8px;">
    <img src="https://th.m.wikipedia.org/wiki/%E0%B9%84%E0%B8%9F%E0%B8%A5%E0%B9%8C:LEGO_logo.svg" 
       alt="Wang Pharmaceutical" 
       height="28" 
       style="display:inline-block; vertical-align:middle;">
  </div>

  <!-- Card -->
  <div style="background:#ffffff; padding:32px 28px; border-bottom-left-radius:8px; border-bottom-right-radius:8px; 
              box-shadow:0 1px 3px #cc4d4df3; max-width:600px; margin:0 auto;">
    
    <div style="margin:0 0 16px; font-size:20px; line-height:28px; color:#111827; text-align:center; font-weight:bold;">
      รหัสยืนยัน (Verification code)
    </div>

    <div style="text-align:center; margin:16px 0 6px;">
      <div style="display:inline-block; font-weight:700; font-size:42px; line-height:52px; letter-spacing:3px; color:#111827;">
        ${code}
      </div>
    </div>

    <div style="text-align:center; margin:12px 0 6px;">
      <div style="font-size:12px; line-height:18px; color:#6b7280; margin-bottom:4px;">
        หมายเลขอ้างอิง (Reference Key)
      </div>
      <div style="display:inline-block; font-weight:600; font-size:16px; line-height:24px; letter-spacing:1px; color:#374151; 
        background:#f9fafb; padding:8px 16px;">
        ${refKey}
      </div>
    </div>

    <div style="margin:6px 0 20px; font-size:12px; line-height:18px; color:#6b7280; text-align:center;">
      รหัสนี้จะหมดอายุภายใน 15 นาทีหลังจากส่ง
    </div>

    <div style="border-top:1px solid #e5e7eb; margin:20px 0;"></div>

    <div style="margin:0 0 10px; font-size:14px; line-height:22px; color:#374151;">
      บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด จะไม่ส่งอีเมลเพื่อขอให้คุณเปิดเผยรหัสผ่าน หมายเลขบัตรเครดิต 
      หรือข้อมูลบัญชีธนาคารของคุณ หากคุณได้รับอีเมลที่น่าสงสัยพร้อมลิงก์ให้กดเพื่ออัปเดตข้อมูลบัญชี 
      กรุณาอย่าคลิกลิงก์นั้น
    </div>

    <div style="margin:0 0 10px; font-size:14px; line-height:22px; color:#374151;">
      หากคุณไม่ได้ร้องขอรหัสยืนยันนี้ โปรดเพิกเฉยอีเมลฉบับนี้ หรือแจ้งให้เราทราบที่ 
      <a href="mailto:{{SUPPORT_EMAIL}}" style="color:#2563eb; text-decoration:none;">{{SUPPORT_EMAIL}}</a>
      เพื่อให้เราตรวจสอบ
    </div>

    <div style="margin:18px 0 0; font-size:12px; line-height:18px; color:#6b7280;">
      หากปุ่ม/รหัสไม่แสดงอย่างถูกต้อง กรุณาคัดลอกและวางรหัสด้านบนในหน้ายืนยันตัวตนของ บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 12px 40px; text-align:center; color:#9ca3af; font-size:11px; line-height:18px;">
    บริษัท วังเภสัชฟาร์มาซูติคอล จำกัด เป็นเครื่องหมายการค้าจดทะเบียนของบริษัทเจ้าของแบรนด์ (ถ้ามี).<br>
    ที่อยู่: เลขที่ 23 ซ.พัฒโน ถ.อนุสรณ์อาจารย์ทอง ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา 90110
  </div>
</div>

    `;
      console.log('Email content prepared');

      const emailResponse: unknown = await this.mailgun.messages.create(
        this.MG_DOMAIN,
        {
          from: this.FROM_EMAIL,
          to: [email],
          subject,
          text,
          html,
        },
      );
      console.log('from', this.FROM_EMAIL);
      console.log('to', [email]);
      console.log('subject', subject);
      console.log('text', text);
      console.log('html', html);
      console.log('Email sent successfully:', emailResponse);

      return true;
    } catch (error: any) {
      console.error(
        'Error sending email:',
        error?.response?.data || error?.message || 'Unknown error',
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
      if (emailUser !== member.mem_email) {
        throw new Error('Email mismatch');
      }

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
      console.log('Latest record for incrementing countError:', latestRecord);

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

      console.log('OTP already used. Time since used (seconds):', diffSeconds);
      console.log('OTP expiration time:', this.OTP_TTL_SECONDS);

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
      console.log('start');
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
        if (timeSinceAllowed <= 0) {
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
        console.log('CheckMember result:', checkMember);
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
        const saltOrRounds = 10;
        user.mem_password = await bcrypt.hash(data.new_password, saltOrRounds);
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
      console.log('User found for password reset:', user.mem_username);
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

        const saltOrRounds = 10;
        user.mem_password = await bcrypt.hash(data.new_password, saltOrRounds);
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

      console.log('OTP already used. Time since used (seconds):', diffSeconds);
      console.log('OTP expiration time:', otpRecord.exp_code);

      if (diffSeconds >= 0) {
        return { valid: false, message: 'OTP has expired' };
      }

      return { valid: true, message: 'OTP is valid and latest' };
    }

    return { valid: false, message: 'Invalid OTP state' };
  }
}
