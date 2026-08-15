'use client';

import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { CardShell, CardTitle, chartSx, chartFillSx, AXIS_LABEL_COLOR } from './cards/shared';

export function MiniChart({
  label, xData, series, yMax, yFormatter, height: minHeight = 140, cardId, help, helpTitle,
}: {
  label: string;
  xData: number[];
  series: { data: (number | null)[]; color: string; label: string }[];
  yMax: number;
  yFormatter: (v: number) => string;
  height?: number;
  cardId?: string;
  help?: string;
  helpTitle?: string;
}) {
  return (
    <CardShell cardId={cardId} help={help} helpTitle={helpTitle}>
      <CardTitle>{label}</CardTitle>
      <Box sx={chartFillSx(minHeight)}>
        <LineChart
          xAxis={[{ data: xData, scaleType: 'linear', tickNumber: 4, height: 18, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 } }]}
          yAxis={[{ min: 0, max: yMax, width: 38, tickLabelStyle: { fill: AXIS_LABEL_COLOR, fontSize: 10 }, valueFormatter: yFormatter }]}
          series={series.map(s => ({ ...s, area: true, showMark: false }))}
          margin={{ top: 10, bottom: 6, left: 4, right: 8 }}
          sx={chartSx}
        />
      </Box>
    </CardShell>
  );
}
