import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, Circle, Path } from 'react-native-svg';
import { COLORS, FONTS } from '../utils/constants';

const { width } = Dimensions.get('window');

// Simple Bar Chart using react-native-svg
export function BarChart({ data = [], color = COLORS.accent, height = 120, label = '' }) {
  if (!data.length) return null;

  const chartWidth = width - 64;
  const chartHeight = height;
  const barWidth = Math.floor((chartWidth - (data.length - 1) * 6) / data.length);
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <View style={styles.chartContainer}>
      {label ? <Text style={styles.chartLabel}>{label}</Text> : null}
      <Svg width={chartWidth} height={chartHeight + 20}>
        {data.map((item, i) => {
          const barH = Math.max(4, (item.value / maxVal) * chartHeight);
          const x = i * (barWidth + 6);
          const y = chartHeight - barH;

          return (
            <React.Fragment key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                fill={color}
                opacity={0.85}
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight + 14}
                fontSize={9}
                fill={COLORS.textMuted}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// Simple Line Chart using react-native-svg
export function LineChart({ data = [], color = COLORS.accent, height = 100 }) {
  if (data.length < 2) return null;

  const chartWidth = width - 64;
  const chartHeight = height;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;

  const points = data.map((item, i) => ({
    x: (i / (data.length - 1)) * chartWidth,
    y: chartHeight - ((item.value - minVal) / range) * chartHeight,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={chartHeight + 4}>
        <Path
          d={pathD}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

// Radial progress ring
export function RadialProgress({ value = 0, max = 100, color = COLORS.accent, size = 80, label = '' }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.radialContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color + '22'}
          strokeWidth={8}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.radialCenter}>
        <Text style={[styles.radialValue, { color }]}>{value}</Text>
        {label ? <Text style={styles.radialLabel}>{label}</Text> : null}
      </View>
    </View>
  );
}

// Horizontal comparison bar
export function CompareBar({ thisWeek = 0, lastWeek = 0, color = COLORS.accent, maxVal = 100 }) {
  const chartWidth = width - 120;
  const thisW = Math.max(4, (thisWeek / maxVal) * chartWidth);
  const lastW = Math.max(4, (lastWeek / maxVal) * chartWidth);

  return (
    <Svg width={chartWidth} height={32}>
      <Rect x={0} y={4} width={lastW} height={10} rx={5} fill={COLORS.border} />
      <Rect x={0} y={18} width={thisW} height={10} rx={5} fill={color} opacity={0.9} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    marginVertical: 4,
  },
  chartLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  radialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radialCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.black,
    lineHeight: 20,
  },
  radialLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
