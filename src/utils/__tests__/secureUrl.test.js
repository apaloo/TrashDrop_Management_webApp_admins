import { secureUrl, secureUrls } from '../secureUrl';

describe('secureUrl', () => {
  it('upgrades http links to https', () => {
    expect(secureUrl('http://x.supabase.co/storage/v1/object/public/a.jpg')).toBe('https://x.supabase.co/storage/v1/object/public/a.jpg');
    expect(secureUrl('HTTP://example.com/a.png')).toBe('https://example.com/a.png');
    expect(secureUrl(' http://example.com/a.png ')).toBe('https://example.com/a.png');
  });

  it('leaves other values alone', () => {
    expect(secureUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(secureUrl('/images/a.png')).toBe('/images/a.png');
    expect(secureUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(secureUrl('blob:http://localhost/1')).toBe('blob:http://localhost/1');
    expect(secureUrl('https://example.com/?next=http://a')).toBe('https://example.com/?next=http://a');
    expect(secureUrl(null)).toBe(null);
    expect(secureUrl(undefined)).toBe(undefined);
  });

  it('maps lists', () => {
    expect(secureUrls(['http://a/1.jpg', 'https://a/2.jpg'])).toEqual(['https://a/1.jpg', 'https://a/2.jpg']);
    expect(secureUrls(null)).toEqual([]);
  });
});
