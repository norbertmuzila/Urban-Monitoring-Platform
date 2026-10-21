import "server-only";

/**
 * Ridge (L2-regularised) linear regression with feature standardisation.
 * Small, dependency-free and deterministic — trained per location on demand.
 */
export interface RidgeModel {
  intercept: number;
  coef: number[];
  mean: number[];
  std: number[];
}

/** Solves A·x = b (A square) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const p = M[col][col] || 1e-12;
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / p;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

/**
 * Weighted ridge fit. `lambda` is a fraction of the total sample weight, so the same value
 * regularises equally regardless of sample count (0.01 ≈ a 1% pull towards zero). `fitIntercept: false` shrinks the
 * intercept too (useful when the target is a correction that should default to 0).
 */
export function fitRidge(X: number[][], y: number[], lambda = 1, weights?: number[], fitIntercept = true): RidgeModel {
  const n = X.length;
  const k = X[0].length;
  const w = weights ?? new Array(n).fill(1);
  const W = w.reduce((s, v) => s + v, 0);
  const mean = Array.from({ length: k }, (_, j) => X.reduce((s, r, i) => s + w[i] * r[j], 0) / W);
  const std = Array.from({ length: k }, (_, j) => Math.sqrt(X.reduce((s, r, i) => s + w[i] * (r[j] - mean[j]) ** 2, 0) / W) || 1);
  const yMean = fitIntercept ? y.reduce((s, v, i) => s + w[i] * v, 0) / W : 0;

  // Weighted normal equations on standardised features: (ZᵀWZ + λ·ΣW·I) β = ZᵀW(y − ȳ)
  const ZtZ = Array.from({ length: k }, () => new Array(k).fill(0));
  const Zty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    const z = X[i].map((v, j) => (v - mean[j]) / std[j]);
    const yc = y[i] - yMean;
    for (let a = 0; a < k; a++) {
      Zty[a] += w[i] * z[a] * yc;
      for (let b = a; b < k; b++) ZtZ[a][b] += w[i] * z[a] * z[b];
    }
  }
  lambda *= W;
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < a; b++) ZtZ[a][b] = ZtZ[b][a];
    ZtZ[a][a] += lambda;
  }
  return { intercept: yMean, coef: solve(ZtZ, Zty), mean, std };
}

export const predictRidge = (m: RidgeModel, x: number[]) => m.intercept + x.reduce((s, v, j) => s + m.coef[j] * ((v - m.mean[j]) / m.std[j]), 0);

export const mae = (pairs: [number, number][]) => (pairs.length ? pairs.reduce((s, [a, b]) => s + Math.abs(a - b), 0) / pairs.length : NaN);

export function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
}
