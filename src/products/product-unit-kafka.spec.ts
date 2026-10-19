import { ProductsService } from './products.service';
import { ProductEntity } from './products.entity';
import { ProductUnitEntity } from './product-unit.entity';

// ECWC-743: เพิ่มหน่วยสินค้าผ่าน Kafka (createProduct / updateProduct)
// DB จำลองตาม product_unit จริง: unique (pro_code, level), unit_name varchar(30), transaction rollback

type Unit = {
  id: number;
  pro_code: string;
  unit_name: string;
  ratio: number;
  level: number;
};

function setup(seedUnits: Omit<Unit, 'id'>[] = []) {
  let seq = 0;
  const db = {
    products: new Map<string, Record<string, unknown>>(),
    units: seedUnits.map((u) => ({ ...u, id: ++seq })) as Unit[],
  };
  const checkName = (name: string) => {
    if (name.length > 30) throw new Error('ER_DATA_TOO_LONG unit_name');
  };

  const manager = (tx: typeof db) => ({
    save: jest.fn((target: unknown, entity: { pro_code: string }) => {
      expect(target).toBe(ProductEntity);
      tx.products.set(entity.pro_code, { ...entity });
      return Promise.resolve(entity);
    }),
    upsert: jest.fn(
      (target: unknown, rows: Omit<Unit, 'id'>[], conflict: string[]) => {
        expect(target).toBe(ProductUnitEntity);
        expect(conflict).toEqual(['pro_code', 'level']);
        for (const row of rows) {
          checkName(row.unit_name);
          const existing = tx.units.find(
            (u) => u.pro_code === row.pro_code && u.level === row.level,
          );
          if (existing) Object.assign(existing, row);
          else tx.units.push({ ...row, id: ++seq });
        }
        return Promise.resolve();
      },
    ),
  });

  const productRepo = {
    create: (x: Record<string, unknown>) => ({ ...x }),
    update: jest.fn().mockResolvedValue(undefined),
    manager: {
      // ทำงานบนสำเนา ถ้า callback throw ไม่ commit (เหมือน rollback)
      transaction: async (
        cb: (m: ReturnType<typeof manager>) => Promise<void>,
      ) => {
        const tx = {
          products: new Map(db.products),
          units: db.units.map((u) => ({ ...u })),
        };
        await cb(manager(tx));
        db.products = tx.products;
        db.units = tx.units;
      },
    },
  };

  const productUnitRepo = {
    create: (x: Omit<Unit, 'id'>) => ({ ...x }),
    find: jest.fn(({ where }: { where: { pro_code: string } }) =>
      Promise.resolve(
        db.units
          .filter((u) => u.pro_code === where.pro_code)
          .map((u) => ({ ...u })),
      ),
    ),
    save: jest.fn((row: Omit<Unit, 'id'>) => {
      checkName(row.unit_name);
      if (
        db.units.some(
          (u) => u.pro_code === row.pro_code && u.level === row.level,
        )
      )
        throw new Error('ER_DUP_ENTRY uk_product_unit');
      db.units.push({ ...row, id: ++seq });
      return Promise.resolve(row);
    }),
    update: jest.fn(({ id }: { id: number }, patch: Partial<Unit>) => {
      if (patch.unit_name !== undefined) checkName(patch.unit_name);
      Object.assign(db.units.find((u) => u.id === id)!, patch);
      return Promise.resolve();
    }),
  };

  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const elasticsearchService = {
    indexProduct: jest.fn().mockResolvedValue(undefined),
    updateProductDoc: jest.fn().mockResolvedValue(undefined),
  };
  const service = Object.create(ProductsService.prototype) as ProductsService;
  Object.assign(service, {
    productRepo,
    productUnitRepo,
    logger,
    elasticsearchService,
  });
  const unitsOf = (code = 'T001') =>
    db.units
      .filter((u) => u.pro_code === code)
      .sort((a, b) => a.level - b.level)
      .map(({ level, unit_name, ratio }) => ({ level, unit_name, ratio }));
  return { service, db, logger, elasticsearchService, unitsOf };
}

const base = { pro_code: 'T001', pro_name: 'ทดสอบ', pro_priceA: 10 };
const create = (s: ReturnType<typeof setup>, extra: Record<string, unknown>) =>
  s.service.createProduct({ ...base, ...extra } as never);
const update = (s: ReturnType<typeof setup>, extra: Record<string, unknown>) =>
  s.service.updateProduct({ pro_code: 'T001', ...extra } as never);

