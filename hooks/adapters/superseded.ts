// A draw that a newer draw of the same row superseded is aborted, and its `$` calls then reject: the engine has gone
// on without its tree, so the failure means nothing and `superseded` answers in its place (ADR 0024). A failure of
// a draw still under way is thrown on.
export async function drawnUnlessSuperseded<T>(signal: AbortSignal, draw: () => Promise<T>, superseded: () => T): Promise<T> {
  try {
    return await draw()
  } catch (error) {
    if (signal.aborted) {
      return superseded()
    }
    throw error
  }
}
