/**
 * Analog stick input pipeline, tuned for cheap / drift-prone controllers.
 *
 * Pipeline: raw axes -> radial deadzone (with rescale) -> EMA low-pass filter
 * -> optional response curve. All stages are stateless except the filter.
 */

export interface StickSettings {
  /** Radial deadzone radius, 0..0.5. Cheap sticks drift, so default is generous. */
  deadzone: number
  /** Low-pass filter time constant in ms. Higher = smoother but laggier. */
  smoothing: number
  /** Response curve exponent. >1 gives fine control near center. */
  curve: number
}

export const DEFAULT_STICK_SETTINGS: StickSettings = {
  deadzone: 0.22,
  smoothing: 45,
  curve: 1.7,
}

export interface StickSample {
  x: number
  y: number
  /** Filtered magnitude 0..1 */
  mag: number
  /** atan2(y, x) of the filtered vector; only meaningful when mag > 0 */
  angle: number
}

/**
 * Radial (circular) deadzone with magnitude rescaling.
 * Unlike per-axis deadzones, this keeps diagonals accurate and remaps the
 * remaining range to a full 0..1 so there is no dead ramp after the edge.
 */
export function applyRadialDeadzone(
  x: number,
  y: number,
  deadzone: number,
): { x: number; y: number } {
  const mag = Math.hypot(x, y)
  if (mag <= deadzone) return { x: 0, y: 0 }
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone))
  return { x: (x / mag) * scaled, y: (y / mag) * scaled }
}

/** Shortest signed angular difference from a to b, in (-PI, PI]. */
export function shortestAngleDelta(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

/**
 * Stateful exponential moving average filter for a stick vector.
 * Frame-rate independent: alpha is derived from dt and the time constant.
 */
export class StickFilter {
  private fx = 0
  private fy = 0

  reset() {
    this.fx = 0
    this.fy = 0
  }

  update(rawX: number, rawY: number, dtMs: number, settings: StickSettings): StickSample {
    const dz = applyRadialDeadzone(rawX, rawY, settings.deadzone)
    const tau = Math.max(1, settings.smoothing)
    const alpha = 1 - Math.exp(-dtMs / tau)
    this.fx += (dz.x - this.fx) * alpha
    this.fy += (dz.y - this.fy) * alpha

    // Snap residual noise to true zero so a released stick never drifts.
    if (Math.hypot(this.fx, this.fy) < 0.008) {
      this.fx = 0
      this.fy = 0
    }

    const mag = Math.min(1, Math.hypot(this.fx, this.fy))
    return {
      x: this.fx,
      y: this.fy,
      mag,
      angle: Math.atan2(this.fy, this.fx),
    }
  }
}

/** Response curve: preserves direction, curves magnitude. */
export function applyCurve(sample: StickSample, exponent: number): StickSample {
  if (sample.mag === 0) return sample
  const curved = Math.pow(sample.mag, exponent)
  const scale = curved / sample.mag
  return { ...sample, x: sample.x * scale, y: sample.y * scale, mag: curved }
}
