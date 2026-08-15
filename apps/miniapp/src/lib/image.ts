import Taro from '@tarojs/taro'

// 图片压缩：最长边 ≤ MAX_DIMENSION、JPEG 质量（wx.compressImage 0–100 刻度）。
// 语义与 Web 端 apps/frontend/src/lib/image.ts 一致，但 transport 走 Taro 平台 API。
// 注意：Web 端 quality 为 canvas toBlob 的 0–1 刻度，此处 wx.compressImage 为 0–100。
export const MAX_DIMENSION = 2048
export const JPEG_QUALITY = 80

export interface ImageSize {
  width: number
  height: number
}

/** 纯函数：保持宽高比，把最长边压到 maxDimension 以内（不足则原样返回）。 */
export function computeTargetSize(
  width: number,
  height: number,
  maxDimension = MAX_DIMENSION,
): ImageSize {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height }
  }
  if (width >= height) {
    return { width: maxDimension, height: Math.round((height * maxDimension) / width) }
  }
  return { height: maxDimension, width: Math.round((width * maxDimension) / height) }
}

/** 读取图片原始尺寸。 */
function getImageSize(src: string): Promise<ImageSize> {
  return Taro.getImageInfo({ src }).then((info) => ({ width: info.width, height: info.height }))
}

/** 压缩图片：超出尺寸时缩放并重编码为 JPEG；否则原样返回（避免无谓重编码）。 */
export async function compressImage(
  src: string,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<string> {
  const { width, height } = await getImageSize(src)
  const target = computeTargetSize(width, height, maxDimension)
  if (target.width === width && target.height === height) {
    return src
  }
  const res = await Taro.compressImage({
    src,
    quality,
    compressedWidth: target.width,
    compressedHeight: target.height,
  })
  return res.tempFilePath
}
