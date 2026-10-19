import { describe, expect, test } from 'claude-code/testing'

import { loadImageTag, loadPicture } from './images'
import { fakePorts } from './ports.fake'

// 1x1 transparent PNG.
const PNG = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
const source = async () => ({ bytes: PNG })
const PASTE_CACHE = '/tmp/claude-501/-Users-me/session-1/images'

// 2x2, ten frames of 50 ms.
const TEN_FRAMES =
  'R0lGODlhAgACAIEAAAAA/wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEBQAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIEZAOYAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIEyAM0AAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIFLALQAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIFkAJsAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIF9AIIAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIGWAGkAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIGvAFAAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIHIADcAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIHhAB4AAAAAAAAAAAAIBgABCAQQEAA7'

describe('loadPicture', () => {
  test('writes a picture to the frame cache once and shares it', async () => {
    const { ports, runs } = fakePorts()

    const first = await loadPicture(ports, 'once', source)
    const second = await loadPicture(ports, 'once', source)

    expect(second).toBe(first)
    expect(first?.frames.map(frame => frame.source)).toEqual([{ file: expect.stringMatching(/^\/tmp\/claude-501\/media-view\/[0-9a-f]{16}\/0\.png$/), format: 'png' }])
    expect(runs.map(command => command.argv[0])).toEqual(['mkdir', '/bin/sh'])
  })

  test('resolves null for a source that is no picture, without writing', async () => {
    const { ports, runs } = fakePorts()

    expect(await loadPicture(ports, 'not-a-picture', async () => ({ bytes: new Uint8Array([1]) }))).toBeNull()
    expect(runs).toEqual([])
  })

  test('forgets a failed attempt, asks for a redraw, and succeeds on the next call', async () => {
    let calls = 0
    const { ports, redraws } = fakePorts({}, {
      run: async () => {
        if (calls++ === 0) {
          throw new Error('aborted')
        }
      },
    })

    expect(await loadPicture(ports, 'retried', source)).toBeNull()
    expect(redraws()).toBe(1)
    expect(await loadPicture(ports, 'retried', source)).not.toBeNull()
  })

  test('gives up after three retries: later calls neither write nor ask for redraws', async () => {
    let attempts = 0
    const { ports, redraws } = fakePorts({}, {
      run: async () => {
        attempts++
        throw new Error('read-only')
      },
    })

    for (let call = 0; call < 6; call++) {
      await loadPicture(ports, 'broken', source)
    }

    expect(attempts).toBe(4)
    expect(redraws()).toBe(3)
  })
})

