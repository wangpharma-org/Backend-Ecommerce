import { ElasticsearchService } from './elasticsearch.service';

describe('ECWC-745 ElasticsearchService product doc paths', () => {
  const setup = () => {
    const put = jest.fn().mockResolvedValue({ data: {} });
    const post = jest.fn().mockResolvedValue({ data: {} });
    const service = new ElasticsearchService();
    Object.assign(service, { client: { put, post } });
    return { service, put, post };
  };

  it('encodes pro_code containing "/" when indexing a product', async () => {
    const { service, put } = setup();
    const doc = { pro_code: '006/TBX-5001', pro_name: 'ทดสอบ' };
    await service.indexProduct(doc);
    expect(put).toHaveBeenCalledWith('/products/_doc/006%2FTBX-5001', doc);
  });

  it('encodes pro_code and keeps pro_code in the upsert doc', async () => {
    const { service, post } = setup();
    await service.updateProductDoc('C003/017-01', { pro_priceA: 10 });
    expect(post).toHaveBeenCalledWith('/products/_update/C003%2F017-01', {
      doc: { pro_priceA: 10, pro_code: 'C003/017-01' },
      doc_as_upsert: true,
    });
  });

  it('leaves plain codes unchanged', async () => {
    const { service, put } = setup();
    await service.indexProduct({ pro_code: 'P001' });
    expect(put).toHaveBeenCalledWith('/products/_doc/P001', {
      pro_code: 'P001',
    });
  });
});
