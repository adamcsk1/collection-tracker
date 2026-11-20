import {
  USER_AVATAR_MAX_BASE64_LENGTH,
  USER_AVATAR_MAX_BYTES,
  USER_AVATAR_MAX_PIXELS,
  USER_AVATAR_SIZE,
  USER_PROFILE_DISPLAY_NAME_MAX_LENGTH,
} from '@shared/constants/user-profile-const';
import sharp from 'sharp';

export const parseUserDisplayName = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== 'string' || /\p{Cc}/u.test(value)) return undefined;
  const displayName = value.trim();
  if (Array.from(displayName).length > USER_PROFILE_DISPLAY_NAME_MAX_LENGTH) return undefined;
  return displayName || null;
};

const isAnimatedPng = (image: Buffer): boolean => {
  if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= image.length;) {
    if (image.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += 12 + image.readUInt32BE(offset);
  }
  return false;
};

const isMultiPictureJpeg = (image: Buffer): boolean => {
  if (image[0] !== 0xff || image[1] !== 0xd8) return false;
  for (let offset = 2; offset + 4 <= image.length;) {
    if (image[offset] !== 0xff) return false;
    let markerOffset = offset + 1;
    while (image[markerOffset] === 0xff) markerOffset++;
    if (markerOffset + 2 >= image.length || image[markerOffset] === 0xda || image[markerOffset] === 0xd9) return false;
    const length = image.readUInt16BE(markerOffset + 1);
    if (length < 2 || markerOffset + 1 + length > image.length) return false;
    if (
      image[markerOffset] === 0xe2 &&
      length >= 6 &&
      image.toString('ascii', markerOffset + 3, markerOffset + 7) === 'MPF\0'
    )
      return true;
    offset = markerOffset + 1 + length;
  }
  return false;
};

export const sanitizeUserAvatar = async (value: unknown): Promise<Buffer | undefined> => {
  if (typeof value !== 'string' || !value.length || value.length > USER_AVATAR_MAX_BASE64_LENGTH) return undefined;
  const image = Buffer.from(value, 'base64');
  if (
    image.length > USER_AVATAR_MAX_BYTES ||
    image.toString('base64') !== value ||
    isAnimatedPng(image) ||
    isMultiPictureJpeg(image)
  )
    return undefined;
  try {
    const pipeline = sharp(image, { limitInputPixels: USER_AVATAR_MAX_PIXELS, failOn: 'warning' });
    const metadata = await pipeline.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
      (metadata.pages ?? 1) > 1 ||
      metadata.loop !== undefined
    ) {
      return undefined;
    }
    return await pipeline
      .rotate()
      .resize(USER_AVATAR_SIZE, USER_AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp()
      .toBuffer();
  } catch {
    return undefined;
  }
};
