import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import typescript from 'highlight.js/lib/languages/typescript'

export type CodeLanguage = 'json' | 'typescript'

hljs.registerLanguage('json', json)
hljs.registerLanguage('typescript', typescript)

export function highlightCode(code: string, language: CodeLanguage): string {
  // highlight() escapes the source before returning its own token markup.
  return hljs.highlight(code, { language }).value
}
