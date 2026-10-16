export type DecodeOptions = {
  colorTransform?: boolean
  formatAsRGBA?: boolean
  tolerantDecoding?: boolean
  maxResolutionInMP?: number
  maxMemoryUsageInMB?: number
}

export type DecodedImage = { width: number; height: number; data: Uint8Array }

export function decode(jpegData: Uint8Array, userOpts?: DecodeOptions): DecodedImage
