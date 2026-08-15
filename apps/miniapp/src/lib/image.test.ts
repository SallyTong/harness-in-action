import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'

import { compressImage, computeTargetSize, MAX_DIMENSION } from './image'

describe('image > computeTargetSize', () => {
  it('keeps small images unchanged', () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('scales down wide images by width', () => {
    expect(computeTargetSize(4000, 2000)).toEqual({ width: 2048, height: 1024 })
  })

  it('scales down tall images by height', () => {
    expect(computeTargetSize(2000, 4000)).toEqual({ width: 1024, height: 2048 })
  })

  it('keeps boundary-sized square images unchanged', () => {
    expect(computeTargetSize(2048, 2048)).toEqual({ width: 2048, height: 2048 })
  })

  it('rounds fractional dimensions to integers', () => {
    expect(computeTargetSize(3000, 2000)).toEqual({ width: 2048, height: 1365 })
  })

  it('preserves the max dimension constant', () => {
    expect(MAX_DIMENSION).toBe(2048)
  })
})

describe('image > compressImage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns original path when already within bounds', async () => {
    vi.mocked(Taro.getImageInfo).mockResolvedValue({ width: 800, height: 600 } as never)
    const result = await compressImage('/tmp/a.jpg')
    expect(result).toBe('/tmp/a.jpg')
    expect(Taro.compressImage).not.toHaveBeenCalled()
  })

  it('compresses and returns the new temp path when oversized', async () => {
    vi.mocked(Taro.getImageInfo).mockResolvedValue({ width: 4000, height: 2000 } as never)
    vi.mocked(Taro.compressImage).mockResolvedValue({ tempFilePath: '/tmp/b.jpg' } as never)

    const result = await compressImage('/tmp/a.jpg')

    expect(result).toBe('/tmp/b.jpg')
    expect(Taro.compressImage).toHaveBeenCalledWith({
      src: '/tmp/a.jpg',
      quality: 80,
      compressedWidth: 2048,
      compressedHeight: 1024,
    })
  })
})
