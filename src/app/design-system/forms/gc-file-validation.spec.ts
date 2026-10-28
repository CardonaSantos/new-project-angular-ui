import { gcCheckFiles } from './gc-file-validation';

describe('Gc file checks', () => {
  it('accepts images and rejects oversized or unsupported files', () => {
    const good = new File(['ok'], 'good.png', { type: 'image/png' });
    const bad = new File(['not image'], 'bad.txt', { type: 'text/plain' });
    const large = new File(['very large'], 'large.png', { type: 'image/png' });
    const result = gcCheckFiles([good, bad, large], {
      maxFiles: 2,
      maxBytes: 4,
      allowedMime: ['image/png'],
    });
    expect(result.accepted).toEqual([good]);
    expect(result.errors).toHaveLength(2);
  });
});
