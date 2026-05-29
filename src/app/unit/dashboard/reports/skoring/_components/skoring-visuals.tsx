"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";

export type VisualIndicator = {
  name: string;
  score: number;
  maxScore: number;
  value: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getPercent(score: number, maxScore: number) {
  if (maxScore <= 0) return 0;
  return clamp((score / maxScore) * 100);
}

function getColor(percent: number) {
  if (percent >= 75) return "#059669";
  if (percent >= 45) return "#f59e0b";
  return "#ef4444";
}

function getQuality(percent: number) {
  if (percent >= 75) return "Kuat";
  if (percent >= 45) return "Sedang";
  return "Lemah";
}

function shortLabel(name: string) {
  if (name.includes("ROE")) return "ROE";
  if (name.includes("ROI")) return "ROI";
  if (name.includes("Rasio Kas")) return "Kas";
  if (name.includes("Rasio Lancar")) return "Lancar";
  if (name.includes("Penagihan")) return "Tagih";
  if (name.includes("Persediaan")) return "Stok";
  if (name.includes("Total Aset")) return "Aset";
  if (name.includes("Modal Pemilik")) return "Modal";
  return name;
}

export function AnimatedGaugeCard({
  title,
  value,
  score,
  maxScore,
}: {
  title: string;
  value: string;
  score: number;
  maxScore: number;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const duration = 900;
    const start = performance.now();
    const target = Math.max(0, score);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(target * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [score]);

  const percent = getPercent(animatedScore, maxScore);
  const finalPercent = getPercent(score, maxScore);
  const color = getColor(finalPercent);
  const quality = getQuality(finalPercent);
  const needleAngle = 180 - percent * 1.8;
  const arcPath = "M 30 110 A 80 80 0 0 1 190 110";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-700">
            {title}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{value}</p>
        </div>

        <span
          className="rounded-full px-2 py-1 text-[10px] font-black text-white"
          style={{ backgroundColor: color }}
        >
          {quality}
        </span>
      </div>

      <div className="mt-3">
        <svg viewBox="0 0 220 130" className="h-28 w-full">
          <path
            d={arcPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="18"
            strokeLinecap="round"
            pathLength={100}
          />
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${percent} 100`}
          />

          <g transform={`rotate(${needleAngle} 110 110)`}>
            <line
              x1="110"
              y1="110"
              x2="178"
              y2="110"
              stroke="#0f172a"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>

          <circle cx="110" cy="110" r="9" fill="#0f172a" />
          <circle cx="110" cy="110" r="4" fill="#ffffff" />

          <text
            x="110"
            y="88"
            textAnchor="middle"
            className="fill-slate-950 text-[30px] font-black"
          >
            {Math.round(animatedScore)}
          </text>
          <text
            x="110"
            y="104"
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-bold"
          >
            dari {maxScore}
          </text>

          <text
            x="30"
            y="122"
            textAnchor="start"
            className="fill-slate-400 text-[10px] font-bold"
          >
            0
          </text>
          <text
            x="190"
            y="122"
            textAnchor="end"
            className="fill-slate-400 text-[10px] font-bold"
          >
            {maxScore}
          </text>
        </svg>
      </div>
    </Card>
  );
}

export function IndicatorLineChartCard({
  indicators,
}: {
  indicators: VisualIndicator[];
}) {
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const duration = 1100;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimationProgress(eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [indicators]);

  const chartData = useMemo(() => {
    return indicators.map((indicator) => ({
      ...indicator,
      percent: getPercent(indicator.score, indicator.maxScore),
    }));
  }, [indicators]);

  const width = 560;
  const height = 260;
  const paddingLeft = 46;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const stepX = chartData.length > 1 ? plotWidth / (chartData.length - 1) : plotWidth;
  const benchmark = 65;

  const points = chartData.map((item, index) => {
    const x = paddingLeft + index * stepX;
    const animatedPercent = item.percent * animationProgress;
    const y = paddingTop + plotHeight - (animatedPercent / 100) * plotHeight;

    return {
      ...item,
      x,
      y,
      animatedPercent,
    };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    `${paddingLeft},${paddingTop + plotHeight}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${paddingLeft + plotWidth},${paddingTop + plotHeight}`,
  ].join(" ");

  const averagePercent =
    chartData.length > 0
      ? Math.round(
          chartData.reduce((sum, item) => sum + item.percent, 0) / chartData.length
        )
      : 0;

  const strongest =
    chartData.length > 0
      ? [...chartData].sort((a, b) => b.percent - a.percent)[0]
      : null;

  const weakest =
    chartData.length > 0
      ? [...chartData].sort((a, b) => a.percent - b.percent)[0]
      : null;

  return (
    <Card>
      <CardHeader
        title="Profil Capaian Indikator"
        description="Line chart visual untuk melihat pola kekuatan dan kelemahan skor per indikator."
        action={
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Activity className="h-5 w-5" />
          </div>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = paddingTop + plotHeight - (tick / 100) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + plotWidth}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-bold"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight - (benchmark / 100) * plotHeight}
            x2={paddingLeft + plotWidth}
            y2={paddingTop + plotHeight - (benchmark / 100) * plotHeight}
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="6 6"
          />

          <polygon points={areaPoints} fill="rgba(37, 99, 235, 0.12)" />

          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point) => (
            <g key={point.name}>
              <circle cx={point.x} cy={point.y} r="5" fill="#2563eb" />
              <circle cx={point.x} cy={point.y} r="2" fill="#ffffff" />
              <text
                x={point.x}
                y={point.y - 10}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-black"
              >
                {Math.round(point.animatedPercent)}%
              </text>
              <text
                x={point.x}
                y={paddingTop + plotHeight + 18}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-bold"
              >
                {shortLabel(point.name)}
              </text>
            </g>
          ))}

          <text
            x={paddingLeft + plotWidth}
            y={paddingTop + plotHeight - (benchmark / 100) * plotHeight - 8}
            textAnchor="end"
            className="fill-amber-600 text-[10px] font-black"
          >
            Benchmark Visual 65%
          </text>
        </svg>

        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Rata-rata capaian
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {averagePercent}%
            </p>
          </div>

          <div className="rounded-2xl bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Indikator terkuat
            </p>
            <p className="mt-1 text-sm font-black text-emerald-700">
              {strongest ? shortLabel(strongest.name) : "-"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Indikator terlemah
            </p>
            <p className="mt-1 text-sm font-black text-rose-700">
              {weakest ? shortLabel(weakest.name) : "-"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
