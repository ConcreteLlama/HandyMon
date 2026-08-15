import z from "zod";

export const FanControlCacheSchema = z.object({
  CurrentConfigFileName: z.string(),
  Updater: z.object({
    CheckForUpdateAtStartup: z.boolean(),
    DisablePopupVersionNumber: z.number(),
  }),
  Main: z.object({
    DisableDonationPopup: z.boolean(),
    FirstLaunch: z.boolean(),
    Height: z.number(),
    Left: z.number(),
    LeftDrawerOpen: z.boolean(),
    PopupShownDateTime: z.string(),
    StartMinimized: z.boolean(),
    Top: z.number(),
    Width: z.number(),
    WindowState: z.number(),
  }),
  CultureSymbol: z.string(),
});

export type FanControlCache = z.infer<typeof FanControlCacheSchema>;

export const FanControlGetResponseSchema = z.object({
    available: z.boolean(),
    activeProfile: z.string(),
    availableProfiles: z.string().array(),
});
export type FancontrolGetResponse = z.infer<typeof FanControlGetResponseSchema>;