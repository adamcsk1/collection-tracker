import { USER_AVATAR_MAX_BYTES } from '@shared/constants/user-profile-const';
import sharp from 'sharp';
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseUserDisplayName, sanitizeUserAvatar } from './user-profile-util';

describe('parseUserDisplayName', () => {
  it('trims whitespace, clears empty names, and counts Unicode code points', () => {
    expect(parseUserDisplayName('  Name  ')).toBe('Name');
    expect(parseUserDisplayName('  ')).toBeNull();
    expect(parseUserDisplayName(null)).toBeNull();
    expect(parseUserDisplayName('🐈'.repeat(80))).toBe('🐈'.repeat(80));
    expect(parseUserDisplayName('🐈'.repeat(81))).toBeUndefined();
  });

  it.each([undefined, {}, 3, 'a\nb', 'a\tb', '\u0000name', 'name\u007f', '\u0085'])(
    'rejects invalid name %j',
    (value) => {
      expect(parseUserDisplayName(value)).toBeUndefined();
    }
  );
});

describe('sanitizeUserAvatar', () => {
  it('applies EXIF rotation and center cropping before stripping orientation', async () => {
    const pixels = Buffer.alloc(300 * 100 * 3);
    for (let row = 0; row < 100; row++) {
      for (let column = 100; column < 200; column++) {
        pixels[(row * 300 + column) * 3 + (row < 50 ? 0 : 2)] = 255;
      }
    }
    const input = await sharp(pixels, { raw: { width: 300, height: 100, channels: 3 } })
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 100 })
      .toBuffer();
    const output = await sanitizeUserAvatar(input.toString('base64'));
    const decoded = await sharp(output!).removeAlpha().raw().toBuffer();
    const left = (128 * 256 + 16) * 3;
    const right = (128 * 256 + 240) * 3;
    expect(decoded[left + 2]).toBeGreaterThan(220);
    expect(decoded[left]).toBeLessThan(20);
    expect(decoded[right]).toBeGreaterThan(220);
    expect(decoded[right + 2]).toBeLessThan(20);
  });

  it.each(['jpeg', 'png', 'webp'] as const)('accepts actual %s and outputs a stripped 256px WebP', async (format) => {
    const input = await sharp({ create: { width: 300, height: 150, channels: 3, background: 'red' } })
      .withMetadata()
      .toFormat(format)
      .toBuffer();
    const output = await sanitizeUserAvatar(input.toString('base64'));
    expect(output).toBeInstanceOf(Buffer);
    const metadata = await sharp(output!).metadata();
    expect(metadata).toMatchObject({ width: 256, height: 256, format: 'webp' });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it.each([undefined, 1, '', 'AA', 'AB==', 'AA==\n', 'data:image/png;base64,AA==', '%%%%', 'not-an-image'])(
    'rejects noncanonical base64 or invalid image %j',
    async (value) => {
      expect(await sanitizeUserAvatar(value)).toBeUndefined();
    }
  );

  it('rejects more than 5 MiB even when base64 length has the same rounded bound', async () => {
    expect(await sanitizeUserAvatar(Buffer.alloc(USER_AVATAR_MAX_BYTES + 1).toString('base64'))).toBeUndefined();
  });

  it('rejects more than 25 megapixels before decoding full pixels', async () => {
    const input = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    expect(await sanitizeUserAvatar(input.toString('base64'))).toBeUndefined();
  });

  it('rejects actual GIF and SVG images regardless of caller content', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } })
      .gif()
      .toBuffer();
    expect(await sanitizeUserAvatar(gif.toString('base64'))).toBeUndefined();
    expect(
      await sanitizeUserAvatar(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').toString('base64')
      )
    ).toBeUndefined();
  });

  it('rejects animated WebP rather than silently taking its first frame', async () => {
    const frames = Buffer.alloc(2 * 2 * 3 * 2, 128);
    frames.fill(255, frames.length / 2);
    const animated = await sharp(frames, { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    expect(await sanitizeUserAvatar(animated.toString('base64'))).toBeUndefined();
  });

  it('rejects JPEG multi-picture metadata that the decoder would otherwise ignore', async () => {
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .jpeg()
      .toBuffer();
    const multiPictureMarker = Buffer.from([0xff, 0xe2, 0, 6, 0x4d, 0x50, 0x46, 0]);
    const multiPicture = Buffer.concat([jpeg.subarray(0, 2), multiPictureMarker, jpeg.subarray(2)]);
    expect((await sharp(multiPicture).raw().toBuffer()).length).toBe(12);
    expect(await sanitizeUserAvatar(multiPicture.toString('base64'))).toBeUndefined();
  });

  it('rejects APNG animation-control chunks even if the decoder only sees its first frame', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    const chunk = (name: string, data: Buffer): Buffer => {
      const result = Buffer.alloc(data.length + 12);
      result.writeUInt32BE(data.length, 0);
      result.write(name, 4, 'ascii');
      data.copy(result, 8);
      result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
      return result;
    };
    const animation = Buffer.alloc(8);
    animation.writeUInt32BE(2);
    const frame = Buffer.alloc(26);
    frame.writeUInt32BE(2, 4);
    frame.writeUInt32BE(2, 8);
    frame.writeUInt16BE(1, 20);
    frame.writeUInt16BE(10, 22);
    const secondFrame = Buffer.from(frame);
    secondFrame.writeUInt32BE(1);
    const imageChunks: Buffer[] = [];
    for (let offset = 8; offset + 12 <= png.length;) {
      const length = png.readUInt32BE(offset);
      if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT')
        imageChunks.push(png.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const imageData = Buffer.concat(imageChunks);
    const frameData = Buffer.alloc(imageData.length + 4);
    frameData.writeUInt32BE(2);
    imageData.copy(frameData, 4);
    const animated = Buffer.concat([
      png.subarray(0, 33),
      chunk('acTL', animation),
      chunk('fcTL', frame),
      chunk('IDAT', imageData),
      chunk('fcTL', secondFrame),
      chunk('fdAT', frameData),
      png.subarray(-12),
    ]);
    expect((await sharp(animated, { failOn: 'warning' }).raw().toBuffer()).length).toBe(12);
    expect(await sanitizeUserAvatar(animated.toString('base64'))).toBeUndefined();
  });

  it('rejects truncated images after header detection', async () => {
    const input = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    expect(await sanitizeUserAvatar(input.subarray(0, input.length - 30).toString('base64'))).toBeUndefined();
  });
});
