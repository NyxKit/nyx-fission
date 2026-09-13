/* global document */
import { describe, expect, it } from 'vitest'
import { highlightCode, type CodeLanguage } from './highlight-code'

describe('code highlighting', () => {
  it.each([
    [
      'json',
      '{\n  "depth": 0.35,\n  "source": "</code><img src=x onerror=alert(1)>"\n}',
    ],
    [
      'typescript',
      'const source = "</code><script>alert(1)</script>"\nconst depth: number = 0.35',
    ],
  ] as [CodeLanguage, string][])(
    'highlights %s without interpreting source markup',
    (language, code) => {
      const element = document.createElement('code')
      element.innerHTML = highlightCode(code, language)
      expect(element.textContent).toBe(code)
      expect(element.querySelector('script, img')).toBeNull()
      expect(element.querySelector('.hljs-string')).not.toBeNull()
      expect(element.querySelector('.hljs-number')).not.toBeNull()
      expect(
        element.querySelector(
          language === 'json' ? '.hljs-attr' : '.hljs-keyword',
        ),
      ).not.toBeNull()
    },
  )
})
