import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContractLog } from './contract-log.entity';
import { ContractLogBanner } from './contract-log-banner.entity';
import { ContractLogPerson } from './contract-log-person.entity';
import { ContractLogUpload } from './contract-log-upload.entity';
import { Repository } from 'typeorm';
import * as AWS from 'aws-sdk';
import { ProductsService } from 'src/products/products.service';

@Injectable()
export class ContractLogService {
  private s3: AWS.S3;
  constructor(
    @InjectRepository(ContractLog)
    private readonly contractLog: Repository<ContractLog>,
    @InjectRepository(ContractLogBanner)
    private readonly contractLogBanner: Repository<ContractLogBanner>,
    @InjectRepository(ContractLogPerson)
    private readonly contractLogPerson: Repository<ContractLogPerson>,
    @InjectRepository(ContractLogUpload)
    private readonly contractLogUpload: Repository<ContractLogUpload>,
    private readonly productsService: ProductsService,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  async uploadFile(data: {
    urlPath?: Express.Multer.File;
    name?: string;
    type?: 'wang' | 'attestor' | 'creditor' | 'banner';
    bannerName?: string;
  }): Promise<{
    Image: number;
    personId?: number;
    personName?: string;
    type?: string;
    bannerName?: string;
    urlBanner?: string;
  }> {
    console.log('uploadFile called with:', {
      urlPath: data.urlPath,
      name: data.name,
      type: data.type,
      bannerName: data.bannerName,
    });
    const { urlPath, name, type, bannerName } = data;
    try {
      if (!type || !urlPath) {
        throw new Error('Something with wrong (type or urlPath is missing)');
      }

      const params = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${urlPath?.originalname}`,
        Body: urlPath?.buffer,
        ContentType: urlPath?.mimetype,
        ACL: 'public-read',
      };

      const data = await this.s3.upload(params).promise();

      const newUpload = this.contractLogUpload.create({
        urlPath: data.Location,
      });

      const savedUploads = await this.contractLogUpload.save(newUpload);

      if (type === 'wang' || type === 'attestor' || type === 'creditor') {
        const person = this.contractLogPerson.create({
          personName: name,
          type: type,
          uploads: savedUploads,
        });
        console.log('Person to be saved:', person);
        const savedPerson = await this.contractLogPerson.save(person);
        return {
          Image: savedUploads.uploadId,
          personId: savedPerson.personId,
          personName: savedPerson.personName,
          type: savedPerson.type,
        };
      } else if (type === 'banner') {
        return {
          Image: savedUploads.uploadId,
          type: 'banner',
          urlBanner: savedUploads.urlPath,
          bannerName: bannerName,
        };
      }
      throw new Error('Something with wrong');
    } catch (error) {
      console.error('Error creating log banner:', error);
      throw new Error('Failed to create log banner');
    }
  }

  async getContractLogBanner(
    bannerId?: number | 'all',
  ): Promise<ContractLogBanner | ContractLogBanner[] | null> {
    try {
      if (bannerId === 'all') {
        return await this.contractLogBanner.find({
          relations: [
            'upload',
            'personByWangEmp',
            'personByAttestor',
            'personByAttestor2',
            'personByCreditor',
            'creditor',
          ],
        });
      } else {
        return await this.contractLogBanner.findOne({
          where: { bannerId },
          relations: [
            'upload',
            'personByWangEmp',
            'personByAttestor',
            'personByAttestor2',
            'personByCreditor',
            'creditor',
          ],
          select: {
            personByWangEmp: {
              personId: true,
              personName: true,
            },
            personByAttestor: {
              personId: true,
              personName: true,
            },
            personByAttestor2: {
              personId: true,
              personName: true,
            },
            personByCreditor: {
              personId: true,
              personName: true,
            },
            creditor: {
              creditor_code: true,
              creditor_name: true,
              creditor_address: true,
            },
            upload: {
              uploadId: true,
              urlPath: true,
            },
          },
        });
      }
    } catch (error) {
      console.error('Error fetching banner:', error);
      throw new Error('Failed to fetch banner');
    }
  }

  async selectDataDropdown(
    group: string,
    type: string,
  ): Promise<{ type: string; data: ContractLogPerson[] }> {
    try {
      const result: ContractLogPerson[] = [];
      if (group === 'upload' && type === 'wang') {
        console.log('Fetching persons of type wang');
        result.push(
          ...(await this.contractLogPerson.find({ where: { type: 'wang' } })),
        );
      } else if (group === 'upload' && type === 'attestor') {
        console.log('Fetching persons of type attestor');
        result.push(
          ...(await this.contractLogPerson.find({
            where: { type: 'attestor' },
          })),
        );
      }
      // const test = await this.contractLogPerson.find();
      console.log('Fetched persons:', result);
      // console.log('All persons for debugging:', test);
      return { type: type, data: result };
    } catch (error) {
      console.error('Error fetching persons:', error);
      throw new Error('Failed to fetch persons');
    }
  }

  async createContractLog(data: {
    selectedWang?: number;
    selectedAttestor?: number;
    selectedAttestor2?: number;
    selectedCreditor?: number;
    bannerId?: number;
    bannerName?: string;
    signingDate?: Date;
    creditorCode?: string;
    startDate?: Date;
    endDate?: Date;
    paymentDue?: Date;
    address?: string;
  }): Promise<ContractLogBanner> {
    try {
      console.log('Creating contract log with data:', data);
      const newLog = this.contractLogBanner.create({
        wangEmpId: data.selectedWang,
        attestor: data.selectedAttestor,
        attestor2: data.selectedAttestor2,
        creditorEmpId: data.selectedCreditor,
        img_banner: data.bannerId,
        bannerName: data.bannerName,
        signingDate: data.signingDate,
        creditor_code: data.creditorCode,
        startDate: data.startDate,
        endDate: data.endDate,
        paymentDue: data.paymentDue,
      });
      if (data.creditorCode && data.address) {
        await this.productsService.saveAddress(data.creditorCode, data.address);
      }
      return await this.contractLogBanner.save(newLog);
    } catch (error) {
      console.error('Error creating contract log:', error);
      throw new Error('Failed to create contract log');
    }
  }
}
