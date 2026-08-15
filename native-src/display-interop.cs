using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

namespace HandyMonDisplay {
  [StructLayout(LayoutKind.Sequential)]
  internal struct LUID { public uint LowPart; public uint HighPart; }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigRational { public uint numerator; public uint denominator; }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigPathSourceInfo {
    public LUID AdapterId;
    public uint Id;
    public uint ModeInfoIdx;
    public int statusFlags;
  }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigPathTargetInfo {
    public LUID AdapterId;
    public uint Id;
    public uint ModeInfoIdx;
    public uint outputTechnology;
    public uint rotation;
    public uint scaling;
    public DisplayConfigRational RefreshRate;
    public uint scanLineOrdering;
    public bool TargetAvailable;
    public uint statusFlags;
  }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigPathInfo {
    public DisplayConfigPathSourceInfo SourceInfo;
    public DisplayConfigPathTargetInfo TargetInfo;
    public uint Flags;
  }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfig2DRegion { public uint X; public uint Y; }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigVideoSignalInfo {
    public long PixelRate;
    public DisplayConfigRational HSyncFreq;
    public DisplayConfigRational VSyncFreq;
    public DisplayConfig2DRegion ActiveSize;
    public DisplayConfig2DRegion TotalSize;
    public uint videoStandard;
    public uint scanLineOrdering;
  }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigTargetMode { public DisplayConfigVideoSignalInfo TargetVideoSignalInfo; }

  [StructLayout(LayoutKind.Sequential)]
  internal struct PointL { public int X; public int Y; }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigSourceMode {
    public uint Width;
    public uint Height;
    public uint pixelFormat;
    public PointL Position;
  }

  [StructLayout(LayoutKind.Explicit)]
  internal struct DisplayConfigModeInfo {
    [FieldOffset(0)] public uint InfoType;
    [FieldOffset(4)] public uint Id;
    [FieldOffset(8)] public LUID AdapterId;
    [FieldOffset(16)] public DisplayConfigTargetMode TargetMode;
    [FieldOffset(16)] public DisplayConfigSourceMode SourceMode;
  }

  // Struct layouts below (device info header, target device name, advanced
  // color info) cross-checked against dahall/Vanara's Gdi32 P/Invoke library
  // (MIT License) — https://github.com/dahall/Vanara — since these are
  // fiddlier than the path/mode structs above (packed layout, embedded
  // fixed-size strings) and worth getting right on the first try.
  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigDeviceInfoHeader {
    public uint Type;
    public uint Size;
    public LUID AdapterId;
    public uint Id;
  }

  [StructLayout(LayoutKind.Sequential, Pack = 2, CharSet = CharSet.Unicode)]
  internal struct DisplayConfigTargetDeviceName {
    public DisplayConfigDeviceInfoHeader Header;
    public uint Flags;
    public uint OutputTechnology;
    public ushort EdidManufactureId;
    public ushort EdidProductCodeId;
    public uint ConnectorInstance;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string MonitorFriendlyDeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string MonitorDevicePath;
  }

  [StructLayout(LayoutKind.Sequential)]
  internal struct DisplayConfigGetAdvancedColorInfo {
    public DisplayConfigDeviceInfoHeader Header;
    public uint Value; // bit 0 = supported, bit 1 = enabled, bit 2 = wide color enforced, bit 3 = force-disabled
    public uint ColorEncoding;
    public uint BitsPerColorChannel;
  }

  internal static class User32 {
    [DllImport("User32.dll")]
    public static extern int GetDisplayConfigBufferSizes(uint flags, out int numPathArrayElements, out int numModeInfoArrayElements);

    [DllImport("User32.dll")]
    public static extern int QueryDisplayConfig(uint flags, ref int numPathArrayElements, [Out] DisplayConfigPathInfo[] pathInfoArray, ref int numModeInfoArrayElements, [Out] DisplayConfigModeInfo[] modeInfoArray, IntPtr topologyId);