describe('loadPicture of a converted format', () => {
  // 3x2 lossy WebP.
  const WEBP = Uint8Array.fromBase64('UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoDAAIAAsBMJaACdLoAA5gA/u2QP4hd7G2//PTP62/j/xkAAAA=')
  const webp = async () => ({ bytes: WEBP })
  // The header of an extended WebP declaring a 20000x20000 canvas.
  const HUGE_WEBP = new Uint8Array([
    ...new TextEncoder().encode('RIFF'), 0x16, 0, 0, 0, ...new TextEncoder().encode('WEBPVP8X'), 0x0a, 0, 0, 0, 0, 0, 0, 0, 0x1f, 0x4e, 0, 0x1f, 0x4e, 0,
  ])
  const CONVERTED = /^\/tmp\/claude-501\/media-view\/[0-9a-f]{16}\/source\.png$/

  test('has the OS convert it to a PNG next to its frames, and draws that', async () => {
    const { ports, runs } = fakePorts({}, {
      readFile: async path => {
        if (!CONVERTED.test(path)) {
          throw new Error(`ENOENT: ${path}`)
        }
        return PNG
      },
    })

    const picture = await loadPicture(ports, 'webp', webp)

    expect(picture).toMatchObject({ width: 1, height: 1 })
    expect(runs[2]?.argv).toEqual(['sips', '-s', 'format', 'png', expect.stringMatching(/\/source$/), '--out', expect.stringMatching(CONVERTED)])
    expect(runs[1]?.init.stdin).toBe(WEBP.toBase64())
  })

  test('resolves null for good when the OS cannot convert it: no retry, no redraw', async () => {
    let conversions = 0
    const { ports, redraws } = fakePorts({}, {
      run: async ({ argv }) => {
        if (argv[0] === 'sips') {
          conversions++
          throw new Error('sips exited 13: Cannot extract image from file.')
        }
      },
    })

    expect(await loadPicture(ports, 'broken-webp', webp)).toBeNull()
    expect(await loadPicture(ports, 'broken-webp', webp)).toBeNull()
    expect(conversions).toBe(1)
    expect(redraws()).toBe(0)
  })

  test('resolves null for one declaring more pixels than the decoders take, without handing it to the OS', async () => {
    const { ports, runs } = fakePorts()

    expect(await loadPicture(ports, 'huge-webp', async () => ({ bytes: HUGE_WEBP }))).toBeNull()
    expect(runs).toEqual([])
  })

  test('resolves null for good when the PNG the OS wrote cannot be read back: no second conversion', async () => {
    let conversions = 0
    const { ports, redraws } = fakePorts({}, {
      run: async ({ argv }) => {
        conversions += argv[0] === 'sips' ? 1 : 0
      },
      readFile: async path => {
        throw new Error(`${path} is 70 MiB, over the 64 MiB media-view reads`)
      },
    })

    expect(await loadPicture(ports, 'unreadable-png', webp)).toBeNull()
    expect(await loadPicture(ports, 'unreadable-png', webp)).toBeNull()
    expect(conversions).toBe(1)
    expect(redraws()).toBe(0)
  })

  test('resolves null while the person has conversion turned off, and converts once it is turned on', async () => {
    let isConverting = false
    const { ports, runs } = fakePorts({}, {
      convertsFormats: async () => isConverting,
      readFile: async path => {
        if (!CONVERTED.test(path)) {
          throw new Error(`ENOENT: ${path}`)
        }
        return PNG
      },
    })

    expect(await loadPicture(ports, 'webp-off', webp)).toBeNull()
    expect(runs).toEqual([])
    isConverting = true

    expect(await loadPicture(ports, 'webp-off', webp)).toMatchObject({ width: 1, height: 1 })
  })

  test('resolves null on Linux, which has no converter, without running anything', async () => {
    const { ports, runs } = fakePorts({}, {
      host: async () => ({ os: 'linux', tmpRoot: '/tmp/claude-1000', cacheRoot: '/tmp/claude-1000/media-view' }),
    })

    expect(await loadPicture(ports, 'webp-on-linux', webp)).toBeNull()
    expect(runs).toEqual([])
  })
})

describe('loadImageTag', () => {
  test('retries an image tag whose paste Claude Code has not written yet', async () => {
    let isWritten = false
    const { ports, redraws } = fakePorts({ [`${PASTE_CACHE}/3.png`]: PNG }, {
      listDirectory: async path =>
        path === '/tmp/claude-501' ? [{ name: '-Users-me', kind: 'dir' }] : isWritten ? [{ name: '3.png', kind: 'file' }] : [],
      exists: async path => path === PASTE_CACHE,
    })

    expect(await loadImageTag(ports, 'session-1', 3)).toBeNull()
    isWritten = true

    expect(redraws()).toBe(1)
    expect(await loadImageTag(ports, 'session-1', 3)).not.toBeNull()
  })
})

describe('loadPicture on long GIFs', () => {
  test('runs at most four writes at a time', async () => {
    let running = 0
    let mostAtOnce = 0
    const { ports } = fakePorts({}, {
      run: async () => {
        running++
        mostAtOnce = Math.max(mostAtOnce, running)
        await Promise.resolve()
        running--
      },
    })

    const picture = await loadPicture(ports, 'ten-frames', async () => ({ bytes: Uint8Array.fromBase64(TEN_FRAMES) }))

    expect(picture?.frames.length).toBe(10)
    expect(mostAtOnce).toBe(4)
  })
})

