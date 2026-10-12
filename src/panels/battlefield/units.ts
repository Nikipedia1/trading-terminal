/** Battlefield unit models, stats and combat helpers. */
import * as THREE from 'three'

export type UnitKind =
  | 'infantry'
  | 'tank'
  | 'heavy'
  | 'sniper'
  | 'cavalry'
  | 'artillery'
  | 'drone'
  | 'shield'

export interface UnitStats {
  hp: number
  speed: number
  damage: number
  range: number
  radius: number
  cooldown: number
}

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  infantry: { hp: 1.4, speed: 0.055, damage: 0.06, range: 0.9, radius: 0.35, cooldown: 18 },
  tank: { hp: 3.2, speed: 0.038, damage: 0.14, range: 1.4, radius: 0.55, cooldown: 28 },
  heavy: { hp: 5.5, speed: 0.028, damage: 0.22, range: 1.7, radius: 0.7, cooldown: 36 },
  sniper: { hp: 1.0, speed: 0.042, damage: 0.28, range: 3.8, radius: 0.3, cooldown: 55 },
  cavalry: { hp: 1.8, speed: 0.09, damage: 0.1, range: 0.85, radius: 0.4, cooldown: 16 },
  artillery: { hp: 2.4, speed: 0.022, damage: 0.35, range: 4.5, radius: 0.6, cooldown: 70 },
  drone: { hp: 0.8, speed: 0.1, damage: 0.08, range: 1.6, radius: 0.28, cooldown: 14 },
  shield: { hp: 6.5, speed: 0.025, damage: 0.04, range: 0.7, radius: 0.75, cooldown: 22 },
}

export interface Unit {
  id: number
  side: 'bull' | 'bear'
  root: THREE.Group
  vx: number
  vz: number
  hp: number
  maxHp: number
  kind: UnitKind
  age: number
  cd: number
  targetId: number | null
}

export interface Projectile {
  mesh: THREE.Mesh
  vx: number
  vz: number
  life: number
  damage: number
  side: 'bull' | 'bear'
  radius: number
}

export interface FxBurst {
  mesh: THREE.Mesh
  life: number
  maxLife: number
}

export function kindFromNotional(notional: number): UnitKind {
  if (notional > 400_000) return 'heavy'
  if (notional > 180_000) return 'artillery'
  if (notional > 100_000) return 'tank'
  if (notional > 60_000) return 'shield'
  if (notional > 35_000) return 'cavalry'
  if (notional > 20_000) return 'sniper'
  if (notional > 12_000) return 'drone'
  return 'infantry'
}

