import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import * as AWS from 'aws-sdk';
import * as dayjs from 'dayjs';

import { ProductReturnEntity } from './product-return.entity';
import { ProductReturnItemEntity } from './product-return-item.entity';
import { ProductReturnImageEntity } from './product-return-image.entity';
import { ProductReturnApprovalEntity } from './product-return-approval.entity';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import {
  ReturnStatus,
  ReturnReason,
  ResolutionType,
  InitiatorType,
  ApprovalAction,
  ApproverRole,
} from './return-enums';

@Injectable()
export class ProductReturnService {
  private s3: AWS.S3;
  private readonly RETURN_ELIGIBLE_DAYS = 30;

  constructor(
    @InjectRepository(ProductReturnEntity)
    private readonly returnRepo: Repository<ProductReturnEntity>,

    @InjectRepository(ProductReturnItemEntity)
    private readonly returnItemRepo: Repository<ProductReturnItemEntity>,

    @InjectRepository(ProductReturnImageEntity)
    private readonly returnImageRepo: Repository<ProductReturnImageEntity>,

    @InjectRepository(ProductReturnApprovalEntity)
    private readonly returnApprovalRepo: Repository<ProductReturnApprovalEntity>,

    @InjectRepository(ShoppingHeadEntity)
    private readonly orderRepo: Repository<ShoppingHeadEntity>,

    @InjectRepository(ShoppingOrderEntity)
    private readonly orderItemRepo: Repository<ShoppingOrderEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  // Generate running number: RTN-YYYYMMDD-XXXXX
  private async generateRunningNumber(): Promise<string> {
    const today = dayjs().format('YYYYMMDD');
    const prefix = `RTN-${today}-`;

    const lastReturn = await this.returnRepo.findOne({
      where: { return_running: MoreThan(prefix) },
      order: { return_running: 'DESC' },
    });

    let sequence = 1;
    if (lastReturn && lastReturn.return_running.startsWith(prefix)) {
      const lastSequence = parseInt(lastReturn.return_running.slice(-5), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(5, '0')}`;
  }

  // Get eligible orders for return (within 30 days)
  async getEligibleOrders(mem_code: string) {
    const eligibleDate = dayjs()
      .subtract(this.RETURN_ELIGIBLE_DAYS, 'day')
      .toDate();

    const orders = await this.orderRepo.find({
      where: {
        member: { mem_code },
        soh_datetime: MoreThan(eligibleDate),
      },
      order: { soh_datetime: 'DESC' },
      select: ['soh_id', 'soh_running', 'soh_datetime', 'soh_sumprice'],
    });

    return orders;
  }

  // Get order items for return selection
  async getOrderItems(soh_running: string, mem_code: string) {
    const order = await this.orderRepo.findOne({
      where: { soh_running, member: { mem_code } },
      relations: ['details', 'details.product'],
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Check if within eligible period
    const eligibleDate = dayjs()
      .subtract(this.RETURN_ELIGIBLE_DAYS, 'day')
      .toDate();
    if (order.soh_datetime < eligibleDate) {
      throw new BadRequestException(
        `สามารถคืนสินค้าได้ภายใน ${this.RETURN_ELIGIBLE_DAYS} วันหลังสั่งซื้อเท่านั้น`,
      );
    }

    // Get already returned items for this order
    const existingReturns = await this.returnRepo.find({
      where: {
        soh_id: order.soh_id,
        status: ReturnStatus.DRAFT, // Exclude drafts
      },
      relations: ['items'],
    });

    // Calculate remaining returnable quantity
    const returnedQtyMap = new Map<string, number>();
    for (const ret of existingReturns) {
      if (
        ret.status !== ReturnStatus.REJECTED &&
        ret.status !== ReturnStatus.DRAFT
      ) {
        for (const item of ret.items) {
          const current = returnedQtyMap.get(item.pro_code) || 0;
          returnedQtyMap.set(item.pro_code, current + item.qty);
        }
      }
    }

    const items = order.details.map((detail) => ({
      pro_code: detail.pro_code,
      pro_name: detail.product?.pro_name || '',
      pro_imgmain: detail.product?.pro_imgmain || '',
      qty_ordered: detail.spo_qty,
      qty_returned: returnedQtyMap.get(detail.pro_code) || 0,
      qty_returnable:
        detail.spo_qty - (returnedQtyMap.get(detail.pro_code) || 0),
      unit: detail.spo_unit,
      price_per_unit: detail.spo_price_unit,
    }));

    return {
      order: {
        soh_id: order.soh_id,
        soh_running: order.soh_running,
        soh_datetime: order.soh_datetime,
        soh_sumprice: order.soh_sumprice,
      },
      items: items.filter((i) => i.qty_returnable > 0),
    };
  }

  // Create return request
  async createReturn(data: {
    soh_id: number;
    mem_code: string;
    reason: ReturnReason;
    reason_detail?: string;
    resolution_type: ResolutionType;
    initiator_type: InitiatorType;
    initiator_emp_code?: string;
    items: {
      pro_code: string;
      qty: number;
      unit: string;
      price_per_unit: number;
      item_reason?: string;
      expiry_date?: string;
    }[];
    notes?: string;
  }) {
    // Validate order exists and is eligible
    const order = await this.orderRepo.findOne({
      where: { soh_id: data.soh_id, member: { mem_code: data.mem_code } },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const eligibleDate = dayjs()
      .subtract(this.RETURN_ELIGIBLE_DAYS, 'day')
      .toDate();
    if (order.soh_datetime < eligibleDate) {
      throw new BadRequestException(
        `สามารถคืนสินค้าได้ภายใน ${this.RETURN_ELIGIBLE_DAYS} วันหลังสั่งซื้อเท่านั้น`,
      );
    }

    // Calculate total return amount
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.qty * item.price_per_unit,
      0,
    );

    // Generate running number
    const runningNumber = await this.generateRunningNumber();

    // Create return request
    const returnRequest = this.returnRepo.create({
      return_running: runningNumber,
      soh_id: data.soh_id,
      mem_code: data.mem_code,
      status: ReturnStatus.DRAFT,
      reason: data.reason,
      reason_detail: data.reason_detail,
      resolution_type: data.resolution_type,
      initiator_type: data.initiator_type,
      initiator_emp_code: data.initiator_emp_code,
      total_return_amount: totalAmount,
      notes: data.notes,
    });

    const savedReturn = await this.returnRepo.save(returnRequest);

    // Create return items
    const returnItems = data.items.map((item) =>
      this.returnItemRepo.create({
        return_id: savedReturn.return_id,
        pro_code: item.pro_code,
        qty: item.qty,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        total_price: item.qty * item.price_per_unit,
        item_reason: item.item_reason,
        expiry_date: item.expiry_date ? new Date(item.expiry_date) : null,
      }),
    );

    await this.returnItemRepo.save(returnItems);

    return {
      return_id: savedReturn.return_id,
      return_running: savedReturn.return_running,
    };
  }

  // Upload images
  async uploadImages(
    return_id: number,
    files: Express.Multer.File[],
    description?: string,
  ) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    const uploadedImages: ProductReturnImageEntity[] = [];

    for (const file of files) {
      const key = `returns/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`;

      const params = {
        Bucket: 'wang-storage',
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };

      const uploadResult = await this.s3.upload(params).promise();

      const image = this.returnImageRepo.create({
        return_id,
        image_url: uploadResult.Location,
        image_key: key,
        description,
      });

      uploadedImages.push(await this.returnImageRepo.save(image));
    }

    return uploadedImages;
  }

  // Submit return request (change status to pending_sales)
  async submitReturn(return_id: number, submitter_code: string) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException('Only draft returns can be submitted');
    }

    // Update status
    returnRequest.status = ReturnStatus.PENDING_SALES;
    await this.returnRepo.save(returnRequest);

    // Create approval log
    await this.returnApprovalRepo.save({
      return_id,
      action: ApprovalAction.SUBMIT,
      approver_role: ApproverRole.CUSTOMER,
      approver_code: submitter_code,
      from_status: ReturnStatus.DRAFT,
      to_status: ReturnStatus.PENDING_SALES,
    });

    return { success: true, status: ReturnStatus.PENDING_SALES };
  }

  // Get my returns (for customer)
  async getMyReturns(
    mem_code: string,
    options?: { status?: ReturnStatus; limit?: number; offset?: number },
  ) {
    const where: any = { mem_code };
    if (options?.status) {
      where.status = options.status;
    }

    const [returns, total] = await this.returnRepo.findAndCount({
      where,
      relations: ['order', 'items', 'items.product'],
      order: { created_at: 'DESC' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });

    return { returns, total };
  }

  // Get return detail
  async getReturnDetail(return_id: number) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
      relations: [
        'order',
        'member',
        'items',
        'items.product',
        'images',
        'approvals',
      ],
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    return returnRequest;
  }

  // Delete draft return
  async deleteDraftReturn(return_id: number, mem_code: string) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id, mem_code },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException('Only draft returns can be deleted');
    }

    // Delete images from S3
    const images = await this.returnImageRepo.find({ where: { return_id } });
    for (const image of images) {
      if (image.image_key) {
        await this.s3
          .deleteObject({
            Bucket: 'wang-storage',
            Key: image.image_key,
          })
          .promise();
      }
    }

    await this.returnRepo.delete(return_id);

    return { success: true };
  }

  // ========== Admin Functions ==========

  // Get pending returns for sales review
  async getPendingSales(options?: { limit?: number; offset?: number }) {
    const [returns, total] = await this.returnRepo.findAndCount({
      where: { status: ReturnStatus.PENDING_SALES },
      relations: ['order', 'member', 'items'],
      order: { created_at: 'ASC' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });

    return { returns, total };
  }

  // Get pending returns for manager review
  async getPendingManager(options?: { limit?: number; offset?: number }) {
    const [returns, total] = await this.returnRepo.findAndCount({
      where: { status: ReturnStatus.PENDING_MANAGER },
      relations: ['order', 'member', 'items'],
      order: { created_at: 'ASC' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });

    return { returns, total };
  }

  // Get all returns with filters
  async getAllReturns(filters?: {
    status?: ReturnStatus;
    reason?: ReturnReason;
    from_date?: string;
    to_date?: string;
    mem_code?: string;
    limit?: number;
    offset?: number;
  }) {
    const queryBuilder = this.returnRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.order', 'order')
      .leftJoinAndSelect('r.member', 'member')
      .leftJoinAndSelect('r.items', 'items');

    if (filters?.status) {
      queryBuilder.andWhere('r.status = :status', { status: filters.status });
    }

    if (filters?.reason) {
      queryBuilder.andWhere('r.reason = :reason', { reason: filters.reason });
    }

    if (filters?.from_date) {
      queryBuilder.andWhere('r.created_at >= :from_date', {
        from_date: filters.from_date,
      });
    }

    if (filters?.to_date) {
      queryBuilder.andWhere('r.created_at <= :to_date', {
        to_date: filters.to_date,
      });
    }

    if (filters?.mem_code) {
      queryBuilder.andWhere('r.mem_code = :mem_code', {
        mem_code: filters.mem_code,
      });
    }

    queryBuilder.orderBy('r.created_at', 'DESC');

    const total = await queryBuilder.getCount();
    const returns = await queryBuilder
      .take(filters?.limit || 20)
      .skip(filters?.offset || 0)
      .getMany();

    return { returns, total };
  }

  // Sales approve (move to pending_manager)
  async salesApprove(
    return_id: number,
    emp_code: string,
    emp_name: string,
    comment?: string,
  ) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.PENDING_SALES) {
      throw new BadRequestException('Invalid status for sales approval');
    }

    returnRequest.status = ReturnStatus.PENDING_MANAGER;
    await this.returnRepo.save(returnRequest);

    await this.returnApprovalRepo.save({
      return_id,
      action: ApprovalAction.APPROVE,
      approver_role: ApproverRole.SALES,
      approver_code: emp_code,
      approver_name: emp_name,
      from_status: ReturnStatus.PENDING_SALES,
      to_status: ReturnStatus.PENDING_MANAGER,
      comment,
    });

    return { success: true, status: ReturnStatus.PENDING_MANAGER };
  }

  // Sales reject
  async salesReject(
    return_id: number,
    emp_code: string,
    emp_name: string,
    comment: string,
  ) {
    if (!comment) {
      throw new BadRequestException('Comment is required for rejection');
    }

    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.PENDING_SALES) {
      throw new BadRequestException('Invalid status for sales rejection');
    }

    returnRequest.status = ReturnStatus.REJECTED;
    await this.returnRepo.save(returnRequest);

    await this.returnApprovalRepo.save({
      return_id,
      action: ApprovalAction.REJECT,
      approver_role: ApproverRole.SALES,
      approver_code: emp_code,
      approver_name: emp_name,
      from_status: ReturnStatus.PENDING_SALES,
      to_status: ReturnStatus.REJECTED,
      comment,
    });

    return { success: true, status: ReturnStatus.REJECTED };
  }

  // Manager approve
  async managerApprove(
    return_id: number,
    emp_code: string,
    emp_name: string,
    data?: { comment?: string; resolution_type?: ResolutionType },
  ) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.PENDING_MANAGER) {
      throw new BadRequestException('Invalid status for manager approval');
    }

    returnRequest.status = ReturnStatus.APPROVED;
    if (data?.resolution_type) {
      returnRequest.resolution_type = data.resolution_type;
    }
    await this.returnRepo.save(returnRequest);

    await this.returnApprovalRepo.save({
      return_id,
      action: ApprovalAction.APPROVE,
      approver_role: ApproverRole.MANAGER,
      approver_code: emp_code,
      approver_name: emp_name,
      from_status: ReturnStatus.PENDING_MANAGER,
      to_status: ReturnStatus.APPROVED,
      comment: data?.comment,
    });

    return { success: true, status: ReturnStatus.APPROVED };
  }

  // Manager reject
  async managerReject(
    return_id: number,
    emp_code: string,
    emp_name: string,
    comment: string,
  ) {
    if (!comment) {
      throw new BadRequestException('Comment is required for rejection');
    }

    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.PENDING_MANAGER) {
      throw new BadRequestException('Invalid status for manager rejection');
    }

    returnRequest.status = ReturnStatus.REJECTED;
    await this.returnRepo.save(returnRequest);

    await this.returnApprovalRepo.save({
      return_id,
      action: ApprovalAction.REJECT,
      approver_role: ApproverRole.MANAGER,
      approver_code: emp_code,
      approver_name: emp_name,
      from_status: ReturnStatus.PENDING_MANAGER,
      to_status: ReturnStatus.REJECTED,
      comment,
    });

    return { success: true, status: ReturnStatus.REJECTED };
  }

  // Mark as completed
  async completeReturn(return_id: number, notes?: string) {
    const returnRequest = await this.returnRepo.findOne({
      where: { return_id },
    });

    if (!returnRequest) {
      throw new BadRequestException('Return request not found');
    }

    if (returnRequest.status !== ReturnStatus.APPROVED) {
      throw new BadRequestException('Only approved returns can be completed');
    }

    returnRequest.status = ReturnStatus.COMPLETED;
    if (notes) {
      returnRequest.notes = returnRequest.notes
        ? `${returnRequest.notes}\n${notes}`
        : notes;
    }
    await this.returnRepo.save(returnRequest);

    return { success: true, status: ReturnStatus.COMPLETED };
  }

  // Get statistics
  async getStats(filters?: { from_date?: string; to_date?: string }) {
    const queryBuilder = this.returnRepo.createQueryBuilder('r');

    if (filters?.from_date) {
      queryBuilder.andWhere('r.created_at >= :from_date', {
        from_date: filters.from_date,
      });
    }

    if (filters?.to_date) {
      queryBuilder.andWhere('r.created_at <= :to_date', {
        to_date: filters.to_date,
      });
    }

    const total = await queryBuilder.getCount();

    const byStatus = await this.returnRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany();

    const byReason = await this.returnRepo
      .createQueryBuilder('r')
      .select('r.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.reason')
      .getRawMany();

    const totalAmountResult = await this.returnRepo
      .createQueryBuilder('r')
      .select('SUM(r.total_return_amount)', 'total')
      .where('r.status IN (:...statuses)', {
        statuses: [ReturnStatus.APPROVED, ReturnStatus.COMPLETED],
      })
      .getRawOne();

    return {
      total,
      by_status: byStatus,
      by_reason: byReason,
      total_amount: totalAmountResult?.total || 0,
    };
  }
}
