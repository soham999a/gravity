import Papa from "papaparse";

// ---------------------------------------------------------------------------
// GRAVITY Statistical Engine — genuine local computation, zero API cost.
// Parses CSV, profiles columns, computes stats, detects anomalies,
// finds correlations, and outputs a structured analysis report.
// ---------------------------------------------------------------------------

export interface ColumnProfile {
  name: string;
  index: number;
  type: "numeric" | "date" | "categorical" | "text" | "boolean";
  nonNull: number;
  nullCount: number;
  unique: number;
  // numeric stats
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  sum?: number;
  cv?: number;
  trend?: "upward" | "downward" | "flat";
  trendSlope?: number;
  // categorical stats
  topValues?: { value: string; count: number; pct: number }[];
  // date stats
  dateRange?: { start: string; end: string; spanDays: number };
}

export interface Correlation {
  col1: string;
  col2: string;
  r: number;
  strength: "strong" | "moderate" | "weak" | "negligible";
  direction: "positive" | "negative";
}

export interface Anomaly {
  rowIndex: number;
  column: string;
  value: number;
  zScore: number;
  severity: "extreme" | "moderate" | "mild";
  description: string;
}

export interface Trend {
  column: string;
  direction: "upward" | "downward" | "flat";
  slope: number;
  pctChange: number;
  significance: "significant" | "moderate" | "weak";
  description: string;
}

export interface Insight {
  category: string;
  finding: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface AnalysisReport {
  summary: {
    rows: number;
    columns: number;
    numericColumns: number;
    dateColumns: number;
    categoricalColumns: number;
    textColumns: number;
    memoryEstimate: string;
  };
  columns: ColumnProfile[];
  correlations: Correlation[];
  anomalies: Anomaly[];
  trends: Trend[];
  insights: Insight[];
  raw: Record<string, string>[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------

export function parseCSV(csvText: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // we type ourselves
    transformHeader: (h: string) => h.trim(),
  });
  return result.data;
}

// ---------------------------------------------------------------------------
// Profile a single column
// ---------------------------------------------------------------------------

function profileColumn(
  rows: Record<string, string>[],
  colName: string,
  colIndex: number,
): ColumnProfile {
  const values = rows.map((r) => r[colName]);
  const nonNull = values.filter((v) => v != null && v !== "").length;
  const nullCount = values.length - nonNull;
  const unique = new Set(values.filter((v) => v !== "")).size;

  const base: ColumnProfile = {
    name: colName,
    index: colIndex,
    type: "text",
    nonNull,
    nullCount,
    unique,
  };

  if (nonNull === 0) return base;

  // Detect type
  const nonEmpty = values.filter((v) => v !== "" && v != null);
  const numericCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
  const dateCount = nonEmpty.filter((v) => !isNaN(Date.parse(v))).length;
  const boolCount = nonEmpty.filter((v) =>
    /^(true|false|yes|no|0|1)$/i.test(v),
  ).length;

  const numericRatio = numericCount / nonEmpty.length;
  const dateRatio = dateCount / nonEmpty.length;
  const boolRatio = boolCount / nonEmpty.length;

  if (numericRatio > 0.85) {
    base.type = "numeric";
    const nums = nonEmpty.map(Number);
    const sorted = [...nums].sort((a, b) => a - b);
    const n = nums.length;
    const mean = nums.reduce((s, v) => s + v, 0) / n;
    const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const median =
      n % 2
        ? sorted[(n - 1) / 2]!
        : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;

    base.mean = round(mean);
    base.median = round(median);
    base.std = round(std);
    base.min = sorted[0]!;
    base.max = sorted[n - 1]!;
    base.q1 = sorted[Math.floor(n * 0.25)]!;
    base.q3 = sorted[Math.floor(n * 0.75)]!;
    base.sum = round(nums.reduce((s, v) => s + v, 0));
    base.cv = mean !== 0 ? round(std / Math.abs(mean)) : 0;

    // Trend (simple linear regression)
    if (n >= 3) {
      const { slope } = linearRegression(nums);
      const pctChange = nums[0] !== 0 ? ((nums[n - 1] - nums[0]) / Math.abs(nums[0])) * 100 : 0;
      base.trendSlope = round(slope);
      base.trend =
        Math.abs(slope) < base.mean * 0.01
          ? "flat"
          : slope > 0
            ? "upward"
            : "downward";
    }
  } else if (dateRatio > 0.7) {
    base.type = "date";
    const dates = nonEmpty.map((v) => new Date(v)).filter((d) => !isNaN(d.getTime()));
    if (dates.length >= 2) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      base.dateRange = {
        start: dates[0]!.toISOString().slice(0, 10),
        end: dates[dates.length - 1]!.toISOString().slice(0, 10),
        spanDays: Math.round(
          (dates[dates.length - 1]!.getTime() - dates[0]!.getTime()) /
            86_400_000,
        ),
      };
    }
  } else if (boolRatio > 0.8) {
    base.type = "boolean";
  } else if (unique <= Math.min(20, nonEmpty.length * 0.3)) {
    base.type = "categorical";
    const freq = new Map<string, number>();
    for (const v of nonEmpty) freq.set(v, (freq.get(v) ?? 0) + 1);
    base.topValues = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({
        value,
        count,
        pct: round((count / nonEmpty.length) * 100),
      }));
  } else {
    base.type = "text";
  }

  return base;
}

