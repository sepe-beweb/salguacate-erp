import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogImageSource, validCatalogImageUrl } from '../../apps/erp-web/src/catalogData';
const image = 'https://res.cloudinary.com/synthetic-cloud/image/upload/v123/salguacate/inventory/12345678-1234-4123-8123-123456789abc.png';
afterEach(() => vi.unstubAllEnvs());
describe('Explicit catalogue image destinations', () => {
  it('preserves local photos and requires an exact configured Cloudinary account', () => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', '');
    expect(validCatalogImageUrl('/uploads/photo.png')).toBe(true);
    expect(catalogImageSource('/uploads/photo.png', 'https://api.example')).toBe('https://api.example/uploads/photo.png');
    expect(validCatalogImageUrl(image)).toBe(false);
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'synthetic-cloud');
    expect(validCatalogImageUrl(image)).toBe(true); expect(catalogImageSource(image, 'https://api.example')).toBe(image);
  });
  it.each([
    image.replace('synthetic-cloud', 'other-cloud'), image.replace('res.cloudinary.com', 'res.cloudinary.com.evil.test'),
    image.replace('https:', 'http:'), image + '?tracking=1', image + '#hash', image.replace('/salguacate/inventory/', '/arbitrary/'),
    image.replace('.png', '.svg'), image.replace('/v123/', '/../'), 'https://evil.test/photo.png', '//res.cloudinary.com/test.png',
  ])('rejects unapproved URL %s', url => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'synthetic-cloud');
    expect(validCatalogImageUrl(url)).toBe(false); expect(() => catalogImageSource(url, '')).toThrow();
  });
});
