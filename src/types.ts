export type MediaType = 'image' | 'video' | 'usermedia'
export type ThemeName = 'grayscale' | 'discodip' | 'pastel' | 'nyx'

export interface NyxFissionConfig {
  source?: string
  type?: MediaType
  theme?: ThemeName
  querySelector?: string
}

export type NyxEventName = 'loading' | 'ready' | 'error' | 'destroy'

export interface NyxErrorEvent {
  error: Error
  stage: 'target' | 'source' | 'sampling' | 'rendering' | 'lifecycle'
}

export type NyxEventMap = {
  loading: void
  ready: void
  error: NyxErrorEvent
  destroy: void
}