describe('loadPicture keeps decoding apart from writing', () => {
  test('decodes once though the write is retried', async () => {
    let loads = 0
    let writes = 0
    const { ports } = fakePorts({}, {
      run: async () => {
        if (writes++ === 0) {
          throw new Error('aborted')
        }
      },
    })
    const counted = async () => {
      loads++
      return { bytes: PNG }
    }

    await loadPicture(ports, 'decode-once', counted)
    const picture = await loadPicture(ports, 'decode-once', counted)

    expect(picture).not.toBeNull()
    expect(loads).toBe(1)
  })

  test('keeps an image that cannot be decoded absent, without retrying', async () => {
    const { ports, redraws, runs } = fakePorts()
    // A JPEG header and nothing after it.
    const broken = async () => ({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 8, 0, 16, 3]) })

    expect(await loadPicture(ports, 'undecodable', broken)).toBeNull()
    expect(await loadPicture(ports, 'undecodable', broken)).toBeNull()
    expect(redraws()).toBe(0)
    expect(runs).toEqual([])
  })

  test('runs at most four writes at a time across pictures', async () => {
    let running = 0
    let mostAtOnce = 0
    const { ports } = fakePorts({}, {
      run: async () => {
        running++
        mostAtOnce = Math.max(mostAtOnce, running)
        await Promise.resolve()
        running--
      },
    })

    await Promise.all(['a', 'b', 'c'].map(key => loadPicture(ports, `across-${key}`, async () => ({ bytes: Uint8Array.fromBase64(TEN_FRAMES) }))))

    expect(mostAtOnce).toBe(4)
  })
})

describe('loadImageTag and the paste cache', () => {
  test('retries a paste read while Claude Code is still writing it', async () => {
    let isWritten = false
    const pasteCache = '/tmp/claude-501/-Users-me/session-partial/images'
    const { ports } = fakePorts({}, {
      listDirectory: async path => (path === '/tmp/claude-501' ? [{ name: '-Users-me', kind: 'dir' }] : [{ name: '7.png', kind: 'file' }]),
      exists: async path => path === pasteCache,
      readFile: async () => (isWritten ? PNG : PNG.subarray(0, PNG.length - 6)),
    })

    expect(await loadImageTag(ports, 'session-partial', 7)).toBeNull()
    isWritten = true

    expect(await loadImageTag(ports, 'session-partial', 7)).not.toBeNull()
  })

  test('leaves a paste it cannot decode absent at once, without reading it or asking for redraws', async () => {
    const read: string[] = []
    const pasteCache = '/tmp/claude-501/-Users-me/session-webp/images'
    const { ports, redraws } = fakePorts({}, {
      listDirectory: async path => (path === '/tmp/claude-501' ? [{ name: '-Users-me', kind: 'dir' }] : [{ name: '4.webp', kind: 'file' }]),
      exists: async path => path === pasteCache,
      readFile: async path => (read.push(path), PNG),
    })

    expect(await loadImageTag(ports, 'session-webp', 4)).toBeNull()
    expect(await loadImageTag(ports, 'session-webp', 4)).toBeNull()
    expect([read, redraws()]).toEqual([[], 0])
  })

  test('looks the session’s paste cache folder up once', async () => {
    const listed: string[] = []
    const pasteCache = '/tmp/claude-501/-Users-me/session-once/images'
    const { ports } = fakePorts({ [`${pasteCache}/1.png`]: PNG, [`${pasteCache}/2.png`]: PNG }, {
      listDirectory: async path => {
        listed.push(path)
        return path === '/tmp/claude-501' ? [{ name: '-Users-me', kind: 'dir' }] : [{ name: '1.png', kind: 'file' }, { name: '2.png', kind: 'file' }]
      },
      exists: async path => path === pasteCache,
    })

    await loadImageTag(ports, 'session-once', 1)
    await loadImageTag(ports, 'session-once', 2)

    expect(listed.filter(path => path === '/tmp/claude-501')).toEqual(['/tmp/claude-501'])
  })
})
