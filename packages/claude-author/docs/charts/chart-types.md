---
title: "@brewsite/charts — Chart Type Decision Guide"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## When to Use BarChart

Use a bar chart to compare discrete, unordered categories: revenue by product line, users by country, conversions by campaign. The visual emphasis is on individual values and their magnitude relative to each other. Grouped and stacked modes let you show multiple series side by side or accumulated within each category.

Do not use a bar chart for time-series data where the trend matters more than individual values — use `LineChart` instead. Do not use it for more than roughly 20 categories; readability breaks down and bars become too thin to read. For a single part-of-whole comparison with 5 or fewer segments, `PieChart` is more scannable.

**Distinctive props:** `orientation` (vertical/horizontal), `stackMode` (grouped/stacked), `barPadding`

```tsx
<BarChart id="revenue" data={salesData} orientation="vertical" stackMode="grouped" ...>
```

---

## When to Use LineChart

Use a line chart to show how one or more continuous values change over a sequence — time series, steps, ordered categories. The connected line makes trends, acceleration, and inflection points immediately visible. Multi-series lines make it easy to compare trajectories across groups.

Do not use a line chart when the x-axis values are unordered categories with no meaningful sequence — use `BarChart` instead. Avoid it when you have more than 6–8 overlapping series; the lines become unreadable.

**Distinctive props:** `lineSmoothness` (curve amount), `showPoints` (nodes at data vertices), `lineShape` (3D profile geometry)

```tsx
<LineChart id="trend" data={timeData} lineSmoothness={0.5} showPoints ...>
```

---

## When to Use AreaChart

Use an area chart when you want to emphasize the volume or cumulative magnitude of a quantity over time, not just its direction. Stacked areas are effective for showing how multiple series combine into a total — for example, traffic by channel adding up to total visits.

Do not use an area chart when the values between individual series overlap significantly without stacking — the fill will obscure the series below. Use `LineChart` when you need to compare trajectory without implying accumulation. The band variant (`bandField` on `<ChartSeries>`) is best reserved for confidence intervals or ranges.

**Distinctive props:** `stackMode` (none/stacked), `fillOpacity`, `bandField` on `<ChartSeries>` for band/range variants

```tsx
<AreaChart id="traffic" data={channelData} stackMode="stacked" fillOpacity={0.75} ...>
```

---

## When to Use PieChart

Use a pie chart to show part-of-whole relationships for a small number of named segments. It works best with 3–6 slices where the proportional difference between them is the key message. The donut variant (`innerRadius > 0`) is generally preferred — it reduces visual weight and leaves room for a center label or annotation.

Do not use a pie chart to compare more than 7–8 segments, or when the difference between slices is small (less than 5%); angular differences are harder to judge than length. Do not use it for time series or any data where absolute values matter more than proportions — use `BarChart` instead.

**Distinctive props:** `innerRadius` (0 = pie, >0 = donut), `pieTilt` (3D tilt angle in radians), `explodeSlice` (field value of slice to push outward)

```tsx
<PieChart id="share" data={marketData} innerRadius={0.45} explodeSlice="us" ...>
```

---

## When to Use ScatterPlotChart

Use a scatter plot to show the relationship between two continuous variables and identify clusters, outliers, or correlations. Adding `sizeField` encodes a third quantitative dimension as point size (bubble chart), and `colorField` adds a fourth. This is the right choice when individual data point identity and relative positioning in 2D space are both meaningful.

Do not use a scatter plot for categorical x-axis data — use `BarChart`. Avoid it when you have fewer than 10 data points; a bar chart communicates the same comparison more clearly. With more than a few hundred points, overplotting becomes a problem.

**Distinctive props:** `sizeField` (encodes point size from a data field), `colorField` (encodes point color), `pointShape` (sphere/cube/cylinder)

```tsx
<ScatterPlotChart id="perf" data={metricData} sizeField="marketCap" colorField="growth" pointShape="sphere" ...>
```

---

## When to Use HeatMapChart

Use a heatmap to show intensity or density across a two-dimensional grid. It works well for displaying patterns in a matrix of categories — day-of-week by hour, feature by version, region by product. When `timeField` is set, the heatmap animates through time-sliced frames driven by scene scroll progress.

Do not use a heatmap when exact values matter — color differences are hard to judge precisely. Use a `BarChart` or table instead when the viewer needs to read numbers, not patterns. Avoid it when one axis has more than roughly 30 categories; cells become too small to distinguish.

**Distinctive props:** `timeField` (field that drives animated frame playback), `heightField` (field that controls cell height in 3D), `colorInterpolator` (color scale: blues/reds/viridis/plasma)

```tsx
<HeatMapChart id="activity" data={gridData} timeField="week" colorInterpolator="viridis" ...>
```
