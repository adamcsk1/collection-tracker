import sharp from 'sharp';

export const buildAvatar = (background = '#336699'): Promise<Buffer> =>
  sharp({ create: { width: 32, height: 24, channels: 3, background } })
    .png()
    .toBuffer();
