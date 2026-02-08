export function createAbortError(message = 'Operation aborted'): DOMException {
  return new DOMException(message, 'AbortError')
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrencyLimit: number,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<T>[]> {
  if (tasks.length === 0) {
    return []
  }

  const normalizedConcurrency = Math.max(1, Math.floor(concurrencyLimit))
  const workerCount = Math.min(normalizedConcurrency, tasks.length)
  const results: Array<PromiseSettledResult<T> | undefined> = new Array(tasks.length)

  let nextTaskIndex = 0

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextTaskIndex < tasks.length) {
      if (signal?.aborted) {
        return
      }

      const currentIndex = nextTaskIndex
      nextTaskIndex += 1

      try {
        const value = await tasks[currentIndex]()
        results[currentIndex] = { status: 'fulfilled', value }
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }
    }
  })

  await Promise.all(workers)

  return results.map((result) => {
    if (result) {
      return result
    }

    return {
      status: 'rejected',
      reason: createAbortError(),
    }
  })
}
