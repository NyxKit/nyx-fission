/* global Document, Element, HTMLCanvasElement, MutationObserver, document */

import { NyxError } from './errors'
import { NyxErrorStage, type NyxFissionConfig } from './types'

export interface TargetResolution {
  promise: Promise<HTMLCanvasElement>
  cancel: () => void
}

export function validateCanvas(value: unknown): HTMLCanvasElement {
  if (value instanceof HTMLCanvasElement) {
    return value
  }

  throw new NyxError(
    'Target must be an HTMLCanvasElement',
    'INVALID_TARGET',
    NyxErrorStage.Target,
  )
}

export function resolveCanvas(
  config: NyxFissionConfig,
  documentRef: Document = document,
): TargetResolution {
  let resolvePromise: (_canvas: HTMLCanvasElement) => void = () => {}
  let rejectPromise: (_error: NyxError) => void = () => {}
  let settled = false
  let observer: MutationObserver | undefined

  const promise = new Promise<HTMLCanvasElement>((_resolve, _reject) => {
    resolvePromise = _resolve
    rejectPromise = _reject
  })

  const removeResources = () => {
    observer?.disconnect()
    observer = undefined
    documentRef.removeEventListener('DOMContentLoaded', onReady)
  }

  const resolve = (_canvas: HTMLCanvasElement) => {
    if (settled) return
    settled = true
    removeResources()
    resolvePromise(_canvas)
  }

  const reject = (_error: NyxError) => {
    if (settled) return
    settled = true
    removeResources()
    rejectPromise(_error)
  }

  const lookup = (): HTMLCanvasElement | null => {
    let value: Element | null

    try {
      value = documentRef.querySelector(config.querySelector as string)
    } catch (cause) {
      reject(
        new NyxError(
          'Target selector is invalid',
          'INVALID_TARGET',
          NyxErrorStage.Target,
          cause,
        ),
      )
      return null
    }

    if (value === null) return null

    try {
      return validateCanvas(value)
    } catch (error) {
      reject(error as NyxError)
      return null
    }
  }

  function onReady() {
    const canvas = lookup()
    if (canvas !== null) {
      resolve(canvas)
    } else if (!settled) {
      reject(
        new NyxError(
          'Canvas target was not found',
          'TARGET_NOT_FOUND',
           NyxErrorStage.Target,
        ),
      )
    }
  }

  if (config.querySelector !== undefined) {
    const canvas = lookup()
    if (canvas !== null) {
      resolve(canvas)
    } else if (!settled && documentRef.readyState === 'loading') {
      observer = new MutationObserver(() => {
        const insertedCanvas = lookup()
        if (insertedCanvas !== null) resolve(insertedCanvas)
      })
      observer.observe(documentRef, { childList: true, subtree: true })
      documentRef.addEventListener('DOMContentLoaded', onReady, { once: true })
    } else if (!settled) {
      reject(
        new NyxError(
          'Canvas target was not found',
          'TARGET_NOT_FOUND',
           NyxErrorStage.Target,
        ),
      )
    }
  }

  return {
    promise,
    cancel: () => {
      if (settled) return
      settled = true
      removeResources()
    },
  }
}
