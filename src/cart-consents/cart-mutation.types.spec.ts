import { describeSaleCartChange } from './cart-mutation.types';

const line = (spc_amount: string, spc_unit: string, editable = true) => ({
  spc_amount,
  spc_unit,
  editable,
});

describe('describeSaleCartChange', () => {
  const before = {
    cart: [
      {
        pro_code: 'P001',
        pro_name: 'Paracetamol',
        shopping_cart: [line('2', 'BOX'), line('1', 'BOX', false)],
      },
      {
        pro_code: 'P002',
        pro_name: 'Vitamin C',
        shopping_cart: [line('3', 'BOX'), line('10', 'TAB')],
      },
    ],
  };

  it('reports the editable before/after quantity of the changed unit', () => {
    const after = {
      cart: [
        {
          pro_code: 'P001',
          pro_name: 'Paracetamol',
          shopping_cart: [line('5', 'BOX'), line('1', 'BOX', false)],
        },
      ],
    };
    expect(
      describeSaleCartChange(
        {
          kind: 'CHANGE_QUANTITY',
          lineId: 1,
          proCode: 'P001',
          unit: 'BOX',
          quantity: 5,
          expectedCartVersion: '1',
        },
        before,
        after,
      ),
    ).toEqual({
      proCode: 'P001',
      proName: 'Paracetamol',
      unit: 'BOX',
      fromQuantity: 2,
      toQuantity: 5,
    });
  });

  it('reports a new product from zero with its name from the new cart', () => {
    const after = {
      cart: [
        {
          pro_code: 'P009',
          pro_name: 'Zinc',
          shopping_cart: [line('4', 'TAB')],
        },
      ],
    };
    expect(
      describeSaleCartChange(
        {
          kind: 'ADD_PRODUCT',
          proCode: 'P009',
          unit: 'TAB',
          quantity: 4,
          expectedCartVersion: '1',
        },
        before,
        after,
      ),
    ).toEqual({
      proCode: 'P009',
      proName: 'Zinc',
      unit: 'TAB',
      fromQuantity: 0,
      toQuantity: 4,
    });
  });

  it('reports a removal, leaving from-quantity empty when units differ', () => {
    const remove = (proCode: string) =>
      describeSaleCartChange(
        { kind: 'REMOVE_PRODUCT', proCode, expectedCartVersion: '1' },
        before,
        { cart: [] },
      );
    expect(remove('P001')).toEqual({
      proCode: 'P001',
      proName: 'Paracetamol',
      unit: 'BOX',
      fromQuantity: 2,
      toQuantity: 0,
    });
    expect(remove('P002')).toEqual({
      proCode: 'P002',
      proName: 'Vitamin C',
      unit: null,
      fromQuantity: null,
      toQuantity: 0,
    });
  });
});