describe('createProduct — หน่วยสินค้า (ECWC-743)', () => {
  it('saves product and all 3 units', async () => {
    const s = setup();
    await create(s, {
      pro_unit1: 'ชิ้น',
      pro_unit2: 'กล่อง',
      pro_unit3: 'ลัง',
      pro_ratio1: 1,
      pro_ratio2: 12,
      pro_ratio3: 144,
    });
    expect(s.db.products.has('T001')).toBe(true);
    expect(s.unitsOf()).toEqual([
      { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      { level: 2, unit_name: 'กล่อง', ratio: 12 },
      { level: 3, unit_name: 'ลัง', ratio: 144 },
    ]);
    expect(s.logger.warn).not.toHaveBeenCalled();
    expect(s.elasticsearchService.indexProduct).toHaveBeenCalled();
  });

  it('warns with pro_code when the payload has no units', async () => {
    const s = setup();
    await create(s, {});
    expect(s.db.products.has('T001')).toBe(true);
    expect(s.unitsOf()).toEqual([]);
    expect(s.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('T001 ไม่มีหน่วยสินค้า'),
    );
  });

  it('trims unit names and skips blank ones', async () => {
    const s = setup();
    await create(s, { pro_unit1: ' ชิ้น ', pro_unit2: '   ', pro_ratio2: 12 });
    expect(s.unitsOf()).toEqual([{ level: 1, unit_name: 'ชิ้น', ratio: 1 }]);
  });

  it('does not keep a product without units when saving units fails', async () => {
    const s = setup();
    await expect(create(s, { pro_unit1: 'ก'.repeat(31) })).rejects.toThrow(
      'Error creating product',
    );
    expect(s.db.products.has('T001')).toBe(false);
    expect(s.unitsOf()).toEqual([]);
    expect(s.elasticsearchService.indexProduct).not.toHaveBeenCalled();
    expect(s.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('T001'),
      expect.anything(),
    );
  });

  it('upserts units when the Kafka message is delivered again', async () => {
    const s = setup([
      { pro_code: 'T001', unit_name: 'ชิ้น', ratio: 1, level: 1 },
    ]);
    await create(s, { pro_unit1: 'ชิ้น', pro_unit2: 'แผง', pro_ratio2: 10 });
    expect(s.unitsOf()).toEqual([
      { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      { level: 2, unit_name: 'แผง', ratio: 10 },
    ]);
  });

  it('replaces an invalid ratio with 1 and warns', async () => {
    const s = setup();
    await create(s, {
      pro_unit1: 'ชิ้น',
      pro_ratio1: 0,
      pro_unit2: 'กล่อง',
      pro_ratio2: '12',
    });
    expect(s.unitsOf()).toEqual([
      { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      { level: 2, unit_name: 'กล่อง', ratio: 12 },
    ]);
    expect(s.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('level 1: ratio 0'),
    );
  });
});

describe('updateProduct — หน่วยสินค้า (ECWC-743)', () => {
  it('adds level 2 to a product that only has level 1', async () => {
    const s = setup([
      { pro_code: 'T001', unit_name: 'ชิ้น', ratio: 1, level: 1 },
    ]);
    await update(s, { pro_unit2: 'กล่อง', pro_ratio2: 12 });
    expect(s.unitsOf()).toEqual([
      { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      { level: 2, unit_name: 'กล่อง', ratio: 12 },
    ]);
  });

  it('adds units to a product that has none', async () => {
    const s = setup();
    await update(s, { pro_unit1: ' ขวด ', pro_ratio1: 1 });
    expect(s.unitsOf()).toEqual([{ level: 1, unit_name: 'ขวด', ratio: 1 }]);
  });

  it('does not blank an existing unit name when "" is sent', async () => {
    const s = setup([
      { pro_code: 'T001', unit_name: 'ชิ้น', ratio: 1, level: 1 },
      { pro_code: 'T001', unit_name: 'กล่อง', ratio: 12, level: 2 },
    ]);
    await update(s, { pro_unit2: '' });
    expect(s.unitsOf()).toEqual([
      { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      { level: 2, unit_name: 'กล่อง', ratio: 12 },
    ]);
    expect(s.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('level 2: ชื่อหน่วยว่าง'),
    );
  });

  it('still updates the ratio when the name is blank', async () => {
    const s = setup([
      { pro_code: 'T001', unit_name: 'กล่อง', ratio: 12, level: 2 },
    ]);
    await update(s, { pro_unit2: '', pro_ratio2: 24 });
    expect(s.unitsOf()).toEqual([{ level: 2, unit_name: 'กล่อง', ratio: 24 }]);
  });

  it('ignores an invalid ratio', async () => {
    const s = setup([
      { pro_code: 'T001', unit_name: 'กล่อง', ratio: 12, level: 2 },
    ]);
    await update(s, { pro_ratio2: 0 });
    expect(s.unitsOf()).toEqual([{ level: 2, unit_name: 'กล่อง', ratio: 12 }]);
  });
});
