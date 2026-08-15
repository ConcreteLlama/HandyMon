import z from "zod"

export type RtssProfile = {
    name: string,
    fileName: string,
}

export const zBool01 = z
  .union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1")])
  .transform((val) => (val === "1" || val === 1 ? 1 : 0));

// Subschemas
const RtssFramerateConfigSchema = z.object({
  Limit: z.coerce.number(),
  LimitDenominator: z.coerce.number(),
  LimitTime: z.coerce.number(),
  LimitTimeDenominator: z.coerce.number(),
  SyncDisplay: z.coerce.number(),
  SyncScanline0: z.coerce.number(),
  SyncScanline1: z.coerce.number(),
  SyncPeriods: z.coerce.number(),
  SyncLimiter: z.coerce.number(),
  PassiveWait: z.coerce.number(),
  ReflexSleep: z.coerce.number(),
  ReflexSetLatencyMarker: zBool01,
}).passthrough();

const RtssOsdConfigSchema = z.object({
  EnableStat: zBool01,
  EnableOSD: zBool01,
  EnableBgnd: zBool01,
  EnableFill: zBool01,
  BaseColor: z.string(),
  BgndColor: z.string(),
  FillColor: z.string(),
  PositionX: z.coerce.number(),
  PositionY: z.coerce.number(),
  ZoomRatio: z.coerce.number(),
  CoordinateSpace: z.coerce.number(),
  EnableFrameColorBar: zBool01,
  FrameColorBarMode: z.coerce.number(),
  RefreshPeriod: z.coerce.number(),
  IntegerFramerate: zBool01,
  MaximumFrametime: z.coerce.number(),
  EnableFrametimeHistory: zBool01,
  FrametimeHistoryWidth: z.coerce.number(),
  FrametimeHistoryHeight: z.coerce.number(),
  FrametimeHistoryStyle: z.coerce.number(),
  ScaleToFit: zBool01,
}).passthrough();

const RtssStatisticsSchema = z.object({
  FramerateAveragingInterval: z.coerce.number(),
  PeakFramerateCalc: zBool01,
  PercentileCalc: zBool01,
  FrametimeCalc: zBool01,
  PercentileBuffer: z.coerce.number(),
}).passthrough();

const RtssHookingSchema = z.object({
  EnableHooking: zBool01,
  EnableFloatingInjectionAddress: zBool01,
  EnableDynamicOffsetDetection: zBool01,
  HookLoadLibrary: zBool01,
  HookDirectDraw: zBool01,
  HookDirect3D8: zBool01,
  HookDirect3D9: zBool01,
  HookDirect3DSwapChain9Present: zBool01,
  HookDXGI: zBool01,
  HookDirect3D12: zBool01,
  HookOpenGL: zBool01,
  HookVulkan: zBool01,
  InjectionDelay: z.coerce.number(),
  UseDetours: zBool01,
}).passthrough();

const RtssFontSchema = z.object({
  Height: z.coerce.number(),
  Weight: z.coerce.number(),
  Face: z.string(),
  Load: z.string(),
}).passthrough();

const RtssRendererSchema = z.object({
  Implementation: z.coerce.number(),
}).passthrough();

const RtssInfoSchema = z.object({
  Timestamp: z.string(),
}).passthrough();

// Full config schema
export const RtssConfigSchema = z.object({
  Framerate: RtssFramerateConfigSchema,
  OSD: RtssOsdConfigSchema,
  Statistics: RtssStatisticsSchema,
  Hooking: RtssHookingSchema,
  Font: RtssFontSchema,
  RendererDirect3D8: RtssRendererSchema,
  RendererDirect3D9: RtssRendererSchema,
  RendererDirect3D10: RtssRendererSchema,
  RendererDirect3D11: RtssRendererSchema,
  RendererDirect3D12: RtssRendererSchema,
  RendererOpenGL: RtssRendererSchema,
  RendererVulkan: RtssRendererSchema,
  Info: RtssInfoSchema,
}).passthrough();

export type RtssConfig = z.infer<typeof RtssConfigSchema>;

// Partial version for updates
export const PartialRtssConfigSchema = z.object({
  Framerate: RtssFramerateConfigSchema.partial(),
  OSD: RtssOsdConfigSchema.partial(),
  Statistics: RtssStatisticsSchema.partial(),
  Hooking: RtssHookingSchema.partial(),
  Font: RtssFontSchema.partial(),
  RendererDirect3D8: RtssRendererSchema.partial(),
  RendererDirect3D9: RtssRendererSchema.partial(),
  RendererDirect3D10: RtssRendererSchema.partial(),
  RendererDirect3D11: RtssRendererSchema.partial(),
  RendererDirect3D12: RtssRendererSchema.partial(),
  RendererOpenGL: RtssRendererSchema.partial(),
  RendererVulkan: RtssRendererSchema.partial(),
  Info: RtssInfoSchema.partial(),
}).partial();

export type PartialRtssConfig = z.infer<typeof PartialRtssConfigSchema>;
