import "server-only";
import { cacheLife } from "next/cache";
import { asUpstreamError, upstream } from "../http";
import { fitRidge, mae, predictRidge, quantile, type RidgeModel } from "./ridge";

/*
 * Background prediction models for any location on Earth, trained on demand from
 * 92 days of hourly data at that exact location and retrained hourly.
 *
 * Both models learn a CORRECTION to a strong baseline, so a model without skill falls
 * back to the baseline instead of doing harm:
 *
 *  • Temperature (MOS): baseline = the operational ECMWF/DWD "best match" forecast.
 *    One ridge model per lead day (1–3) learns this location's systematic error from
 *    archived forecasts vs. the realised hourly temperature (diurnal pattern, humidity,
 *    wind, cloud, recent bias).
 *  • PM2.5: baseline = the past week's average for each hour of the day (in log space).
 *    A direct multi-horizon (1–72 h) ridge model corrects it using current anomalies,
 *    their decay with lead time and the weather forecast for each target hour.
 *
 * Time-ordered evaluation, no look-ahead:
 *    [ train …………… ][ validation 7 d ][ test 7 d ]
 *  – validation chooses the regularisation strength, or the plain baseline if no
 *    model beats it;
 *  – the reported accuracy is measured on the final test week, which the choice never saw;
 *  – the published model is then refit on all data with recent days weighted most.
 */

const PREVIOUS_RUNS = "https://previous-runs-api.open-meteo.com/v1/forecast";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";

const HISTORY_DAYS = 92;
const WEEK = 7 * 24;
const LEADS = [1, 2, 3] as const;
const LAMBDAS = [0.001, 0.01, 0.1, 1];
/** Recency weighting: a sample 30 days old counts ~37% as much as today's. */
const DECAY_HOURS = 30 * 24;

type Series = Record<string, (number | null)[]> & { time: string[] };

export interface TemperaturePoint {
  time: string;
  forecast: number;
  predicted: number;
  lower: number;
  upper: number;
}

export interface PmPoint {
  time: string;
  cams: number | null;
  predicted: number;
  lower: number;
  upper: number;
}

