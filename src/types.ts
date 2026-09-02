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

export enum LumaKeyMode {
  None = 'none',
  Dark = 'dark',
  Light = 'light',
}

export interface LumaKeyConfig {
  mode: LumaKeyMode
  threshold?: number
  coherence?: number
}

export type ResolvedLumaKeyConfig = Required<LumaKeyConfig>

export interface NyxFissionConfig {
  source?: string
  type?: MediaType
  theme?: ThemeName
  querySelector?: string
  depth?: number
  lumaKey?: LumaKeyConfig
}

export enum NyxEvent {
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
  [NyxEvent.Loading]: void
  [NyxEvent.Ready]: void
  [NyxEvent.Error]: NyxErrorEvent
  [NyxEvent.Destroy]: void
}
