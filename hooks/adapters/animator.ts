import type { EngineInterface, Timer } from 'claude-code'

import { isTerminalDeny, noticeFor } from '../domain/blitDeny'
import type { Frame } from '../domain/media/frameCache'

// A blit sent in the same pass as the render that mounts its Image lands before the mount.
const RETRIES_BEFORE_MOUNT = 20
const RETRY_MS = 100

export type Site = 'AbovePrompt' | 'ToolGroup' | 'ToolResult' | 'UserMessage' | 'AssistantMessage' | 'Pane'

// One blit loop; a stopped loop's tick that was waiting on a blit sees `isStopped` and ends.
type Loop = { timer: Timer | undefined; isStopped: boolean }

const loops = new Map<string, Loop>()
const checkedStills = new Set<string>()
let isTerminalRefusing = false

const loopId = (site: Site, requestId: string, key: string) => `${site}/${requestId}/${key}`

const stop = (id: string, loop: Loop) => {
  loop.isStopped = true
  loop.timer?.cancel()
  loops.delete(id)
}

export const stopAnimation = (site: Site, requestId: string, key: string) => {
  const id = loopId(site, requestId, key)
  const loop = loops.get(id)
  if (loop !== undefined) {
    stop(id, loop)
  }
}

export const stopAnimations = (site: Site, requestId?: string) => {
  const prefix = requestId === undefined ? `${site}/` : `${site}/${requestId}/`
  for (const [id, loop] of loops) {
    if (id.startsWith(prefix)) {
      stop(id, loop)
    }
  }
}

// Stops the loops of a site's request whose Images are no longer drawn.
export const stopAnimationsExcept = (site: Site, requestId: string, keys: readonly string[]) => {
  const drawn = new Set(keys.map(key => loopId(site, requestId, key)))
  for (const [id, loop] of loops) {
    if (id.startsWith(`${site}/${requestId}/`) && !drawn.has(id)) {
      stop(id, loop)
    }
  }
}

// Swaps a keyed Image through its frames until it is unmounted or stopped. A still gets one
// blit of its own frame, which sends nothing new but tells whether this terminal draws it.
// Once the terminal refuses pictures no loop starts again: every blit would be refused too.
export function animate(
  $: EngineInterface,
  { site, requestId, key, frames }: { site: Site; requestId: string; key: string; frames: Frame[] },
  onDeny: (deny: string) => void,
) {
  const id = loopId(site, requestId, key)
  const isStill = frames.length < 2
  if (isTerminalRefusing || loops.has(id) || (isStill && checkedStills.has(id))) {
    return
  }
  checkedStills.add(id)
  const loop: Loop = { timer: undefined, isStopped: false }
  loops.set(id, loop)
  let index = 0
  let hasLanded = false
  let retries = 0
  const schedule = (ms: number) => {
    if (!loop.isStopped) {
      loop.timer = $.clock.after(ms, tick)
    }
  }
  const tick = async () => {
    const next = (index + 1) % frames.length
    const result = await $.ui.blit({ requestId, key, source: frames[next]!.source })
    if (loop.isStopped) {
      return
    }
    if (result.deny !== undefined) {
      if (isTerminalDeny(result.deny)) {
        isTerminalRefusing = true
      } else if (!hasLanded && retries++ < RETRIES_BEFORE_MOUNT) {
        schedule(RETRY_MS)
        return
      }
      stop(id, loop)
      onDeny(result.deny)
      return
    }
    hasLanded = true
    if (isStill) {
      stop(id, loop)
      return
    }
    index = next
    schedule(frames[index]!.delayMs)
  }
  schedule(isStill ? 0 : frames[0]!.delayMs)
}

const reported = new Set<string>()

// Logs the fix for a terminal deny once per session (ADR 0001).
export function reportDeny($: EngineInterface, deny: string) {
  const notice = noticeFor(deny)
  if (notice === undefined || reported.has(notice)) {
    return
  }
  reported.add(notice)
  $.ui.log(notice)
}
