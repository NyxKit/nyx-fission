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

export enum EntranceAnimationType {
  None = 'none',
  Gather = 'gather',
  Depth = 'depth',
  Fade = 'fade',
  Vortex = 'vortex',
  ScanLeftToRight = 'scan-left-to-right',
  ScanRightToLeft = 'scan-right-to-left',
  ScanTopToBottom = 'scan-top-to-bottom',
  ScanBottomToTop = 'scan-bottom-to-top',
  Scatter = 'scatter',
}

export interface EntranceConfig {
  type?: EntranceAnimationType
  autoStart?: boolean
  /** Duration in milliseconds, including particle staggering. Default: 1000. */
  duration?: number
  /** Delay in milliseconds before revealing the particles. Default: 0. */
  delay?: number
}

export interface EntranceEvent {
  type: EntranceAnimationType
  animated: boolean
}

export interface NyxFissionConfig {
  source?: string
  type?: MediaType
  theme?: ThemeName
  querySelector?: string
  depth?: number
  lumaKey?: LumaKeyConfig
  entrance?: EntranceConfig
}

export enum NyxEvent {
  Loading = 'loading',
  Ready = 'ready',
  EntranceStart = 'entrance-start',
  EntranceComplete = 'entrance-complete',
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
  [NyxEvent.EntranceStart]: EntranceEvent
  [NyxEvent.EntranceComplete]: EntranceEvent
  [NyxEvent.Error]: NyxErrorEvent
  [NyxEvent.Destroy]: void
}