// ---------------------------------------------------------------------------
// Correlations (Pearson for numeric pairs)
// ---------------------------------------------------------------------------

function computeCorrelations(
  rows: Record<string, string>[],
  numericCols: string[],
): Correlation[] {
  if (numericCols.length < 2) return [];
  const corrs: Correlation[] = [];

  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const pairs: [number, number][] = [];
      for (const row of rows) {
        const a = Number(row[numericCols[i]!]);
        const b = Number(row[numericCols[j]!]);
        if (!isNaN(a) && !isNaN(b)) pairs.push([a, b]);
      }
      if (pairs.length < 5) continue;

      const r = pearson(pairs);
      if (Math.abs(r) < 0.1) continue;

      const absR = Math.abs(r);
      corrs.push({
        col1: numericCols[i]!,
        col2: numericCols[j]!,
        r: round(r),
        strength:
          absR >= 0.7
            ? "strong"
            : absR >= 0.4
              ? "moderate"
              : absR >= 0.2
                ? "weak"
                : "negligible",
        direction: r > 0 ? "positive" : "negative",
      });
    }
  }

  return corrs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Anomaly detection (z-score + IQR)
// ---------------------------------------------------------------------------

function detectAnomalies(
  rows: Record<string, string>[],
  numericCols: string[],
  profiles: ColumnProfile[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const colName of numericCols) {
    const profile = profiles.find((p) => p.name === colName);
    if (!profile || profile.mean == null || profile.std == null || profile.std === 0) continue;

    const { mean, std } = profile;
    const iqr = (profile.q3 ?? 0) - (profile.q1 ?? 0);
    const lowerFence = (profile.q1 ?? 0) - 1.5 * iqr;
    const upperFence = (profile.q3 ?? 0) + 1.5 * iqr;

    for (let idx = 0; idx < rows.length; idx++) {
      const val = Number(rows[idx]![colName]);
      if (isNaN(val)) continue;

      const zScore = (val - mean) / std;
      const isOutlier = val < lowerFence || val > upperFence;

      if (Math.abs(zScore) > 2 || isOutlier) {
        const severity =
          Math.abs(zScore) > 3 || val < (profile.q1 ?? mean) - 2.5 * iqr || val > (profile.q3 ?? mean) + 2.5 * iqr
            ? "extreme"
            : Math.abs(zScore) > 2.5
              ? "moderate"
              : "mild";

        anomalies.push({
          rowIndex: idx,
          column: colName,
          value: round(val),
          zScore: round(zScore),
          severity,
          description: `${colName} row ${idx + 1}: ${val} (z=${round(zScore)}) — ${
            severity === "extreme"
              ? "far outside normal range"
              : severity === "moderate"
                ? "notable deviation from pattern"
                : "mild outlier"
          }`,
        });
      }
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 20);
}

// ---------------------------------------------------------------------------
// Trend detection per numeric column
// ---------------------------------------------------------------------------

function detectTrends(
  rows: Record<string, string>[],
  numericCols: string[],
): Trend[] {
  const trends: Trend[] = [];

  for (const colName of numericCols) {
    const nums = rows
      .map((r) => Number(r[colName]))
      .filter((v) => !isNaN(v));
    if (nums.length < 3) continue;

    const { slope, rSquared } = linearRegression(nums);
    const pctChange =
      nums[0] !== 0
        ? ((nums[nums.length - 1] - nums[0]) / Math.abs(nums[0])) * 100
        : 0;

    const direction =
      Math.abs(slope) < Math.abs(nums.reduce((s, v) => s + v, 0) / nums.length) * 0.01
        ? "flat"
        : slope > 0
          ? "upward"
          : "downward";

    const significance =
      rSquared > 0.5
        ? "significant"
        : rSquared > 0.2
          ? "moderate"
          : "weak";

    trends.push({
      column: colName,
      direction,
      slope: round(slope),
      pctChange: round(pctChange),
      significance,
      description:
        `${colName}: ${direction} trend (slope=${round(slope)}, R²=${round(rSquared)}, ` +
        `${pctChange > 0 ? "+" : ""}${round(pctChange)}% change from start to end)`,
    });
  }

  return trends.sort((a, b) => {
    const order = { significant: 0, moderate: 1, weak: 2 };
    return order[a.significance] - order[b.significance];
  });
}

// ---------------------------------------------------------------------------
// Insight generation (rule-based, zero LLM)
// ---------------------------------------------------------------------------

function generateInsights(
  profiles: ColumnProfile[],
  correlations: Correlation[],
  anomalies: Anomaly[],
  trends: Trend[],
  rowCount: number,
): Insight[] {
  const insights: Insight[] = [];

  // Data quality
  const highNullCols = profiles.filter((p) => p.nonNull < rowCount * 0.8);
  if (highNullCols.length > 0) {
    insights.push({
      category: "Data Quality",
      finding: `${highNullCols.length} column(s) have >20% missing data`,
      evidence: highNullCols.map((c) => `${c.name} (${Math.round(((rowCount - c.nonNull) / rowCount) * 100)}% missing)`).join(", "),
      confidence: "high",
    });
  }

  // Strong correlations
  const strongCorrs = correlations.filter((c) => c.strength === "strong");
  for (const corr of strongCorrs.slice(0, 3)) {
    insights.push({
      category: "Correlation",
      finding: `${corr.col1} and ${corr.col2} are strongly ${corr.direction}ly correlated`,
      evidence: `Pearson r = ${corr.r} (${corr.strength})`,
      confidence: "high",
    });
  }

  // Extreme anomalies
  const extremeAnomalies = anomalies.filter((a) => a.severity === "extreme");
  if (extremeAnomalies.length > 0) {
    const byCol = new Map<string, Anomaly[]>();
    for (const a of extremeAnomalies) {
      const arr = byCol.get(a.column) ?? [];
      arr.push(a);
      byCol.set(a.column, arr);
    }
    for (const [col, items] of byCol) {
      insights.push({
        category: "Anomaly",
        finding: `${items.length} extreme outlier(s) detected in "${col}"`,
        evidence: items
          .slice(0, 3)
          .map((a) => `row ${a.rowIndex + 1}: ${a.value} (z=${a.zScore})`)
          .join("; "),
        confidence: "high",
      });
    }
  }

  // Significant trends
  const sigTrends = trends.filter((t) => t.significance === "significant");
  for (const trend of sigTrends.slice(0, 3)) {
      insights.push({
        category: "Trend",
        finding: `"${trend.column}" shows a ${trend.significance} ${trend.direction} trend`,
      evidence: trend.description,
      confidence: trend.significance === "significant" ? "high" : "medium",
    });
  }

  // Categorical concentration
  const catCols = profiles.filter((p) => p.type === "categorical" && p.topValues);
  for (const col of catCols.slice(0, 2)) {
    if (col.topValues && col.topValues.length > 0) {
      const top1 = col.topValues[0]!;
      if (top1.pct > 50) {
        insights.push({
          category: "Distribution",
          finding: `"${col.name}" is dominated by "${top1.value}" (${top1.pct}%)`,
          evidence: `Top values: ${col.topValues.slice(0, 3).map((v) => `${v.value} (${v.pct}%)`).join(", ")}`,
          confidence: "medium",
        });
      }
    }
  }

  return insights.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Main analysis entry point
// ---------------------------------------------------------------------------

export function analyzeDataset(
  csvText: string,
  userPrompt?: string,
): AnalysisReport {
  try {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return {
        summary: { rows: 0, columns: 0, numericColumns: 0, dateColumns: 0, categoricalColumns: 0, textColumns: 0, memoryEstimate: "0 B" },
        columns: [],
        correlations: [],
        anomalies: [],
        trends: [],
        insights: [],
        raw: [],
        error: "No data rows found in CSV.",
      };
    }

    const colNames = Object.keys(rows[0]!);
    const profiles = colNames.map((name, i) => profileColumn(rows, name, i));

    const numericCols = profiles.filter((p) => p.type === "numeric").map((p) => p.name);
    const dateCols = profiles.filter((p) => p.type === "date").map((p) => p.name);
    const catCols = profiles.filter((p) => p.type === "categorical").map((p) => p.name);
    const textCols = profiles.filter((p) => p.type === "text").map((p) => p.name);

    const correlations = computeCorrelations(rows, numericCols);
    const anomalies = detectAnomalies(rows, numericCols, profiles);
    const trends = detectTrends(rows, numericCols);
    const insights = generateInsights(profiles, correlations, anomalies, trends, rows.length);

    // If user prompt contains analytical keywords, add context-specific insights
    if (userPrompt) {
      const promptLower = userPrompt.toLowerCase();
      const extraInsights = generateContextualInsights(promptLower, profiles, trends, anomalies, correlations, rows);
      insights.push(...extraInsights);
    }

    const memBytes = JSON.stringify(rows).length;
    const memStr =
      memBytes > 1_000_000
        ? `${(memBytes / 1_000_000).toFixed(1)} MB`
        : memBytes > 1_000
          ? `${(memBytes / 1_000).toFixed(1)} KB`
          : `${memBytes} B`;

    return {
      summary: {
        rows: rows.length,
        columns: colNames.length,
        numericColumns: numericCols.length,
        dateColumns: dateCols.length,
        categoricalColumns: catCols.length,
        textColumns: textCols.length,
        memoryEstimate: memStr,
      },
      columns: profiles,
      correlations,
      anomalies,
      trends,
      insights,
      raw: rows.slice(0, 5), // first 5 rows for LLM context
    };
  } catch (err) {
    return {
      summary: { rows: 0, columns: 0, numericColumns: 0, dateColumns: 0, categoricalColumns: 0, textColumns: 0, memoryEstimate: "0 B" },
      columns: [],
      correlations: [],
      anomalies: [],
      trends: [],
      insights: [],
      raw: [],
      error: `Analysis failed: ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Contextual insights based on user prompt keywords
// ---------------------------------------------------------------------------

function generateContextualInsights(
  promptLower: string,
  profiles: ColumnProfile[],
  trends: Trend[],
  anomalies: Anomaly[],
  correlations: Correlation[],
  rows: Record<string, string>[],
): Insight[] {
  const insights: Insight[] = [];

  // Detect logistics/delivery analysis
  if (promptLower.includes("logistic") || promptLower.includes("delivery") || promptLower.includes("shipment") || promptLower.includes("delay")) {
    // Find cost/delay related columns
    const costCols = profiles.filter((p) =>
      /cost|price|charge|fee|surcharge|revenue|expense/i.test(p.name),
    );
    const delayCols = profiles.filter((p) =>
      /delay|late|on.?time|delivery|transit|eta|duration/i.test(p.name),
    );

    for (const col of costCols) {
      if (col.mean != null && col.trend === "upward") {
        insights.push({
          category: "Cost Analysis",
          finding: `"${col.name}" is trending upward (mean=${col.mean}, trend slope=${col.trendSlope})`,
          evidence: `This column shows a consistent increase over the dataset period.`,
          confidence: "high",
        });
      }
    }
    for (const col of delayCols) {
      if (col.mean != null && col.trend === "upward") {
        insights.push({
          category: "Delivery Performance",
          finding: `"${col.name}" is increasing (mean=${col.mean}, suggesting worsening delivery performance)`,
          evidence: `Rising values in delay-related metrics indicate growing operational issues.`,
          confidence: "high",
        });
      }
    }
  }

  // Detect risk analysis requests
  if (promptLower.includes("risk") || promptLower.includes("high-risk") || promptLower.includes("anomal")) {
    const extremeCount = anomalies.filter((a) => a.severity === "extreme").length;
    if (extremeCount > 0) {
      insights.push({
        category: "Risk Assessment",
        finding: `${extremeCount} extreme anomalies detected across the dataset`,
        evidence: `These data points deviate significantly (z-score > 3) from the norm and may indicate high-risk cases.`,
        confidence: "high",
      });
    }
  }

  return insights.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function pearson(pairs: [number, number][]): number {
  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p[0], 0);
  const sumY = pairs.reduce((s, p) => s + p[1], 0);
  const sumXY = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = pairs.reduce((s, p) => s + p[0] ** 2, 0);
  const sumY2 = pairs.reduce((s, p) => s + p[1] ** 2, 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  return den === 0 ? 0 : num / den;
}

function linearRegression(values: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i]! - yMean);
    den += (i - xMean) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  // R-squared
  const predicted = values.map((_, i) => slope * i + intercept);
  const ssRes = values.reduce((s, v, i) => s + (v - predicted[i]!) ** 2, 0);
  const ssTot = values.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope: round(slope), intercept: round(intercept), rSquared: round(rSquared) };
}

// ---------------------------------------------------------------------------
// Format report as LLM-consumable text (for the synthesis step)
// ---------------------------------------------------------------------------

export function formatReportForLLM(report: AnalysisReport, userPrompt: string): string {
  const lines: string[] = [];

  lines.push("=== STATISTICAL ANALYSIS REPORT (computed locally, zero LLM cost) ===\n");
  lines.push(`Dataset: ${report.summary.rows} rows × ${report.summary.columns} columns`);
  lines.push(
    `Types: ${report.summary.numericColumns} numeric, ${report.summary.dateColumns} date, ${report.summary.categoricalColumns} categorical, ${report.summary.textColumns} text`,
  );
  lines.push("");

  // Column summaries
  lines.push("--- COLUMN PROFILES ---");
  for (const col of report.columns) {
    if (col.type === "numeric" && col.mean != null) {
      lines.push(
        `${col.name} (numeric): mean=${col.mean}, std=${col.std}, min=${col.min}, max=${col.max}, median=${col.median}, trend=${col.trend ?? "n/a"}`,
      );
    } else if (col.type === "categorical" && col.topValues) {
      lines.push(
        `${col.name} (categorical): ${col.topValues.slice(0, 4).map((v) => `${v.value} (${v.pct}%)`).join(", ")}`,
      );
    } else if (col.type === "date" && col.dateRange) {
      lines.push(
        `${col.name} (date): ${col.dateRange.start} to ${col.dateRange.end} (${col.dateRange.spanDays} days)`,
      );
    }
  }
  lines.push("");

  // Trends
  if (report.trends.length > 0) {
    lines.push("--- TRENDS ---");
    for (const t of report.trends) {
      lines.push(`- ${t.description}`);
    }
    lines.push("");
  }

  // Correlations
  if (report.correlations.length > 0) {
    lines.push("--- CORRELATIONS ---");
    for (const c of report.correlations.slice(0, 6)) {
      lines.push(
        `- ${c.col1} ↔ ${c.col2}: r=${c.r} (${c.strength} ${c.direction})`,
      );
    }
    lines.push("");
  }

  // Anomalies
  if (report.anomalies.length > 0) {
    lines.push("--- ANOMALIES ---");
    for (const a of report.anomalies.slice(0, 10)) {
      lines.push(`- ${a.description}`);
    }
    lines.push("");
  }

  // Insights
  if (report.insights.length > 0) {
    lines.push("--- KEY INSIGHTS ---");
    for (const ins of report.insights) {
      lines.push(`- [${ins.category}] ${ins.finding} (${ins.confidence} confidence)`);
      lines.push(`  Evidence: ${ins.evidence}`);
    }
    lines.push("");
  }

  // Sample rows
  if (report.raw.length > 0) {
    lines.push("--- SAMPLE DATA (first 5 rows) ---");
    lines.push(JSON.stringify(report.raw, null, 1));
    lines.push("");
  }

  lines.push(`=== USER REQUEST ===\n${userPrompt}`);

  return lines.join("\n");
}
