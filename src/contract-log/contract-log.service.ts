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
            'upload2',
            'personByWangEmp',
            'personByAttestor',
            'personByAttestor2',
            'personByCreditor',
            'creditor',
          ],
        });
      } else {
        return await this.contractLogBanner
          .createQueryBuilder('banner')
          .leftJoinAndSelect('banner.upload', 'upload')
          .leftJoinAndSelect('banner.upload2', 'upload2')
          .leftJoinAndSelect('banner.personByWangEmp', 'personByWangEmp')
          .leftJoinAndSelect(
            'personByWangEmp.uploads',
            'personByWangEmpUploads',
          )
          .leftJoinAndSelect('banner.personByAttestor', 'personByAttestor')
          .leftJoinAndSelect(
            'personByAttestor.uploads',
            'personByAttestorUploads',
          )
          .leftJoinAndSelect('banner.personByAttestor2', 'personByAttestor2')
          .leftJoinAndSelect(
            'personByAttestor2.uploads',
            'personByAttestor2Uploads',
          )
          .leftJoinAndSelect('banner.personByCreditor', 'personByCreditor')
          .leftJoinAndSelect(
            'personByCreditor.uploads',
            'personByCreditorUploads',
          )
          .leftJoinAndSelect('banner.creditor', 'creditor')
          .where('banner.bannerId = :bannerId', { bannerId })
          .select([
            'banner',
            'upload.uploadId',
            'upload.urlPath',
            'upload2.uploadId',
            'upload2.urlPath',
            'personByWangEmp.personId',
            'personByWangEmp.personName',
            'personByWangEmpUploads.uploadId',
            'personByWangEmpUploads.urlPath',
            'personByAttestor.personId',
            'personByAttestor.personName',
            'personByAttestorUploads.uploadId',
            'personByAttestorUploads.urlPath',
            'personByAttestor2.personId',
            'personByAttestor2.personName',
            'personByAttestor2Uploads.uploadId',
            'personByAttestor2Uploads.urlPath',
            'personByCreditor.personId',
            'personByCreditor.personName',
            'personByCreditorUploads.uploadId',
            'personByCreditorUploads.urlPath',
            'creditor.creditor_code',
            'creditor.creditor_name',
            'creditor.creditor_address',
          ])
          .getOne();
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
          ...(await this.contractLogPerson.find({
            where: { type: 'wang' },
            relations: ['uploads'],
          })),
        );
      } else if (group === 'upload' && type === 'attestor') {
        console.log('Fetching persons of type attestor');
        result.push(
          ...(await this.contractLogPerson.find({
            where: { type: 'attestor' },
            relations: ['uploads'],
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

  async updateContractLogBanner(data: {
    bannerId: number;
    urlPath?: Express.Multer.File;
    name?: string;
    type?: 'creditor' | 'banner';
    bannerName?: string;
  }): Promise<{
    creditorEmpId?: number;
    bannerName?: string;
    img_banner?: number;
  }> {
    const { bannerId, urlPath, name, type, bannerName } = data;
    console.log('Updating contract log banner with ID:', bannerId);
    console.log('File data received:', urlPath);
    console.log('Name received:', name);
    console.log('Type received:', type);
    console.log('Banner Name received:', bannerName);

    if (!urlPath || !urlPath.buffer) {
      throw new Error(
        'File buffer is missing. Check your upload configuration and request.',
      );
    }
    try {
      const params = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${urlPath?.originalname}`,
        Body: urlPath?.buffer,
        ContentType: urlPath?.mimetype,
        ACL: 'public-read',
      };

      const uploadResult = await this.s3.upload(params).promise();

      const updateData = this.contractLogUpload.create({
        urlPath: uploadResult.Location,
      });
      const savedData = await this.contractLogUpload.save(updateData);
      console.log('Saved upload data:', savedData);
      if (data.type === 'creditor') {
        const savedDataPerson = await this.contractLogPerson.save({
          personName: data.name,
          type: data.type,
          uploads: savedData,
        });
        console.log('Saved person data:', savedDataPerson);

        await this.contractLogBanner.update(bannerId, {
          creditorEmpId: savedDataPerson.personId,
        });
        return { creditorEmpId: savedDataPerson.personId };
      } else if (bannerName && type === 'banner') {
        await this.contractLogBanner.update(bannerId, {
          bannerName: bannerName,
          img_banner: savedData.uploadId,
        });
        return { bannerName: bannerName, img_banner: savedData.uploadId };
      }
      throw new Error('Invalid type provided for update');
    } catch (error) {
      console.error('Error updating contract log banner:', error);
      throw new Error('Failed to update contract log banner');
    }
  }

  async uploadSignedContract(data: {
    urlPath?: Express.Multer.File;
    note?: string;
    bannerId: number;
  }): Promise<{ urlContract: string }> {
    const { urlPath, bannerId } = data;
    try {
      if (!urlPath) {
        throw new Error('File is missing');
      }
      const params = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${urlPath?.originalname}`,
        Body: urlPath?.buffer,
        ContentType: urlPath?.mimetype,
        ACL: 'public-read',
      };
      const uploadResult = await this.s3.upload(params).promise();

      const newUpload = this.contractLogUpload.create({
        urlPath: uploadResult.Location,
      });
      const savedUpload = await this.contractLogUpload.save(newUpload);
      console.log('Saved contract upload:', savedUpload);

      await this.contractLogBanner.update(bannerId, {
        urlContract: savedUpload.uploadId,
      });
      return { urlContract: uploadResult.Location };
    } catch (error) {
      console.error('Error uploading contract file:', error);
      throw new Error('Failed to upload contract file');
    }
  }
}
