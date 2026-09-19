import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runCloudinaryProbe } = require('../cloudinary-probe');
const { readImage } = require('../image-store');
const config = { cloudName: 'synthetic-cloud', apiKey: '123456789', apiSecret: 'synthetic-secret' };
// Header-only fixtures for transport contracts; the live harness uses browser-encoded images.
const images = ['data:image/png;base64,iVBORw0KGgo=', 'data:image/jpeg;base64,/9j/'];
function provider(mode) {
  const assets = new Map(); let uploads = 0;
  const transport = vi.fn(async (url, options) => {
    if (url.endsWith('/upload')) {
      uploads++;
      if (mode === 'forbidden') return Response.json({ error: { message: config.apiSecret } }, { status: 403 });
      if (mode === 'upload-fails' && uploads === 2) throw new Error(config.apiSecret);
      const image = readImage(options.body.get('file')), id = options.body.get('public_id');
      const secure_url = `https://res.cloudinary.com/${config.cloudName}/image/upload/v123/${id}.${image.format}`;
      assets.set(secure_url, image);
      return Response.json({ public_id: id, resource_type: 'image', type: 'upload', version: 123, bytes: image.bytes.length, format: image.format, secure_url });
    }
    if (url.endsWith('/destroy')) {
      if (mode === 'cleanup-fails') throw new Error(config.apiSecret);
      const id = options.body.get('public_id');
      for (const key of assets.keys()) if (key.includes(`/${id}.`)) assets.delete(key);
      return Response.json({ result: 'ok' });
    }
    expect(options.headers).toBeUndefined();
    const image = assets.get(url);
    return new Response(mode === 'download-differs' ? 'wrong' : image.bytes, { headers: { 'content-type': `image/${image.format === 'png' ? 'png' : 'jpeg'}` } });
  });
  return { transport, assets };
}
describe('Disposable Cloudinary HTTP probe, provider transport simulated', () => {
  it('persists and reads both references, compares bytes and retires only its assets', async () => {
    const { transport, assets } = provider();
    const report = await runCloudinaryProbe(config, config.cloudName, images, undefined, transport);
    expect(report.status).toBe('passed'); expect(report.checks).toHaveLength(2);
    expect(report.cleanup).toHaveLength(2); expect(assets.size).toBe(0);
    expect(report.requests.map(item => item.status)).toEqual([200, 200, 200, 200]);
    expect(transport).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(report)).not.toContain(config.apiSecret);
  });
  it('reports a provider rejection without its body and without a second upload', async () => {
    const { transport } = provider('forbidden'); const progress = [];
    const report = await runCloudinaryProbe(config, config.cloudName, images, event => progress.push(event), transport);
    expect(report.status).toBe('failed'); expect(report.unconfirmedUploadPossible).toBe(false);
    expect(report.requests).toEqual([{ action: 'upload', publicId: expect.stringMatching(/^salguacate\/inventory\//), status: 403 }]);
    expect(transport).toHaveBeenCalledOnce(); expect(JSON.stringify([report, progress])).not.toContain(config.apiSecret);
  });
  it.each(['upload-fails', 'download-differs', 'cleanup-fails'])('reports %s without retry or secret leakage', async mode => {
    const { transport } = provider(mode);
    const report = await runCloudinaryProbe(config, config.cloudName, images, undefined, transport);
    expect(report.status).toBe('failed'); expect(JSON.stringify(report)).not.toContain(config.apiSecret);
    const removals = transport.mock.calls.filter(([url]) => url.endsWith('/destroy'));
    expect(removals).toHaveLength(mode === 'cleanup-fails' ? 2 : 1);
    expect(new Set(removals.map(([, options]) => options.body.get('public_id'))).size).toBe(removals.length);
    expect(report.cleanup.every(item => item.status === (mode === 'cleanup-fails' ? 'unconfirmed' : 'confirmed'))).toBe(true);
  });
  it.each([['different-cloud', images], [config.cloudName, []], [config.cloudName, [...images].reverse()]])('fails closed before external calls', async (confirmation, input) => {
    const transport = vi.fn();
    await expect(runCloudinaryProbe(config, confirmation, input, undefined, transport)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});