export function makeUnitModel(side: 'bull' | 'bear', kind: UnitKind): THREE.Group {
  const g = new THREE.Group()
  const col = side === 'bull' ? 0x0ecb81 : 0xf6465d
  const dark = side === 'bull' ? 0x064d32 : 0x5a1018
  const bodyMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: dark,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.35,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf0b90b,
    emissive: 0xf0b90b,
    emissiveIntensity: 0.25,
    roughness: 0.4,
    metalness: 0.5,
  })
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1a2228,
    roughness: 0.55,
    metalness: 0.6,
  })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88ccee,
    emissive: 0x224466,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
  })

  if (kind === 'infantry') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.35, 4, 8), bodyMat)
    body.position.y = 0.45
    body.castShadow = true
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bodyMat)
    head.position.y = 0.85
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), accentMat)
    visor.position.set(0, 0.88, 0.12)
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), armorMat)
    rifle.position.set(0.22, 0.5, 0.15)
    g.add(body, head, visor, rifle)
  } else if (kind === 'tank') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 1.05), bodyMat)
    hull.position.y = 0.28
    hull.castShadow = true
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.5), armorMat)
    cabin.position.y = 0.5
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8), accentMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.5, 0.55)
    const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 1.1), armorMat)
    trackL.position.set(-0.38, 0.12, 0)
    const trackR = trackL.clone()
    trackR.position.x = 0.38
    g.add(hull, cabin, barrel, trackL, trackR)
  } else if (kind === 'heavy') {
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42), bodyMat)
    core.position.y = 0.7
    core.castShadow = true
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), armorMat)
    plate.position.y = 0.35
    const tower = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 6), accentMat)
    tower.position.y = 1.15
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6), armorMat)
    leg1.position.set(-0.28, 0.2, -0.2)
    const leg2 = leg1.clone()
    leg2.position.set(0.28, 0.2, -0.2)
    const leg3 = leg1.clone()
    leg3.position.set(0, 0.2, 0.32)
    g.add(core, plate, tower, leg1, leg2, leg3)
  } else if (kind === 'sniper') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 4, 8), bodyMat)
    body.position.y = 0.5
    body.castShadow = true
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), bodyMat)
    head.position.y = 0.92
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), glassMat)
    scope.rotation.x = Math.PI / 2
    scope.position.set(0.12, 0.95, 0.12)
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.85), armorMat)
    rifle.position.set(0.18, 0.55, 0.25)
    const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.04), accentMat)
    bipod.position.set(0.18, 0.35, 0.45)
    g.add(body, head, scope, rifle, bipod)
  } else if (kind === 'cavalry') {
    const horse = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), bodyMat)
    horse.rotation.z = Math.PI / 2
    horse.position.set(0, 0.4, 0)
    horse.castShadow = true
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.35, 8), bodyMat)
    neck.position.set(0, 0.55, 0.35)
    neck.rotation.x = -0.5
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.22, 4, 6), armorMat)
    rider.position.set(0, 0.75, 0)
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.22), accentMat)
    flag.position.set(-0.2, 0.95, -0.1)
    g.add(horse, neck, rider, flag)
  } else if (kind === 'artillery') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.2, 10), armorMat)
    base.position.y = 0.12
    base.castShadow = true
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.7), bodyMat)
    carriage.position.y = 0.32
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 10), accentMat)
    tube.rotation.x = Math.PI / 2.4
    tube.position.set(0, 0.55, 0.35)
    const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), armorMat)
    wheelL.rotation.z = Math.PI / 2
    wheelL.position.set(-0.35, 0.18, 0)
    const wheelR = wheelL.clone()
    wheelR.position.x = 0.35
    g.add(base, carriage, tube, wheelL, wheelR)
  } else if (kind === 'drone') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), bodyMat)
    body.position.y = 0.9
    body.castShadow = true
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 16), accentMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.9
    for (const [ox, oz] of [
      [0.28, 0.28],
      [0.28, -0.28],
      [-0.28, 0.28],
      [-0.28, -0.28],
    ] as const) {
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.04), glassMat)
      rotor.position.set(ox, 0.95, oz)
      g.add(rotor)
    }
    g.add(body, ring)
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.7, 8), bodyMat)
    body.position.y = 0.4
    body.castShadow = true
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      glassMat
    )
    dome.position.y = 0.75
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.08), armorMat)
    plate.position.set(0, 0.45, 0.35)
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), accentMat)
    emblem.position.set(0, 0.5, 0.4)
    g.add(body, dome, plate, emblem)
  }

  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false })
  )
  hpBg.position.y = 1.45
  hpBg.name = 'hpBg'
  const hpFg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.04),
    new THREE.MeshBasicMaterial({ color: col, depthTest: false })
  )
  hpFg.position.y = 1.45
  hpFg.position.z = 0.01
  hpFg.name = 'hpFg'
  g.add(hpBg, hpFg)
  return g
}

export function updateHpBar(u: Unit) {
  const fg = u.root.getObjectByName('hpFg') as THREE.Mesh | undefined
  if (!fg) return
  const ratio = Math.max(0, Math.min(1, u.hp / u.maxHp))
  fg.scale.x = Math.max(0.05, ratio)
  fg.position.x = -0.28 * (1 - ratio)
}

export function spawnProjectile(
  scene: THREE.Scene,
  projectiles: Projectile[],
  from: Unit,
  toX: number,
  toZ: number,
  damage: number,
  speed: number,
  color: number,
  size = 0.08
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  )
  mesh.position.copy(from.root.position)
  mesh.position.y = from.kind === 'drone' ? 1.0 : 0.55
  scene.add(mesh)
  const dx = toX - from.root.position.x
  const dz = toZ - from.root.position.z
  const len = Math.hypot(dx, dz) || 1
  projectiles.push({
    mesh,
    vx: (dx / len) * speed,
    vz: (dz / len) * speed,
    life: 90,
    damage,
    side: from.side,
    radius: size * 2.5,
  })
}

export function spawnBurst(
  scene: THREE.Scene,
  bursts: FxBurst[],
  x: number,
  y: number,
  z: number,
  color: number
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  )
  mesh.position.set(x, y, z)
  scene.add(mesh)
  bursts.push({ mesh, life: 20, maxLife: 20 })
}
