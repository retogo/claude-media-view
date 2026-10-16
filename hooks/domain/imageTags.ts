const IMAGE_TAG = /\[Image #(\d+)\]/g

// The numbers of the `[Image #n]` tags in a prompt, each once, in order.
export const imageTagNumbers = (text: string) => [...new Set([...text.matchAll(IMAGE_TAG)].map(match => Number(match[1])))]

// The paste cache file of image tag `n`, whatever its extension.
export const imageFileName = (names: readonly string[], n: number) => names.find(name => name.startsWith(`${n}.`))
