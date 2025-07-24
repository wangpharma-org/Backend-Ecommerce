interface Product {
  pro_code: string;
  pro_imgmain: string;
}

interface Item {
  spo_id: string;
  spo_qty: number;
  spo_unit: string;
}

interface NewDetail {
  pro_code: string;
  product: Product;
  items: Item[];
}

interface OrderByMemberItem {
  soh_running: string;
  soh_datetime: Date;
  soh_sumprice: number;
  soh_coin_recieve: number;
  Newdetails: NewDetail[];
}

export type AllOrderByMemberRes = OrderByMemberItem[]