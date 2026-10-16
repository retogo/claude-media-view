// Indices of `max` frames spread evenly over `count`, first and last included.
export const sampleIndices = (count: number, max: number) => {
  if (count <= max) {
    return Array.from({ length: count }, (_, i) => i)
  }
  if (max === 1) {
    return [0]
  }
  return Array.from({ length: max }, (_, i) => Math.round((i * (count - 1)) / (max - 1)))
}