export interface Prediction {
  generatedAt: string;
  timezone: string;
  temperature: {
    history: { time: string; observed: number }[];
    hours: TemperaturePoint[];
    /** Test-week errors (°C) of the raw forecast and of the published prediction. */
    verification: { lead: number; n: number; maeForecast: number; maeModel: number; method: string }[];
    trainedOn: { samples: number; from: string; to: string };
  } | null;
  pm25: {
    history: { time: string; observed: number }[];
    hours: PmPoint[];
    /** Test-week errors (µg/m³) of two baselines and of the published prediction. */
    verification: { horizon: string; n: number; maeModel: number; maePersistence: number; maeDiurnal: number }[];
    /** Which candidate won on the validation week. */
    method: string;
    trainedOn: { samples: number; from: string; to: string };
  } | null;
  sources: { label: string; url: string }[];
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const hourOf = (t: string) => Number(t.slice(11, 13));
const cyc = (h: number) => [Math.sin((2 * Math.PI * h) / 24), Math.cos((2 * Math.PI * h) / 24)];

/** Index of the last hour that is not in the future (API times are local wall-clock). */
function nowIndex(time: string[], utcOffsetSeconds: number) {
  const localNow = new Date(Date.now() + utcOffsetSeconds * 1000).toISOString().slice(0, 13);
  let idx = -1;
  for (let i = 0; i < time.length; i++) if (time[i].slice(0, 13) <= localNow) idx = i;
  return idx;
}

// --------------------------------------------------------- model selection

/** A training example: `y` is the correction to `base`; truth = base + y. `t` = target index. */
interface Sample {
  x: number[];
  y: number;
  base: number;
  t: number;
}

type Predictor = (r: Sample) => number;

const weightsFor = (rows: Sample[], ref: number) => rows.map((r) => Math.exp(-(ref - r.t) / DECAY_HOURS));
const ridgePredictor = (rows: Sample[], lambda: number, ref: number): Predictor => {
  const m: RidgeModel = fitRidge(
    rows.map((r) => r.x),
    rows.map((r) => r.y),
    lambda,
    weightsFor(rows, ref),
  );
  return (r) => r.base + predictRidge(m, r.x);
};

/** A fitted model must beat the best fixed rule by this factor on validation to be chosen. */
const MARGIN = 0.97;

/**
 * Chooses between fixed rules (the baseline, plus any `rules`) and ridge corrections with
 * different λ on the validation week, refits the winner on train+validation and returns its
 * predictions for the untouched test week, plus a final version refit on everything.
 */
function selectModel(
  rows: Sample[],
  valStart: number,
  testStart: number,
  now: number,
  loss: (truth: number, pred: number) => number,
  rules: { method: string; predict: Predictor }[] = [],
) {
  const train = rows.filter((r) => r.t < valStart);
  const val = rows.filter((r) => r.t >= valStart && r.t < testStart);
  const test = rows.filter((r) => r.t >= testStart);
  if (train.length < 200 || val.length < 24 || test.length < 24) return null;

  const valLoss = (f: Predictor) => val.reduce((s, r) => s + loss(r.base + r.y, f(r)), 0) / val.length;
  const fixed = [{ method: "baseline", predict: (r: Sample) => r.base }, ...rules].map((c) => ({ ...c, loss: valLoss(c.predict) }));
  const bestFixed = fixed.reduce((a, b) => (b.loss < a.loss ? b : a));
  let best: { method: string; lambda: number | null; loss: number; predict?: Predictor } = { ...bestFixed, lambda: null };
  const fixedBest = bestFixed.loss;
  for (const lambda of LAMBDAS) {
    const l = valLoss(ridgePredictor(train, lambda, valStart));
    if (l < best.loss && l < fixedBest * MARGIN) best = { method: "learned correction", lambda, loss: l };
  }

  const pre = [...train, ...val];
  const evalPredict = best.lambda == null ? best.predict! : ridgePredictor(pre, best.lambda, testStart);
  const finalPredict = best.lambda == null ? best.predict! : ridgePredictor(rows, best.lambda, now);
  return { test, evalPredict, finalPredict, method: best.method, samples: rows.length };
}

// ---------------------------------------------------------------- temperature

function trainTemperature(h: Series, utcOffset: number): Prediction["temperature"] {
  const t = h.time;
  const now = nowIndex(t, utcOffset);
  const actual = h.temperature_2m;
  if (now < 24 * 40) return null;
  const valStart = now - 2 * WEEK + 1;
  const testStart = now - WEEK + 1;

  // Rolling 72 h bias of the day-1 forecast, known at issue time.
  const err1 = t.map((_, i) => (num(actual[i]) && num(h.temperature_2m_previous_day1[i]) ? actual[i]! - h.temperature_2m_previous_day1[i]! : null));
  const biasBefore = (i: number) => {
    const w = err1.slice(Math.max(0, i - 72), i).filter(num);
    return w.length >= 24 ? w.reduce((s, v) => s + v, 0) / w.length : 0;
  };
  const features = (rh: number, wind: number, cloud: number, hour: number, bias: number) => [...cyc(hour), rh / 100, Math.log1p(wind), cloud / 100, bias];

  const verification: NonNullable<Prediction["temperature"]>["verification"] = [];
  const published = new Map<number, { predict: Predictor; residuals: number[] }>();
  let samples = 0;

  for (const d of LEADS) {
    const rows: Sample[] = [];
    for (let i = 72 + d * 24; i <= now; i++) {
      const fc = h[`temperature_2m_previous_day${d}`][i];
      const rh = h[`relative_humidity_2m_previous_day${d}`][i];
      const wind = h[`wind_speed_10m_previous_day${d}`][i];
      const cloud = h[`cloud_cover_previous_day${d}`][i];
      if (![actual[i], fc, rh, wind, cloud].every(num)) continue;
      rows.push({ x: features(rh!, wind!, cloud!, hourOf(t[i]), biasBefore(i - d * 24)), y: actual[i]! - fc!, base: fc!, t: i });
    }
    const sel = selectModel(rows, valStart, testStart, now, (a, b) => Math.abs(a - b), [
      // Raw forecast shifted by its recent 72 h bias (last feature).
      { method: "bias-adjusted forecast", predict: (r) => r.base + r.x[r.x.length - 1] },
    ]);
    if (!sel) continue;
    const testPairs = sel.test.map((r) => [r.base + r.y, sel.evalPredict(r)] as [number, number]);
    verification.push({
      lead: d,
      n: sel.test.length,
      maeForecast: round(mae(sel.test.map((r) => [r.base + r.y, r.base])), 2),
      maeModel: round(mae(testPairs), 2),
      method: sel.method,
    });
    published.set(d, { predict: sel.finalPredict, residuals: testPairs.map(([a, b]) => a - b) });
    samples += sel.samples;
  }
  if (!published.size) return null;

  const biasNow = biasBefore(now + 1);
  const hours: TemperaturePoint[] = [];
  for (let i = now + 1; i < t.length && i <= now + 72; i++) {
    const lead = Math.min(3, Math.ceil((i - now) / 24));
    const p = published.get(lead) ?? published.get(1)!;
    const [fc, rh, wind, cloud] = [h.temperature_2m[i], h.relative_humidity_2m[i], h.wind_speed_10m[i], h.cloud_cover[i]];
    if (![fc, rh, wind, cloud].every(num)) continue;
    const pred = p.predict({ x: features(rh!, wind!, cloud!, hourOf(t[i]), biasNow), y: 0, base: fc!, t: i });
    hours.push({ time: t[i], forecast: round(fc!), predicted: round(pred), lower: round(pred + quantile(p.residuals, 0.1)), upper: round(pred + quantile(p.residuals, 0.9)) });
  }

  return {
    history: t
      .slice(Math.max(0, now - 47), now + 1)
      .map((time, k) => ({ time, observed: actual[Math.max(0, now - 47) + k] }))
      .filter((p): p is { time: string; observed: number } => num(p.observed)),
    hours,
    verification,
    trainedOn: { samples, from: t[0], to: t[now] },
  };
}

// --------------------------------------------------------------------- PM2.5

const ln = (v: number) => Math.log(Math.max(v, 0) + 1);
const unln = (v: number) => Math.max(0, Math.exp(v) - 1);

type Weather = { rh: number; wind: number; rain: number };

function trainPm25(aq: Series, wx: Map<string, Weather>, utcOffset: number): Prediction["pm25"] {
  const t = aq.time;
  const pm = aq.pm2_5;
  const now = nowIndex(t, utcOffset);
  if (now < 24 * 40) return null;
  const valStart = now - 2 * WEEK + 1;
  const testStart = now - WEEK + 1;

  const lp = pm.map((v) => (num(v) ? ln(v) : null));
  /** Mean log PM2.5 at a given hour of day over the 7 days up to origin o. */
  const profile = (o: number, hour: number) => {
    let s = 0;
    let n = 0;
    for (let i = Math.max(0, o - 167); i <= o; i++) {
      if (hourOf(t[i]) === hour && num(lp[i])) {
        s += lp[i]!;
        n++;
      }
    }
    return n ? s / n : null;
  };
  const mean = (from: number, to: number) => {
    const w = lp.slice(Math.max(0, from), to).filter(num);
    return w.length ? w.reduce((s, v) => s + v, 0) / w.length : null;
  };

  /** Features for predicting target hour `tg` from origin `o`, relative to the diurnal baseline. */
  const sampleFor = (o: number, tg: number): Omit<Sample, "y" | "t"> | null => {
    const y0 = lp[o];
    const prof0 = profile(o, hourOf(t[o]));
    const base = profile(o, hourOf(t[tg]));
    const m24 = mean(o - 23, o + 1);
    const m7d = mean(o - 167, o + 1);
    const w = wx.get(t[tg]);
    if (![y0, prof0, base, m24, m7d].every(num) || !w) return null;
    const hz = tg - o;
    const decay = Math.exp(-hz / 18);
    const anomaly = y0! - prof0!;
    return {
      x: [anomaly * decay, anomaly, (m24! - m7d!) * (1 - decay), (m24! - m7d!), hz / 72, Math.log1p(w.wind), w.rh / 100, Math.log1p(w.rain), ...cyc(hourOf(t[tg]))],
      base: base!,
    };
  };

  const rows: (Sample & { o: number })[] = [];
  for (let o = 168; o < now; o += 3) {
    for (let hz = 1; hz <= 72 && o + hz <= now; hz++) {
      const tg = o + hz;
      const s = sampleFor(o, tg);
      if (!s || !num(lp[tg])) continue;
      rows.push({ ...s, y: lp[tg]! - s.base, t: tg, o });
    }
  }
  // Validation/test samples must also originate inside their window.
  const usable = rows.filter((r) => (r.t < valStart ? true : r.t < testStart ? r.o >= valStart : r.o >= testStart));
  const sel = selectModel(usable, valStart, testStart, now, (a, b) => Math.abs(unln(a) - unln(b)), [
    // Current anomaly decaying towards the daily cycle (first feature = anomaly × decay).
    { method: "damped persistence", predict: (r) => r.base + r.x[0] },
  ]);
  if (!sel) return null;

  const buckets = [
    { horizon: "1–24 h", min: 1, max: 24 },
    { horizon: "25–48 h", min: 25, max: 48 },
    { horizon: "49–72 h", min: 49, max: 72 },
  ];
  const testRows = sel.test as (Sample & { o: number })[];
  const residuals = new Map<string, number[]>();
  const verification = buckets.map((b) => {
    const sub = testRows.filter((r) => r.t - r.o >= b.min && r.t - r.o <= b.max);
    const pairs = sub.map((r) => [unln(r.base + r.y), unln(sel.evalPredict(r))] as [number, number]);
    residuals.set(b.horizon, pairs.map(([a, p]) => a - p));
    return {
      horizon: b.horizon,
      n: sub.length,
      maeModel: round(mae(pairs), 2),
      maePersistence: round(mae(sub.map((r) => [unln(r.base + r.y), unln(lp[r.o]!)])), 2),
      maeDiurnal: round(mae(sub.map((r) => [unln(r.base + r.y), unln(r.base)])), 2),
    };
  });

  const hours: PmPoint[] = [];
  for (let tg = now + 1; tg < t.length && tg <= now + 72; tg++) {
    const s = sampleFor(now, tg);
    if (!s) continue;
    const p = unln(sel.finalPredict({ ...s, y: 0, t: tg }));
    const res = residuals.get(buckets.find((b) => tg - now <= b.max)!.horizon) ?? [0];
    hours.push({
      time: t[tg],
      cams: num(pm[tg]) ? round(pm[tg]!) : null,
      predicted: round(p),
      lower: round(Math.max(0, p + quantile(res, 0.1))),
      upper: round(p + quantile(res, 0.9)),
    });
  }

  return {
    history: t
      .slice(Math.max(0, now - 47), now + 1)
      .map((time, k) => ({ time, observed: pm[Math.max(0, now - 47) + k] }))
      .filter((p): p is { time: string; observed: number } => num(p.observed)),
    hours,
    verification,
    method: sel.method,
    trainedOn: { samples: sel.samples, from: t[0], to: t[now] },
  };
}

// --------------------------------------------------------------------- entry

type ApiResponse = { hourly: Series; timezone: string; utc_offset_seconds: number };

export function predictionSourceUrls(lat: string, lng: string) {
  const loc = `latitude=${lat}&longitude=${lng}&timezone=auto`;
  const prevVars = LEADS.flatMap((d) => [
    `temperature_2m_previous_day${d}`,
    `relative_humidity_2m_previous_day${d}`,
    `wind_speed_10m_previous_day${d}`,
    `cloud_cover_previous_day${d}`,
  ]).join(",");
  return {
    previousRuns: `${PREVIOUS_RUNS}?${loc}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,${prevVars}&past_days=${HISTORY_DAYS}&forecast_days=4`,
    weather: `${FORECAST}?${loc}&hourly=relative_humidity_2m,wind_speed_10m,precipitation&past_days=${HISTORY_DAYS}&forecast_days=4`,
    air: `${AIR}?${loc}&hourly=pm2_5&past_days=${HISTORY_DAYS}&forecast_days=4`,
  };
}

/** Trains both models for a location and returns 72 h predictions with verification. */
export async function predictLocation(lat: string, lng: string): Promise<Prediction> {
  "use cache";
  // Forecast runs update every few hours: retrain hourly in the background.
  cacheLife({ stale: 900, revalidate: 3600, expire: 21600 });

  const urls = predictionSourceUrls(lat, lng);
  const [prev, weather, air] = await Promise.allSettled([
    upstream<ApiResponse>(urls.previousRuns, { label: "Open-Meteo previous runs", timeoutMs: 20_000 }),
    upstream<ApiResponse>(urls.weather, { label: "Open-Meteo forecast", timeoutMs: 20_000 }),
    upstream<ApiResponse>(urls.air, { label: "Open-Meteo air quality", timeoutMs: 20_000 }),
  ]);
  // Never cache a model trained on partial inputs: fail (uncached) and let the client retry.
  for (const r of [prev, weather, air]) if (r.status === "rejected") throw asUpstreamError(r.reason, "Prediction inputs");

  const temperature = prev.status === "fulfilled" ? trainTemperature(prev.value.hourly, prev.value.utc_offset_seconds) : null;

  let pm25: Prediction["pm25"] = null;
  if (air.status === "fulfilled" && weather.status === "fulfilled") {
    const w = weather.value.hourly;
    const wx = new Map<string, Weather>();
    w.time.forEach((time, i) => {
      const [rh, wind, rain] = [w.relative_humidity_2m[i], w.wind_speed_10m[i], w.precipitation[i]];
      if ([rh, wind, rain].every(num)) wx.set(time, { rh: rh!, wind: wind!, rain: rain! });
    });
    pm25 = trainPm25(air.value.hourly, wx, air.value.utc_offset_seconds);
  }

  const tz = prev.status === "fulfilled" ? prev.value.timezone : air.status === "fulfilled" ? air.value.timezone : "UTC";
  return {
    generatedAt: new Date().toISOString(),
    timezone: tz,
    temperature,
    pm25,
    sources: [
      { label: "Archived forecasts & realised temperature (Open-Meteo previous runs)", url: urls.previousRuns },
      { label: "Weather history & forecast (Open-Meteo)", url: urls.weather },
      { label: "PM2.5 history & CAMS forecast (Open-Meteo air quality)", url: urls.air },
    ],
  };
}