    [DllImport("User32.dll")]
    public static extern int SetDisplayConfig(uint numPathArrayElements, [In] DisplayConfigPathInfo[] pathArray, uint numModeInfoArrayElements, [In] DisplayConfigModeInfo[] modeInfoArray, uint flags);

    [DllImport("User32.dll")]
    public static extern int DisplayConfigGetDeviceInfo(ref DisplayConfigTargetDeviceName request);

    [DllImport("User32.dll")]
    public static extern int DisplayConfigGetDeviceInfo(ref DisplayConfigGetAdvancedColorInfo request);
  }

  // JSON-friendly DTOs — flat, nullable where the field only applies to one
  // side of the ModeInfo union. This is what actually gets stored as a
  // profile.
  public class JsonLuid { public uint LowPart; public uint HighPart; }

  public class JsonPathSourceInfo {
    public JsonLuid AdapterId;
    public uint Id;
    public uint ModeInfoIdx;
    public int StatusFlags;
  }

  public class JsonPathTargetInfo {
    public JsonLuid AdapterId;
    public uint Id;
    public uint ModeInfoIdx;
    public uint OutputTechnology;
    public uint Rotation;
    public uint Scaling;
    public uint RefreshNumerator;
    public uint RefreshDenominator;
    public uint ScanLineOrdering;
    public bool TargetAvailable;
    public uint StatusFlags;
  }

  public class JsonPathInfo {
    public JsonPathSourceInfo SourceInfo;
    public JsonPathTargetInfo TargetInfo;
    public uint Flags;
  }

  public class JsonModeInfo {
    public uint InfoType; // 1 = source, 2 = target
    public uint Id;
    public JsonLuid AdapterId;

    // Source mode fields (InfoType == 1)
    public uint? Width;
    public uint? Height;
    public uint? PixelFormat;
    public int? PosX;
    public int? PosY;

    // Target mode fields (InfoType == 2)
    public long? PixelRate;
    public uint? HSyncNum;
    public uint? HSyncDen;
    public uint? VSyncNum;
    public uint? VSyncDen;
    public uint? ActiveW;
    public uint? ActiveH;
    public uint? TotalW;
    public uint? TotalH;
    public uint? VideoStandard;
    public uint? ScanLineOrdering;
  }

  public class TargetExtra {
    public uint TargetId;
    public string FriendlyName;
    public bool HdrSupported;
    public bool HdrEnabled;
    public uint BitsPerColorChannel;
    // Identity used to re-find this physical monitor at apply time — see
    // Rebuild()'s doc comment. EDID manufacturer+product code identifies the
    // *model* (two identical monitors share these), so ConnectorInstance
    // (which physical port of this output technology) disambiguates them.
    public ushort EdidManufactureId;
    public ushort EdidProductCodeId;
    public uint ConnectorInstance;
  }

  public class CapturedProfile {
    public List<JsonPathInfo> Paths;
    public List<JsonModeInfo> Modes;
    // Friendly name / HDR info isn't needed to reapply a profile (Apply/
    // Validate never read this), only to describe it later — captured once
    // here so the profile's own info view doesn't need a live re-query
    // against what might not even be the active topology anymore.
    public List<TargetExtra> Extras;
  }

  public class DisplayDetail {
    public uint TargetId;
    public string FriendlyName;
    public uint OutputTechnology;
    public uint Rotation;
    public uint Width;
    public uint Height;
    public double RefreshRate;
    public bool HdrSupported;
    public bool HdrEnabled;
    public uint BitsPerColorChannel;
    public uint ColorEncoding;
  }

  public static class Api {
    const uint QDC_ONLY_ACTIVE_PATHS = 0x00000002;
    const uint SDC_USE_SUPPLIED_DISPLAY_CONFIG = 0x00000020;
    const uint SDC_VALIDATE = 0x00000040;
    const uint SDC_APPLY = 0x00000080;

