import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyDoc } from './policy-doc.entity';
import { PolicyDocMember } from './policy-doc-member.entity';
import { PolicyDocCatagory } from './policy-doc-catagory.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class PolicyDocService {
  constructor(
    @InjectRepository(PolicyDoc)
    private readonly policyDocRepository: Repository<PolicyDoc>,
    @InjectRepository(PolicyDocMember)
    private readonly policyDocMemberRepository: Repository<PolicyDocMember>,
    @InjectRepository(PolicyDocCatagory)
    private readonly policyDocCatagoryRepository: Repository<PolicyDocCatagory>,
    private readonly userService: UsersService,
  ) {}

  async findOptionCatagoryPolicy(
    name?: string,
  ): Promise<PolicyDocCatagory | PolicyDocCatagory[]> {
    if (!name) {
      const found = await this.policyDocCatagoryRepository.find();
      return found;
    } else {
      const createData = this.policyDocCatagoryRepository.create({
        nameCatagory: name,
      });
      const saveCatagory =
        await this.policyDocCatagoryRepository.save(createData);
      return saveCatagory;
    }
  }

  async savePolicyDoc(content: string, category: number, type: number) {
    if (!content) {
      throw new Error('Something Error in Upload Banner');
    }

    const findVersion = await this.policyDocCatagoryRepository.findOne({
      where: { policyCatagoryId: category },
      relations: ['policyC'], // เพิ่ม relations
    });
    console.log('Found version info:', findVersion);

    const versionLatest = findVersion;
    let newVersion = '1.0.0';
    let savedPolicyDoc: PolicyDoc;

    if (!versionLatest?.policyC) {
      // กรณีไม่มี version เก่า - สร้าง version แรก
      console.log('No existing version, creating 1.0.0');

      const createData = this.policyDocRepository.create({
        content,
        category,
        version: '1.0.0',
      });

      savedPolicyDoc = await this.policyDocRepository.save(createData);

      // Update CategoryDoc ให้ชี้ไปยัง PolicyDoc ใหม่
      if (versionLatest) {
        versionLatest.policyC = savedPolicyDoc;
        await this.policyDocCatagoryRepository.save(versionLatest);
      }
    } else {
      // กรณีมี version เก่า - ทำ versioning
      console.log('Current versionLatest:', versionLatest);
      const splitVersion = versionLatest.policyC.version.split('.');

      // คำนวณ version ใหม่
      if (type == 1) {
        console.log('Incrementing major version');
        newVersion = `${parseInt(splitVersion[0], 10) + 1}.0.0`;
      } else if (type == 2) {
        console.log('Incrementing minor version');
        newVersion = `${splitVersion[0]}.${parseInt(splitVersion[1], 10) + 1}.0`;
      } else if (type == 3) {
        console.log('Incrementing patch version');
        newVersion = `${splitVersion[0]}.${splitVersion[1]}.${parseInt(splitVersion[2], 10) + 1}`;
      }

      console.log('Updated version to:', newVersion);

      // สร้าง PolicyDoc ใหม่ด้วย version ใหม่
      const createData = this.policyDocRepository.create({
        content,
        category,
        version: newVersion,
      });

      savedPolicyDoc = await this.policyDocRepository.save(createData);

      // Update CategoryDoc ให้ชี้ไปยัง PolicyDoc ใหม่
      versionLatest.policyC = savedPolicyDoc;
      await this.policyDocCatagoryRepository.save(versionLatest);
    }

    console.log('Final saved PolicyDoc:', savedPolicyDoc);
    return savedPolicyDoc;
  }

  async agreePolicyDoc(mem_code: string, policyId: number): Promise<void> {
    const user = await this.userService.findOneByMemCode(mem_code);
    if (!user) {
      throw new Error('User not found');
    }
    const policyDoc = await this.policyDocRepository.findOne({
      where: { policyId },
    });
    if (!policyDoc) {
      throw new Error('Policy Document not found');
    }

    const findExistingAgreement = await this.policyDocMemberRepository.findOne({
      where: {
        user_mem_code: mem_code,
        policyCategoryId: policyDoc.category,
      },
    });

    console.log('Existing agreement found:', findExistingAgreement);

    console.log('policyDoc.category:', policyDoc.category);

    if (findExistingAgreement) {
      await this.policyDocMemberRepository.update(
        { user_mem_code: mem_code, policyCategoryId: policyDoc.category },
        {
          policyID: policyDoc.policyId,
        },
      );
    } else {
      const newPolicyDocMember = this.policyDocMemberRepository.create({
        policyID: policyDoc.policyId,
        policyCategoryId: policyDoc.category,
        user_mem_code: user.mem_code,
      });
      await this.policyDocMemberRepository.save(newPolicyDocMember);
    }
  }

  async checkAndGetCorrectPolicy(mem_code: string): Promise<
    {
      policyID: number;
      category: {
        policyCatagoryId: number;
        nameCatagory: string;
      };
      content: string;
      latestVersion: string;
    }[]
  > {
    console.log('Checking policy for member code:', mem_code);
    const user = await this.userService.findOneByMemCode(mem_code);
    if (!user) {
      throw new Error('User not found');
    }

    const latestPolicies = await this.policyDocMemberRepository.find({
      where: { user_mem_code: mem_code },
      relations: ['policyDoc', 'category'],
    });

    const policyCategories = await this.policyDocCatagoryRepository.find({
      relations: ['policyC'],
      select: ['policyCatagoryId', 'nameCatagory'],
    });

    const finalResult: {
      policyID: number;
      category: {
        policyCatagoryId: number;
        nameCatagory: string;
      };
      content: string;
      latestVersion: string;
    }[] = [];
    for (const category of policyCategories) {
      console.log('category:', category);
      const hasAgreed = latestPolicies.some(
        (policyMember) =>
          policyMember.policyCategoryId === category.policyCatagoryId &&
          policyMember.policyDoc.version === category.policyC.version,
      );
      console.log(
        'hasAgreed status for category',
        category.nameCatagory,
        ':',
        hasAgreed,
      );
      if (!hasAgreed) {
        finalResult.push({
          policyID: category.policyC.policyId,
          category: {
            policyCatagoryId: category.policyCatagoryId,
            nameCatagory: category.nameCatagory,
          },
          content: category.policyC.content,
          latestVersion: category.policyC.version,
        });
      } else {
        console.log(
          `User has agreed to latest policy for category ${category.nameCatagory}:`,
          hasAgreed,
        );
      }
    }
    // console.log('policyCategories:', policyCategories);
    return finalResult;
  }
}
