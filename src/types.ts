/* eslint-disable no-unused-vars */

export enum MediaType {
  Image = 'image',
  Video = 'video',
  Usermedia = 'usermedia',
}

export enum ThemeName {
  Grayscale = 'grayscale',
  Discodip = 'discodip',
  Pastel = 'pastel',
  Nyx = 'nyx',
}

export interface NyxFissionConfig {
  source?: string
  type?: MediaType
  theme?: ThemeName
  querySelector?: string
  depth?: number
}

export enum NyxEventName {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
  Destroy = 'destroy',
}

export enum NyxErrorStage {
  Target = 'target',
  Source = 'source',
  Sampling = 'sampling',
  Rendering = 'rendering',
  Lifecycle = 'lifecycle',
}

export interface NyxErrorEvent {
  error: Error
  stage: NyxErrorStage
}

export type NyxEventMap = {
  [NyxEventName.Loading]: void
  [NyxEventName.Ready]: void
  [NyxEventName.Error]: NyxErrorEvent
  [NyxEventName.Destroy]: void
}
