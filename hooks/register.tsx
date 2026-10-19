import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { stopAnimations } from './adapters/animator'
import { enginePorts } from './adapters/engine'
import { drawAbovePrompt, drawMediaViewPane, drawPictureRows } from './adapters/views'
import { openCommand } from './domain/platform'
import { mediaViewClosed } from './usecases/closes/mediaView'
import { mediaView } from './usecases/commandRuns/mediaView'
import { rememberReadPath } from './usecases/images'
import { abovePrompt, watchDraft } from './usecases/renders/abovePrompt'
import { MEDIA_VIEW_PANE, mediaViewPane } from './usecases/renders/pane/mediaView'
import { toolGroup } from './usecases/renders/toolGroup'
import { toolResult } from './usecases/renders/toolResult'
import { userMessage } from './usecases/renders/userMessage'
import { promptSubmits } from './usecases/promptSubmits'
import { sessionStarts } from './usecases/sessionStarts'
import { anyTool } from './usecases/toolCalls/anyTool'
import { frames } from './usecases/toolCalls/frames'
import type { Ports } from './usecases/ports'

const TRANSCRIPT_SITES = ['ToolGroup', 'ToolResult', 'UserMessage'] as const

// State refs live where they are read and written (ADR 0014); types/index.d.ts lists them.
const isTranscriptAnimated = atom({ plugin: 'media-view', key: 'isTranscriptAnimated' } as const, true)
const draftImageNumbers = atom({ plugin: 'media-view', key: 'draftImageNumbers' } as const, [])
const mediaViewScrollOffset = atom({ plugin: 'media-view', key: 'mediaViewScrollOffset' } as const, 0)
const shownAt = atom({ plugin: 'media-view', key: 'shownAt' } as const, {})

// Ports over the session's $, made at session.start: work they start outlives the render that asked for it,
// which a newer draw of the same row would otherwise cut short (ADR 0007). Without a session (tests that only
// draw), a hook's own $ serves.
let sessionPorts: Ports | undefined

// Keeps when an image first showed in the chat; a later sight of it changes nothing.
async function recordShown($: EngineInterface, key: string) {
  const at = await $.clock.now()
  await update($, shownAt, times => (key in times ? times : { ...times, [key]: at }))
}
const portsFor = ($: EngineInterface) => sessionPorts ?? enginePorts($)

// The composition root: every hook, each answered by a usecase over the engine's ports (ADRs 0014, 0015).
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    sessionPorts = enginePorts($)
    await sessionStarts({
      watchDraft: () =>
        watchDraft({
          every: (ms, tick) => $.clock.every(ms, () => void tick()),
          readDraft: async () => (await $.prompt.read()).text,
          // `change` hands back `current` itself when nothing changed: then nothing is written.
          updateDraftNumbers: async change => {
            const current = await read($, draftImageNumbers)
            const changed = change(current)
            if (changed !== current) {
              await update($, draftImageNumbers, () => [...changed])
            }
          },
        }),
      registerTool: async tool => {
        await $.tool.register({ ...tool, isDeferred: false })
      },
      registerCommand: async command => {
        await $.command.register(command)
      },
    })
    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const numbers = await read($, draftImageNumbers)
    const view = e.props.hasSurvey
      ? null
      : await abovePrompt(portsFor($), { numbers, bodyColumns: e.props.bodyColumns, maxRows: e.props.maxRows })
    if (view === null) {
      stopAnimations('AbovePrompt', e.requestId)
      return next(e)
    }
    return drawAbovePrompt($, e, view)
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const rows = await toolGroup(portsFor($), { requestId: e.requestId, calls: e.props.calls, viewportColumns: e.viewport?.columns })
    const own = await next(e)
    return rows === null ? own : drawPictureRows($, e, { site: 'ToolGroup', own, rows, isAnimated: await read($, isTranscriptAnimated) })
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const rows = await toolResult(portsFor($), {
      toolUseId: e.props.tool_use_id,
      tool: e.props.tool,
      output: e.props.output,
      viewportColumns: e.viewport?.columns,
    })
    const own = await next(e)
    return rows === null ? own : drawPictureRows($, e, { site: 'ToolResult', own, rows, isAnimated: await read($, isTranscriptAnimated) })
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const rows = await userMessage(portsFor($), {
      requestId: e.requestId,
      text: e.props.text,
      isFromSomeoneElse: e.props.from !== undefined,
      viewportColumns: e.viewport?.columns,
    })
    const own = await next(e)
    return rows === null ? own : drawPictureRows($, e, { site: 'UserMessage', own, rows, isAnimated: await read($, isTranscriptAnimated) })
  })

  on('ui.render', { component: 'Pane', requestId: MEDIA_VIEW_PANE }, async ($, e) => {
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>media-view draws pictures in the terminal.</Text>
    }
    // Read so that a scroll of this pane (written below) redraws this pane alone.
    await read($, mediaViewScrollOffset)
    const ports = portsFor($)
    const entries = await mediaViewPane(ports, { bodyColumns: e.props.bodyColumns, scroll: e.props.scroll, shownAt: await read($, shownAt) })
    return drawMediaViewPane($, e, entries, {
      copyPath: path => $.ui.copy({ text: path }),
      open: async path => ports.run(openCommand((await ports.host()).os, path)),
      showInChat: rowId => $.ui.scroll({ to: { requestId: rowId }, block: 'center' }),
    })
  })

  on('ui.scroll', { requestId: MEDIA_VIEW_PANE }, async ($, e, next) => {
    const scrolled = await next(e)
    await update($, mediaViewScrollOffset, () => e.offset)
    return scrolled
  })

  on('ui.close', ($, e, next) => {
    mediaViewClosed(e.id, { stopPaneAnimations: () => stopAnimations('Pane') })
    return next(e)
  })

  on('command.run', { command: 'media-view' }, async ($, e) => ({
    text: await mediaView(
      {
        openPane: async () => {
          await $.ui.open({ id: MEDIA_VIEW_PANE, title: 'Media' })
        },
        setTranscriptAnimated: async isAnimated => {
          await update($, isTranscriptAnimated, () => isAnimated)
          if (!isAnimated) {
            TRANSCRIPT_SITES.forEach(site => stopAnimations(site))
          }
        },
      },
      e.args,
    ),
  }))

  on('tool.call', { tool: 'mcp__media-view__frames' }, async ($, e) => frames(portsFor($), e))

  // Any call: a Read's path, which a ToolResult row's props do not carry, and when a result's images showed.
  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Read') {
      rememberReadPath(e.tool_use_id, e.file_path)
    }
    const called = await next(e)
    await anyTool(key => recordShown($, key), { tool: e.tool, toolUseId: e.tool_use_id, result: 'result' in called ? called.result : undefined })
    return called
  })

  // Only a prompt from this session's own composer carries its pastes; another agent's or session's numbers its own.
  on('prompt.submit', async ($, e, next) => {
    const submitted = await next(e)
    if (submitted.drop === undefined && e.origin.kind === 'composer') {
      await promptSubmits(key => recordShown($, key), submitted.text)
    }
    return submitted
  })
}