    private static void QueryActive(out DisplayConfigPathInfo[] paths, out DisplayConfigModeInfo[] modes) {
      int numPaths, numModes;
      Marshal.ThrowExceptionForHR(User32.GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out numPaths, out numModes));
      paths = new DisplayConfigPathInfo[numPaths];
      modes = new DisplayConfigModeInfo[numModes];
      Marshal.ThrowExceptionForHR(User32.QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref numPaths, paths, ref numModes, modes, IntPtr.Zero));
    }

    private static JsonModeInfo ToJsonMode(DisplayConfigModeInfo m) {
      var dto = new JsonModeInfo {
        InfoType = m.InfoType,
        Id = m.Id,
        AdapterId = new JsonLuid { LowPart = m.AdapterId.LowPart, HighPart = m.AdapterId.HighPart },
      };
      if (m.InfoType == 1) {
        dto.Width = m.SourceMode.Width;
        dto.Height = m.SourceMode.Height;
        dto.PixelFormat = m.SourceMode.pixelFormat;
        dto.PosX = m.SourceMode.Position.X;
        dto.PosY = m.SourceMode.Position.Y;
      } else if (m.InfoType == 2) {
        var vsi = m.TargetMode.TargetVideoSignalInfo;
        dto.PixelRate = vsi.PixelRate;
        dto.HSyncNum = vsi.HSyncFreq.numerator;
        dto.HSyncDen = vsi.HSyncFreq.denominator;
        dto.VSyncNum = vsi.VSyncFreq.numerator;
        dto.VSyncDen = vsi.VSyncFreq.denominator;
        dto.ActiveW = vsi.ActiveSize.X;
        dto.ActiveH = vsi.ActiveSize.Y;
        dto.TotalW = vsi.TotalSize.X;
        dto.TotalH = vsi.TotalSize.Y;
        dto.VideoStandard = vsi.videoStandard;
        dto.ScanLineOrdering = vsi.scanLineOrdering;
      }
      return dto;
    }

    private static DisplayConfigModeInfo FromJsonMode(JsonModeInfo dto) {
      var m = new DisplayConfigModeInfo {
        InfoType = dto.InfoType,
        Id = dto.Id,
        AdapterId = new LUID { LowPart = dto.AdapterId.LowPart, HighPart = dto.AdapterId.HighPart },
      };
      if (dto.InfoType == 1) {
        m.SourceMode = new DisplayConfigSourceMode {
          Width = dto.Width ?? 0,
          Height = dto.Height ?? 0,
          pixelFormat = dto.PixelFormat ?? 0,
          Position = new PointL { X = dto.PosX ?? 0, Y = dto.PosY ?? 0 },
        };
      } else if (dto.InfoType == 2) {
        m.TargetMode = new DisplayConfigTargetMode {
          TargetVideoSignalInfo = new DisplayConfigVideoSignalInfo {
            PixelRate = dto.PixelRate ?? 0,
            HSyncFreq = new DisplayConfigRational { numerator = dto.HSyncNum ?? 0, denominator = dto.HSyncDen ?? 0 },
            VSyncFreq = new DisplayConfigRational { numerator = dto.VSyncNum ?? 0, denominator = dto.VSyncDen ?? 0 },
            ActiveSize = new DisplayConfig2DRegion { X = dto.ActiveW ?? 0, Y = dto.ActiveH ?? 0 },
            TotalSize = new DisplayConfig2DRegion { X = dto.TotalW ?? 0, Y = dto.TotalH ?? 0 },
            videoStandard = dto.VideoStandard ?? 0,
            scanLineOrdering = dto.ScanLineOrdering ?? 0,
          },
        };
      }
      return m;
    }

    // Captures the current active monitor layout as JSON — this is the "save
    // current setup as..." side; there's no way to hand-author a profile,
    // only capture-then-reapply (same as MonitorSwitcher's own workflow).
    //
    // excludeTargetIdsCsv drops specific active targets from what gets
    // saved (comma-separated target Ids, empty = keep everything) — lets a
    // profile ignore a device that's technically active in Windows' eyes
    // but isn't something the user actually wants applied (e.g. an AVR's
    // HDMI passthrough reporting its own EDID as a phantom display).
    public static string Capture(string excludeTargetIdsCsv) {
      var excludeIds = new HashSet<uint>();
      if (!string.IsNullOrEmpty(excludeTargetIdsCsv)) {
        foreach (var s in excludeTargetIdsCsv.Split(',')) {
          uint v;
          if (uint.TryParse(s, out v)) excludeIds.Add(v);
        }
      }

      DisplayConfigPathInfo[] allPaths;
      DisplayConfigModeInfo[] allModes;
      QueryActive(out allPaths, out allModes);

      var paths = allPaths.Where(p => !excludeIds.Contains(p.TargetInfo.Id)).ToArray();

      // Rebuild the modes array with only entries the kept paths reference,
      // remapping ModeInfoIdx to the new compacted indices — an excluded
      // path's modes shouldn't linger in what gets saved.
      var keptModes = new List<DisplayConfigModeInfo>();
      var indexMap = new Dictionary<uint, int>();
      Func<uint, uint> remap = oldIdx => {
        if (oldIdx >= allModes.Length) return oldIdx;
        int mapped;
        if (!indexMap.TryGetValue(oldIdx, out mapped)) {
          mapped = keptModes.Count;
          keptModes.Add(allModes[oldIdx]);
          indexMap[oldIdx] = mapped;
        }
        return (uint)mapped;
      };
      for (int i = 0; i < paths.Length; i++) {
        var p = paths[i];
        p.SourceInfo.ModeInfoIdx = remap(p.SourceInfo.ModeInfoIdx);
        p.TargetInfo.ModeInfoIdx = remap(p.TargetInfo.ModeInfoIdx);
        paths[i] = p;
      }
      var modes = keptModes.ToArray();

      var profile = new CapturedProfile {
        Paths = paths.Select(p => new JsonPathInfo {
          SourceInfo = new JsonPathSourceInfo {
            AdapterId = new JsonLuid { LowPart = p.SourceInfo.AdapterId.LowPart, HighPart = p.SourceInfo.AdapterId.HighPart },
            Id = p.SourceInfo.Id,
            ModeInfoIdx = p.SourceInfo.ModeInfoIdx,
            StatusFlags = p.SourceInfo.statusFlags,
          },
          TargetInfo = new JsonPathTargetInfo {
            AdapterId = new JsonLuid { LowPart = p.TargetInfo.AdapterId.LowPart, HighPart = p.TargetInfo.AdapterId.HighPart },
            Id = p.TargetInfo.Id,
            ModeInfoIdx = p.TargetInfo.ModeInfoIdx,
            OutputTechnology = p.TargetInfo.outputTechnology,
            Rotation = p.TargetInfo.rotation,
            Scaling = p.TargetInfo.scaling,
            RefreshNumerator = p.TargetInfo.RefreshRate.numerator,
            RefreshDenominator = p.TargetInfo.RefreshRate.denominator,
            ScanLineOrdering = p.TargetInfo.scanLineOrdering,
            TargetAvailable = p.TargetInfo.TargetAvailable,
            StatusFlags = p.TargetInfo.statusFlags,
          },
          Flags = p.Flags,
        }).ToList(),
        Modes = modes.Select(ToJsonMode).ToList(),
        Extras = paths.Select(p => {
          var info = GetTargetInfo(p.TargetInfo.AdapterId, p.TargetInfo.Id);
          return new TargetExtra {
            TargetId = p.TargetInfo.Id,
            FriendlyName = info.FriendlyName,
            HdrSupported = info.HdrSupported,
            HdrEnabled = info.HdrEnabled,
            BitsPerColorChannel = info.BitsPerColorChannel,
            EdidManufactureId = info.EdidManufactureId,
            EdidProductCodeId = info.EdidProductCodeId,
            ConnectorInstance = info.ConnectorInstance,
          };
        }).ToList(),
      };

      return new JavaScriptSerializer().Serialize(profile);
    }

    private class TargetInfoResult {
      public string FriendlyName;
      public bool HdrSupported;
      public bool HdrEnabled;
      public uint BitsPerColorChannel;
      public uint ColorEncoding;
      public ushort EdidManufactureId;
      public ushort EdidProductCodeId;
      public uint ConnectorInstance;
    }

    // Shared by GetDisplayDetails() (live query), Capture() (stored alongside
    // a profile so its own info view doesn't need a live re-query later), and
    // Rebuild() (EDID/connector identity used to re-find a target at apply
    // time — see Rebuild()'s doc comment).
    private static TargetInfoResult GetTargetInfo(LUID adapterId, uint targetId) {
      var result = new TargetInfoResult();

      var nameReq = new DisplayConfigTargetDeviceName {
        Header = new DisplayConfigDeviceInfoHeader {
          Type = 2, // DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME
          Size = (uint)Marshal.SizeOf<DisplayConfigTargetDeviceName>(),
          AdapterId = adapterId,
          Id = targetId,
        },
      };
      if (User32.DisplayConfigGetDeviceInfo(ref nameReq) == 0) {
        result.FriendlyName = nameReq.MonitorFriendlyDeviceName;
        result.EdidManufactureId = nameReq.EdidManufactureId;
        result.EdidProductCodeId = nameReq.EdidProductCodeId;
        result.ConnectorInstance = nameReq.ConnectorInstance;
      }

      var colorReq = new DisplayConfigGetAdvancedColorInfo {
        Header = new DisplayConfigDeviceInfoHeader {
          Type = 9, // DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO
          Size = (uint)Marshal.SizeOf<DisplayConfigGetAdvancedColorInfo>(),
          AdapterId = adapterId,
          Id = targetId,
        },
      };
      if (User32.DisplayConfigGetDeviceInfo(ref colorReq) == 0) {
        bool advancedColorEnabled = (colorReq.Value & 2) != 0;
        bool wideColorEnforced = (colorReq.Value & 4) != 0;
        result.HdrSupported = (colorReq.Value & 1) != 0;
        // advancedColorEnabled alone isn't "HDR is on" — it's also true when
        // Windows is in a wide-color-gamut-enforced mode without the user
        // actually having toggled HDR (confirmed against seerge/g-helper,
        // a real HDR-toggle utility, which excludes wideColorEnforced for
        // exactly this reason — matches a live report of "HDR off but shows
        // on").
        result.HdrEnabled = advancedColorEnabled && !wideColorEnforced;
        result.BitsPerColorChannel = colorReq.BitsPerColorChannel;
        result.ColorEncoding = colorReq.ColorEncoding;
      }

      return result;
    }

    // Per-display detail (friendly name, HDR support/state) for the info
    // view — decoded fresh from a live query (see Capture() for the
    // equivalent decoded once and stored alongside a saved profile).
    public static string GetDisplayDetails() {
      DisplayConfigPathInfo[] paths;
      DisplayConfigModeInfo[] modes;
      QueryActive(out paths, out modes);

      var result = new List<DisplayDetail>();
      foreach (var p in paths) {
        var detail = new DisplayDetail {
          TargetId = p.TargetInfo.Id,
          OutputTechnology = p.TargetInfo.outputTechnology,
          Rotation = p.TargetInfo.rotation,
          RefreshRate = p.TargetInfo.RefreshRate.denominator != 0 ? Math.Round((double)p.TargetInfo.RefreshRate.numerator / p.TargetInfo.RefreshRate.denominator, 2) : 0,
        };

        if (p.SourceInfo.ModeInfoIdx < modes.Length) {
          var m = modes[p.SourceInfo.ModeInfoIdx];
          if (m.InfoType == 1) {
            detail.Width = m.SourceMode.Width;
            detail.Height = m.SourceMode.Height;
          }
        }

        var info = GetTargetInfo(p.TargetInfo.AdapterId, p.TargetInfo.Id);
        detail.FriendlyName = info.FriendlyName;
        detail.HdrSupported = info.HdrSupported;
        detail.HdrEnabled = info.HdrEnabled;
        detail.BitsPerColorChannel = info.BitsPerColorChannel;
        detail.ColorEncoding = info.ColorEncoding;

        result.Add(detail);
      }

      return new JavaScriptSerializer().Serialize(result);
    }

    // Decodes a saved profile's own JSON into the same DisplayDetail shape as
    // GetDisplayDetails() — no live query involved, so this describes what
    // the profile itself contains even if it's not the active layout right
    // now (and friendly name/HDR come from Capture()'s stored Extras, not a
    // fresh DisplayConfigGetDeviceInfo call).
    public static string DescribeProfile(string json) {
      var profile = new JavaScriptSerializer().Deserialize<CapturedProfile>(json);
      var result = new List<DisplayDetail>();
      foreach (var p in profile.Paths) {
        var detail = new DisplayDetail {
          TargetId = p.TargetInfo.Id,
          OutputTechnology = p.TargetInfo.OutputTechnology,
          Rotation = p.TargetInfo.Rotation,
          RefreshRate = p.TargetInfo.RefreshDenominator != 0 ? Math.Round((double)p.TargetInfo.RefreshNumerator / p.TargetInfo.RefreshDenominator, 2) : 0,
        };

        var mode = profile.Modes.FirstOrDefault(m => m.InfoType == 1 && m.Id == p.SourceInfo.Id);
        if (mode != null) {
          detail.Width = mode.Width ?? 0;
          detail.Height = mode.Height ?? 0;
        }

        var extra = profile.Extras != null ? profile.Extras.FirstOrDefault(e => e.TargetId == p.TargetInfo.Id) : null;
        if (extra != null) {
          detail.FriendlyName = extra.FriendlyName;
          detail.HdrSupported = extra.HdrSupported;
          detail.HdrEnabled = extra.HdrEnabled;
          detail.BitsPerColorChannel = extra.BitsPerColorChannel;
        }

        result.Add(detail);
      }
      return new JavaScriptSerializer().Serialize(result);
    }

    // A LUID-independent signature for a captured profile's JSON — two
    // captures of the same real topology produce the same fingerprint even if
    // adapter LUIDs have since changed (reboot/driver restart), since it's
    // built only from the stable numeric target/source Id, resolution,
    // refresh rate, and rotation. Used to detect which saved profile (if any)
    // matches what's currently active, without needing to trust LUIDs.
    public static string Fingerprint(string json) {
      var profile = new JavaScriptSerializer().Deserialize<CapturedProfile>(json);
      var parts = profile.Paths
        .OrderBy(p => p.TargetInfo.Id)
        .Select(p => {
          uint w = 0, h = 0;
          var mode = profile.Modes.FirstOrDefault(m => m.InfoType == 1 && m.Id == p.SourceInfo.Id);
          if (mode != null) { w = mode.Width ?? 0; h = mode.Height ?? 0; }
          return string.Format("{0}:{1}:{2}x{3}@{4}/{5}:rot{6}",
            p.TargetInfo.Id, p.SourceInfo.Id, w, h,
            p.TargetInfo.RefreshNumerator, p.TargetInfo.RefreshDenominator, p.TargetInfo.Rotation);
        });
      return string.Join("|", parts);
    }

    private class LiveTarget {
      public DisplayConfigPathInfo Path;
      public ushort EdidManufactureId;
      public ushort EdidProductCodeId;
      public uint ConnectorInstance;
    }

    private static List<LiveTarget> QueryLiveTargetsWithIdentity() {
      DisplayConfigPathInfo[] livePaths;
      DisplayConfigModeInfo[] liveModes;
      QueryActive(out livePaths, out liveModes);
      return livePaths.Select(p => {
        var info = GetTargetInfo(p.TargetInfo.AdapterId, p.TargetInfo.Id);
        return new LiveTarget { Path = p, EdidManufactureId = info.EdidManufactureId, EdidProductCodeId = info.EdidProductCodeId, ConnectorInstance = info.ConnectorInstance };
      }).ToList();
    }

    // Originally adapted from Mastersign.DisplayManager's PatchDisplayConfig/
    // LookupAdapterId (MIT, see file header), which assumes adapter LUIDs go
    // stale across reboots/driver restarts but the path's numeric target/
    // source Id stays stable, so re-resolving just the LUID against a fresh
    // live query (matched by that Id) was enough.
    //
    // Confirmed via live testing (2026-08-02) that this assumption doesn't
    // hold here: the same physical monitor's target Id itself shifted across
    // captures (4353 -> 4352), taking the adapter LUID with it, which made
    // the old by-Id lookup miss entirely and fall back to a dead LUID —
    // SetDisplayConfig then rejected the whole path with ERROR_INVALID_
    // PARAMETER. So instead we match each stored path to a live one by the
    // target's actual identity: EDID manufacturer+product code (identifies
    // the monitor model) plus ConnectorInstance (which physical port of that
    // output technology — disambiguates two identical monitors on different
    // ports). That gives us the live target's *current* Id and AdapterId,
    // and — since a path's SourceInfo comes from that same live path — its
    // current source Id/AdapterId too, not just a patched-in LUID.
    //
    // No by-Id fallback: matching by the numeric Id alone is the exact thing
    // that just proved unreliable, so a path whose target isn't currently
    // resolvable by identity (e.g. a profile saved before Extras existed, or
    // the display genuinely isn't live right now) is left with its stale
    // stored Id/AdapterId and fails honestly via SetDisplayConfig's own error
    // (logged in setDisplayProfile) rather than silently guessing.
    private static void Rebuild(string json, out DisplayConfigPathInfo[] paths, out DisplayConfigModeInfo[] modes, bool remapAdapterIds) {
      var profile = new JavaScriptSerializer().Deserialize<CapturedProfile>(json);

      var targetMap = new Dictionary<uint, DisplayConfigPathTargetInfo>();
      var sourceMap = new Dictionary<uint, DisplayConfigPathSourceInfo>();

      if (remapAdapterIds) {
        var liveTargets = QueryLiveTargetsWithIdentity();
        foreach (var p in profile.Paths) {
          var extra = profile.Extras != null ? profile.Extras.FirstOrDefault(e => e.TargetId == p.TargetInfo.Id) : null;
          if (extra == null || (extra.EdidManufactureId == 0 && extra.EdidProductCodeId == 0)) continue;

          var match = liveTargets.FirstOrDefault(lt =>
            lt.EdidManufactureId == extra.EdidManufactureId &&
            lt.EdidProductCodeId == extra.EdidProductCodeId &&
            lt.ConnectorInstance == extra.ConnectorInstance &&
            lt.Path.TargetInfo.outputTechnology == p.TargetInfo.OutputTechnology);
          if (match != null) {
            targetMap[p.TargetInfo.Id] = match.Path.TargetInfo;
            sourceMap[p.SourceInfo.Id] = match.Path.SourceInfo;
          }
        }
      }

      paths = profile.Paths.Select(p => {
        var sourceAdapter = new LUID { LowPart = p.SourceInfo.AdapterId.LowPart, HighPart = p.SourceInfo.AdapterId.HighPart };
        var targetAdapter = new LUID { LowPart = p.TargetInfo.AdapterId.LowPart, HighPart = p.TargetInfo.AdapterId.HighPart };
        uint sourceId = p.SourceInfo.Id;
        uint targetId = p.TargetInfo.Id;

        DisplayConfigPathTargetInfo liveTarget;
        if (targetMap.TryGetValue(p.TargetInfo.Id, out liveTarget)) {
          targetAdapter = liveTarget.AdapterId;
          targetId = liveTarget.Id;
        }
        DisplayConfigPathSourceInfo liveSource;
        if (sourceMap.TryGetValue(p.SourceInfo.Id, out liveSource)) {
          sourceAdapter = liveSource.AdapterId;
          sourceId = liveSource.Id;
        }

        return new DisplayConfigPathInfo {
          SourceInfo = new DisplayConfigPathSourceInfo {
            AdapterId = sourceAdapter,
            Id = sourceId,
            ModeInfoIdx = p.SourceInfo.ModeInfoIdx,
            statusFlags = p.SourceInfo.StatusFlags,
          },
          TargetInfo = new DisplayConfigPathTargetInfo {
            AdapterId = targetAdapter,
            Id = targetId,
            ModeInfoIdx = p.TargetInfo.ModeInfoIdx,
            outputTechnology = p.TargetInfo.OutputTechnology,
            rotation = p.TargetInfo.Rotation,
            scaling = p.TargetInfo.Scaling,
            RefreshRate = new DisplayConfigRational { numerator = p.TargetInfo.RefreshNumerator, denominator = p.TargetInfo.RefreshDenominator },
            scanLineOrdering = p.TargetInfo.ScanLineOrdering,
            TargetAvailable = p.TargetInfo.TargetAvailable,
            statusFlags = p.TargetInfo.StatusFlags,
          },
          Flags = p.Flags,
        };
      }).ToArray();

      modes = profile.Modes.Select(m => {
        var native = FromJsonMode(m);
        DisplayConfigPathTargetInfo liveTarget;
        DisplayConfigPathSourceInfo liveSource;
        if (m.InfoType == 2 && targetMap.TryGetValue(m.Id, out liveTarget)) {
          native.AdapterId = liveTarget.AdapterId;
          native.Id = liveTarget.Id;
        } else if (m.InfoType == 1 && sourceMap.TryGetValue(m.Id, out liveSource)) {
          native.AdapterId = liveSource.AdapterId;
          native.Id = liveSource.Id;
        }
        return native;
      }).ToArray();
    }

    // Re-resolves adapter LUIDs against live state, then validates only
    // (SDC_VALIDATE, no SDC_APPLY) — zero risk, proves the config would apply
    // without actually touching the display.
    public static int Validate(string json) {
      DisplayConfigPathInfo[] paths;
      DisplayConfigModeInfo[] modes;
      Rebuild(json, out paths, out modes, remapAdapterIds: true);
      return User32.SetDisplayConfig((uint)paths.Length, paths, (uint)modes.Length, modes, SDC_VALIDATE | SDC_USE_SUPPLIED_DISPLAY_CONFIG);
    }

    const uint SDC_ALLOW_CHANGES = 0x00000400;

    // Re-resolves adapter LUIDs against live state, then applies for real.
    // allowChanges lets Windows tweak minor mode details (e.g. exact timing)
    // if applying the captured config exactly isn't achievable anymore —
    // tried without it first (see Api.Apply's caller in native-display.ts),
    // this is the deliberate-fallback path, not the default.
    public static int Apply(string json, bool allowChanges) {
      DisplayConfigPathInfo[] paths;
      DisplayConfigModeInfo[] modes;
      Rebuild(json, out paths, out modes, remapAdapterIds: true);
      uint flags = SDC_APPLY | SDC_USE_SUPPLIED_DISPLAY_CONFIG;
      if (allowChanges) flags |= SDC_ALLOW_CHANGES;
      return User32.SetDisplayConfig((uint)paths.Length, paths, (uint)modes.Length, modes, flags);
    }
  }
}
