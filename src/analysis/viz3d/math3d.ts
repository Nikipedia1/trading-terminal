/** Lightweight 3D projection — no Three.js. Professional isometric / perspective. */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Camera3D {
  yaw: number
  pitch: number
  zoom: number
  /** focal length relative */
  focal: number
}

const DEG = Math.PI / 180

export function project(
  p: Vec3,
  cam: Camera3D,
  cx: number,
  cy: number
): { x: number; y: number; depth: number } {
  const yaw = cam.yaw * DEG
  const pitch = cam.pitch * DEG
  // rotate Y (yaw)
  let x = p.x * Math.cos(yaw) - p.z * Math.sin(yaw)
  let z = p.x * Math.sin(yaw) + p.z * Math.cos(yaw)
  let y = p.y
  // rotate X (pitch)
  const y2 = y * Math.cos(pitch) - z * Math.sin(pitch)
  const z2 = y * Math.sin(pitch) + z * Math.cos(pitch)
  y = y2
  z = z2
  const f = cam.focal * cam.zoom
  const scale = f / (f + z + 2.2)
  return {
    x: cx + x * scale * 180 * cam.zoom,
    y: cy - y * scale * 140 * cam.zoom,
    depth: z,
  }
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** World-space box corners for a column at (tx, baseY, width, depth, height) */
export function columnCorners(
  tx: number,
  baseY: number,
  w: number,
  d: number,
  h: number
): Vec3[] {
  const x0 = tx - w / 2
  const x1 = tx + w / 2
  const z0 = -d / 2
  const z1 = d / 2
  const y0 = baseY
  const y1 = baseY + h
  return [
    { x: x0, y: y0, z: z0 },
    { x: x1, y: y0, z: z0 },
    { x: x1, y: y0, z: z1 },
    { x: x0, y: y0, z: z1 },
    { x: x0, y: y1, z: z0 },
    { x: x1, y: y1, z: z0 },
    { x: x1, y: y1, z: z1 },
    { x: x0, y: y1, z: z1 },
  ]
}
