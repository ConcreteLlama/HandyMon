import { NextRequest, NextResponse } from 'next/server';
import { collectNativeStats, collectRamOnly } from '@/utils/perf';
import { fetchLhmStats } from '@/utils/lhm';
import { presentMonAvailable } from '@/utils/presentmon';
import { requireGrant } from '@/utils/grants';

export async function GET(req: NextRequest) {
  const guard = requireGrant(req, 'perf:read');
  if (guard) return guard;

  try {
    // Sensors from LibreHardwareMonitor. FPS is served separately by /api/perf/fps
    // (fast, in-memory) — this heavier poll only reports whether capture is live.
    const lhm = await fetchLhmStats();
    const fpsAvailable = presentMonAvailable();

    if (lhm !== null && lhm.cpu.overall !== null) {
      const ram = await collectRamOnly();
      return NextResponse.json({
        timestamp: Date.now(),
        sensorsAvailable: true,
        fpsAvailable,
        cpu: {
          overall:       lhm.cpu.overall,
          cores:         lhm.cpu.cores,
          packageTempC:  lhm.cpu.packageTempC,
          packagePowerW: lhm.cpu.packagePowerW,
          avgClockMhz:   lhm.cpu.avgClockMhz,
          maxClockMhz:   lhm.cpu.maxClockMhz,
        },
        ram,
        gpu: {
          utilization:     lhm.gpu.utilization     ?? 0,
          dedicatedVramMb: lhm.gpu.dedicatedVramMb ?? 0,
          totalVramMb:     lhm.gpu.totalVramMb     ?? 0,
          tempC:           lhm.gpu.tempC,
          powerW:          lhm.gpu.powerW,
          coreClockMhz:    lhm.gpu.coreClockMhz,
          memClockMhz:     lhm.gpu.memClockMhz,
        },
      });
    }

    // Fallback: native Windows Performance Counters (LHM unavailable, ~1.2s)
    const native = await collectNativeStats();
    return NextResponse.json({
      ...native,
      sensorsAvailable: false,
      fpsAvailable,
      cpu: {
        ...native.cpu,
        packageTempC:  null,
        packagePowerW: null,
        avgClockMhz:   null,
        maxClockMhz:   null,
      },
      gpu: {
        ...native.gpu,
        tempC:        null,
        powerW:       null,
        coreClockMhz: null,
        memClockMhz:  null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
