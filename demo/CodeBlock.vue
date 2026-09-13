<script setup lang="ts">
/* global navigator, window */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NyxButton } from 'nyx-kit/components'
import { NyxSize, NyxVariant } from 'nyx-kit/types'
import { highlightCode, type CodeLanguage } from './highlight-code'

const props = defineProps<{
  code: string
  language: CodeLanguage
  filename: string
  copyLabel: string
}>()

const highlighted = computed(() => highlightCode(props.code, props.language))
const languageLabel = computed(() =>
  props.language === 'json' ? 'JSON' : 'TypeScript',
)
const feedback = ref('')
let feedbackTimer: number | undefined
let copyRequest = 0

function clearFeedback() {
  copyRequest += 1
  window.clearTimeout(feedbackTimer)
  feedback.value = ''
}

async function copyCode() {
  clearFeedback()
  const request = copyRequest
  try {
    await navigator.clipboard.writeText(props.code)
    if (request !== copyRequest) return
    feedback.value = 'Copied'
    feedbackTimer = window.setTimeout(clearFeedback, 2000)
  } catch {
    if (request !== copyRequest) return
    feedback.value = 'Copy unavailable. Select the code to copy it.'
  }
}

watch(() => props.code, clearFeedback)
onBeforeUnmount(clearFeedback)
</script>

<template>
  <section
    class="code-example"
    :aria-label="filename"
  >
    <div class="code-example__bar">
      <div class="code-example__file">
        <span>{{ filename }}</span>
        <span class="code-example__language">{{ languageLabel }}</span>
      </div>
      <NyxButton
        :variant="NyxVariant.Ghost"
        :size="NyxSize.Small"
        @click="copyCode"
      >
        {{ copyLabel }}
      </NyxButton>
    </div>
    <p
      v-if="feedback"
      class="code-example__feedback"
      role="status"
    >
      {{ feedback }}
    </p>
    <pre
      class="code-example__code"
      tabindex="0"
      :aria-label="`${languageLabel} code`"
    ><code :class="`language-${language}`" v-html="highlighted"></code></pre>
  </section>
</template>
