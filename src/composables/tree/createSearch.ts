import { match } from '@/tree-builder-core'

type SearchMatch = (texts: readonly string[], q: string) => Int32Array

type SearchWorkerRequest =
  | { type: 'index'; texts: string[] }
  | { type: 'query'; reqId: number; q: string }

type SearchWorkerResponse = {
  reqId: number
  indices: Int32Array
}

type SearchWorkerScope = {
  onmessage: ((event: MessageEvent<SearchWorkerRequest>) => void) | null
  postMessage: (message: SearchWorkerResponse, transfer: Transferable[]) => void
}

export type SearchRunner = {
  index: (texts: string[]) => void
  query: (q: string, onResult: (indices: Int32Array) => void) => void
  dispose: () => void
}

function searchWorkerBody(matchImpl: SearchMatch) {
  const workerScope = self as unknown as SearchWorkerScope
  let texts: string[] = []

  workerScope.onmessage = (event) => {
    const message = event.data

    if (message.type === 'index') {
      texts = message.texts
      return
    }

    const indices = matchImpl(texts, message.q)
    workerScope.postMessage({ reqId: message.reqId, indices }, [indices.buffer as ArrayBuffer])
  }
}

function createSearchWorkerSource(matchImpl: SearchMatch) {
  return `(${searchWorkerBody.toString()})(${matchImpl.toString()});`
}

export function createSearch(useWorker: boolean): SearchRunner {
  if (!useWorker) {
    let texts: string[] = []
    return {
      index: (next) => {
        texts = next
      },
      query: (q, onResult) => onResult(match(texts, q)),
      dispose: () => {},
    }
  }

  const body = createSearchWorkerSource(match)
  const url = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }))
  const worker = new Worker(url)
  let seq = 0
  let pending: ((indices: Int32Array) => void) | undefined

  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as SearchWorkerResponse
    if (data.reqId === seq) pending?.(data.indices)
  }

  return {
    index: (texts) => worker.postMessage({ type: 'index', texts }),
    query: (q, onResult) => {
      pending = onResult
      worker.postMessage({ type: 'query', reqId: ++seq, q })
    },
    dispose: () => {
      worker.terminate()
      URL.revokeObjectURL(url)
    },
  }
}
