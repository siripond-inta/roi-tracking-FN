import { BahtPipe } from './baht.pipe';

describe('BahtPipe', () => {
  const pipe = new BahtPipe();

  it('formats full amounts with a leading minus for negatives', () => {
    expect(pipe.transform(1234.5)).toBe('฿1,235');
    expect(pipe.transform(-353000)).toBe('-฿353,000');
    expect(pipe.transform(null)).toBe('-');
  });

  it('keeps whole-number zeros when compacting', () => {
    expect(pipe.transform(380000, true)).toBe('฿380K');
    expect(pipe.transform(300000, true)).toBe('฿300K');
    expect(pipe.transform(1_130_000, true)).toBe('฿1.13M');
    expect(pipe.transform(2_000_000, true)).toBe('฿2M');
    expect(pipe.transform(-45_500, true)).toBe('-฿45.5K');
    expect(pipe.transform(9_500, true)).toBe('฿9,500');
  });
});
