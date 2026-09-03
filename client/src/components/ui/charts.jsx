/* ============================================================================
   charts.jsx — the two chart forms this product needs.
   ----------------------------------------------------------------------------
   Built on Recharts with Untitled UI's `charts-base` tooltip and active dot, so
   a chart reads as part of the same system as the tables and cards around it.

   Both forms are deliberately SINGLE-SERIES:
     • the trend is one measure over time, so identity needs no legend — the
       card title names it;
     • the distribution is one measure across categories, so the category name
       on the axis carries identity and the bars stay one hue.
   That keeps colour out of the job of telling categories apart, which is what
   makes these readable for colour-blind users and in print.

   Colour comes from the brand token rather than a literal, so the charts follow
   the theme — including dark mode — without a second definition.
   ========================================================================== */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartActiveDot, ChartTooltipContent } from '@/components/application/charts/charts-base'

/* The one series colour, resolved from the theme so dark mode follows. */
const SERIES = 'var(--color-utility-brand-600)'
const AXIS_TEXT = 'var(--color-text-tertiary)'
const GRID = 'var(--color-border-secondary)'

const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: AXIS_TEXT, fontSize: 12 },
}

/**
 * Change over time. One measure, one hue, crosshair tooltip.
 *
 * @param data  `[{ label, value }]`
 */
export function TrendAreaChart({ data, height = 240, valueLabel = 'CARs' }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="qms-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} width={44} {...axisProps} />

          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ stroke: GRID, strokeWidth: 1 }}
            formatter={(value) => [value, valueLabel]}
          />

          <Area
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={SERIES}
            strokeWidth={2}
            fill="url(#qms-trend-fill)"
            activeDot={<ChartActiveDot />}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Magnitude across categories. Horizontal so long category names stay level and
 * readable, one hue, and every bar carries its own value so the chart can be
 * read without the axis.
 *
 * @param data `[{ label, value }]` — already in the order it should be shown.
 */
export function CategoryBarChart({ data, height, labelWidth = 118 }) {
  const resolvedHeight = height ?? Math.max(160, data.length * 38 + 16)

  return (
    <div style={{ height: resolvedHeight }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="label" width={labelWidth} {...axisProps} />

          <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--color-bg-secondary)' }} />

          <Bar dataKey="value" name="CARs" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={SERIES} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              style={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
