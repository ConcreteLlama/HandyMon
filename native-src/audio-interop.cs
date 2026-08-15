using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace HandyMonAudio {
  internal enum EDataFlow { eRender = 0, eCapture = 1, eAll = 2 }
  internal enum ERole { eConsole = 0, eMultimedia = 1, eCommunications = 2 }

  [StructLayout(LayoutKind.Sequential)]
  internal struct PropertyKey { public Guid fmtid; public int pid; }

  [StructLayout(LayoutKind.Explicit)]
  internal struct PropVariant {
    [FieldOffset(0)] public short vt;
    [FieldOffset(8)] public IntPtr pointerValue;
  }

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(EDataFlow dataFlow, uint dwStateMask, out IMMDeviceCollection ppDevices);
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
    int GetDevice(string pwstrId, out IMMDevice ppDevice);
    int RegisterEndpointNotificationCallback(IntPtr pClient);
    int UnregisterEndpointNotificationCallback(IntPtr pClient);
  }

  [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDeviceCollection {
    int GetCount(out uint pcDevices);
    int Item(uint nDevice, out IMMDevice ppDevice);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDevice {
    int Activate(ref Guid iid, uint dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    int OpenPropertyStore(uint stgmAccess, out IPropertyStore ppProperties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    int GetState(out uint pdwState);
  }

  [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IPropertyStore {
    int GetCount(out int cProps);
    int GetAt(int iProp, out PropertyKey pkey);
    int GetValue(ref PropertyKey key, out PropVariant pv);
    int SetValue(ref PropertyKey key, ref PropVariant propvar);
    int Commit();
  }

  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out int pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
    int GetMute(out bool pbMute);
    int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
    int VolumeStepUp(Guid pguidEventContext);
    int VolumeStepDown(Guid pguidEventContext);
    int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
  }

  [Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IPolicyConfig {
    int GetMixFormat(string pszDeviceName, IntPtr ppFormat);
    int GetDeviceFormat(string pszDeviceName, bool bDefault, IntPtr ppFormat);
    int ResetDeviceFormat(string pszDeviceName);
    int SetDeviceFormat(string pszDeviceName, IntPtr pEndpointFormat, IntPtr MixFormat);
    int GetProcessingPeriod(string pszDeviceName, bool bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
    int SetProcessingPeriod(string pszDeviceName, IntPtr pmftPeriod);
    int GetShareMode(string pszDeviceName, IntPtr pMode);
    int SetShareMode(string pszDeviceName, IntPtr mode);
    int GetPropertyValue(string pszDeviceName, bool bFxStore, IntPtr key, IntPtr pv);
    int SetPropertyValue(string pszDeviceName, bool bFxStore, IntPtr key, IntPtr pv);
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ERole role);
    int SetEndpointVisibility(string pszDeviceName, bool bVisible);
  }

  public class DeviceInfo {
    public string Id;
    public string Name;
    public string DeviceName;
    public double VolumePercent;
    public bool IsDefault;
  }

  public static class Api {
    [DllImport("ole32.dll")]
    private static extern int CoCreateInstance(ref Guid clsid, IntPtr pUnkOuter, uint dwClsContext, ref Guid iid, out IntPtr ppv);

    private static readonly Guid CLSID_MMDeviceEnumerator = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
    private static readonly Guid CLSID_PolicyConfigClient = new Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9");
    private static readonly PropertyKey PKEY_Device_FriendlyName = new PropertyKey { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };

    // .NET caches exactly one RCW per underlying COM identity per AppDomain.
    // Creating the object via a [ComImport] class first (class identity) and
    // only later casting to the real interface reuses that first, wrongly
    // typed RCW instead of one typed to the interface — calling
    // CoCreateInstance directly for the target interface's IID avoids ever
    // creating that first wrongly typed RCW.
    private static T CoCreate<T>(Guid clsid) {
      Guid iid = typeof(T).GUID;
      IntPtr pInterface;
      Marshal.ThrowExceptionForHR(CoCreateInstance(ref clsid, IntPtr.Zero, 1, ref iid, out pInterface));
      try {
        return (T)Marshal.GetTypedObjectForIUnknown(pInterface, typeof(T));
      } finally {
        Marshal.Release(pInterface);
      }
    }

    private static IMMDeviceEnumerator NewEnumerator() {
      return CoCreate<IMMDeviceEnumerator>(CLSID_MMDeviceEnumerator);
    }

    private static string GetFriendlyName(IMMDevice dev) {
      IPropertyStore store;
      dev.OpenPropertyStore(0, out store);
      PropVariant pv;
      var key = PKEY_Device_FriendlyName;
      store.GetValue(ref key, out pv);
      return pv.pointerValue != IntPtr.Zero ? Marshal.PtrToStringUni(pv.pointerValue) : "(unknown)";
    }

    private static double GetVolumePercent(IMMDevice dev) {
      Guid iidVol = typeof(IAudioEndpointVolume).GUID;
      object volObjRaw;
      if (dev.Activate(ref iidVol, 1, IntPtr.Zero, out volObjRaw) != 0) return -1;
      var volCtl = (IAudioEndpointVolume)volObjRaw;
      float level;
      return volCtl.GetMasterVolumeLevelScalar(out level) == 0 ? Math.Round(level * 100) : -1;
    }

    public static List<DeviceInfo> ListRenderDevices() {
      var enumerator = NewEnumerator();

      string defaultId = null;
      IMMDevice defaultDev;
      if (enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out defaultDev) == 0) {
        defaultDev.GetId(out defaultId);
      }

      IMMDeviceCollection collection;
      Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(EDataFlow.eRender, 1, out collection));
      uint count;
      collection.GetCount(out count);

      var result = new List<DeviceInfo>();
      for (uint i = 0; i < count; i++) {
        IMMDevice dev;
        collection.Item(i, out dev);

        string id;
        dev.GetId(out id);

        string name = GetFriendlyName(dev);
        // Short label: the part inside the outermost parens if present (e.g.
        // "Speakers (Creative BT-W6)" -> "Creative BT-W6"; first '(' + last ')'
        // so nested parens like "Realtek Digital Output (Realtek(R) Audio)"
        // still extract the whole "Realtek(R) Audio" instead of just "R) Audio"),
        // else the full name.
        string deviceName = name;
        int open = name.IndexOf('(');
        int close = name.LastIndexOf(')');
        if (open >= 0 && close > open) deviceName = name.Substring(open + 1, close - open - 1);

        result.Add(new DeviceInfo {
          Id = id,
          Name = name,
          DeviceName = deviceName,
          VolumePercent = GetVolumePercent(dev),
          IsDefault = id == defaultId,
        });
      }
      return result;
    }

    public static void SetVolume(string deviceId, float percent) {
      var enumerator = NewEnumerator();
      IMMDevice dev;
      Marshal.ThrowExceptionForHR(enumerator.GetDevice(deviceId, out dev));
      Guid iidVol = typeof(IAudioEndpointVolume).GUID;
      object volObjRaw;
      Marshal.ThrowExceptionForHR(dev.Activate(ref iidVol, 1, IntPtr.Zero, out volObjRaw));
      var volCtl = (IAudioEndpointVolume)volObjRaw;
      Marshal.ThrowExceptionForHR(volCtl.SetMasterVolumeLevelScalar(percent / 100f, Guid.Empty));
    }

    public static void SetDefaultEndpoint(string deviceId, int role) {
      var policyConfig = CoCreate<IPolicyConfig>(CLSID_PolicyConfigClient);
      Marshal.ThrowExceptionForHR(policyConfig.SetDefaultEndpoint(deviceId, (ERole)role));
    }
  }
}
