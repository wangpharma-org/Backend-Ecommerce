export enum ReturnStatus {
  DRAFT = 'draft',
  PENDING_SALES = 'pending_sales',
  PENDING_MANAGER = 'pending_manager',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

export enum ReturnReason {
  DAMAGED = 'damaged', // สินค้าชำรุด/เสียหาย
  EXPIRED = 'expired', // สินค้าหมดอายุ/ใกล้หมดอายุ
  WRONG_ITEM = 'wrong_item', // ส่งผิด/ไม่ตรง order
  DISASTER = 'disaster', // ภัยพิบัติ (น้ำท่วม)
  OTHER = 'other', // อื่นๆ
}

export enum ResolutionType {
  REFUND = 'refund', // คืนเงิน/เครดิต
  REPLACEMENT = 'replacement', // ส่งสินค้าใหม่
}

export enum InitiatorType {
  CUSTOMER = 'customer',
  EMPLOYEE = 'employee',
}

export enum ApprovalAction {
  SUBMIT = 'submit', // ส่งเรื่อง
  APPROVE = 'approve', // อนุมัติ
  REJECT = 'reject', // ปฏิเสธ
  REQUEST_INFO = 'request_info', // ขอข้อมูลเพิ่มเติม
}

export enum ApproverRole {
  CUSTOMER = 'customer',
  SALES = 'sales',
  MANAGER = 'manager',
}
