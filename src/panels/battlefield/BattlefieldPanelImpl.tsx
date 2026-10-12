/**
 * Battlefield 3D — dual-territory arena, depth mountains, live combat units.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useMarketStore } from '@/stores/marketStore'
import { DepthMountains2D } from './DepthMountains2D'
import {
  type Unit,
  type UnitKind,
  UNIT_STATS,
  kindFromNotional,
  makeUnitModel,
  updateHpBar,
} from './units'

interface FeedItem {
  id: string
  text: string
  side: 'bull' | 'bear' | 'liq'
  time: number
}

function sumNotional(
  levels: { price: number; qty: number }[] | undefined,
  n: number
): number {
  if (!levels?.length) return 0
  let s = 0
  for (let i = 0; i < Math.min(n, levels.length); i++) {
    s += levels[i]!.price * levels[i]!.qty
  }
  return s
}

function fmtM(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function groundNoise(x: number, z: number): number {
  return (
    Math.sin(x * 0.28 + z * 0.19) * 0.14 +
    Math.sin(x * 0.75 - z * 0.48) * 0.07 +
    Math.sin(x * 1.4 + z * 1.1) * 0.03 +
    Math.cos(x * 0.15 - z * 0.35) * 0.05
  )
}

function makeTree(scale = 1, leafColor = 0x1b5e36): THREE.Group {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.14 * scale, 0.85 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x3d2a1a, roughness: 0.95 })
  )
  trunk.position.y = 0.42 * scale
  trunk.castShadow = true
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.48 * scale, 0.95 * scale, 8),
    new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.78 })
  )
  cone.position.y = 1.15 * scale
  cone.castShadow = true
  g.add(trunk, cone)
  return g
}

function makeRock(scale = 1, color = 0x4a4f55): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.35 * scale, 0),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })
  )
  m.position.y = 0.2 * scale
  m.castShadow = true
  return m
}

export function BattlefieldPanel() {
  const orderBook = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const ticker = useMarketStore((s) => s.ticker)
  const symbol = useMarketStore((s) => s.symbol)

  const mountRef = useRef<HTMLDivElement>(null)
  const unitsRef = useRef<Unit[]>([])
  const feedRef = useRef<FeedItem[]>([])
  const lastTradeId = useRef('')
  const uid = useRef(1)
  const buySRef = useRef(0.5)
  const sellSRef = useRef(0.5)
  const [feedTick, setFeedTick] = useState(0)
  const [hint, setHint] = useState(true)
  const [showMountains, setShowMountains] = useState(true)
  const showMountainsRef = useRef(true)
  showMountainsRef.current = showMountains

  const orderBookLive = useRef(orderBook)
  orderBookLive.current = orderBook
  const spawnQueue = useRef<{ side: 'bull' | 'bear'; kind: UnitKind; hp: number }[]>([])

  const walls = useMemo(() => {
    const buy = sumNotional(orderBook?.bids, 25)
    const sell = sumNotional(orderBook?.asks, 25)
    const tot = buy + sell || 1
    buySRef.current = buy / tot
    sellSRef.current = sell / tot
    return { buy, sell }
  }, [orderBook])

  const price = ticker?.lastPrice ?? orderBook?.bids?.[0]?.price ?? 0
  const chg = ticker?.priceChangePercent ?? 0
  const contested =
    walls.buy > walls.sell * 1.15
      ? 'BULLS ADVANCING'
      : walls.sell > walls.buy * 1.15
        ? 'BEARS ADVANCING'
        : 'CONTESTED'

  useEffect(() => {
    if (!trades.length) return
    for (const tr of trades.slice(0, 16)) {
      if (tr.id === lastTradeId.current) break
      const notional = tr.price * tr.qty
      if (notional < 8_000) continue
      const bull = !tr.isBuyerMaker
      const kind = kindFromNotional(notional)
      feedRef.current = [
        {
          id: `${tr.id}-${Date.now()}`,
          text: `${bull ? 'BULL' : 'BEAR'} ${kind.toUpperCase()} · $${(notional / 1000).toFixed(1)}k @ ${tr.price.toFixed(2)}`,
          side: bull ? 'bull' : 'bear',
          time: Date.now(),
        },
        ...feedRef.current,
      ].slice(0, 24)
      setFeedTick((t) => t + 1)
      spawnQueue.current.push({ side: bull ? 'bull' : 'bear', kind, hp: UNIT_STATS[kind].hp })
    }
    if (trades[0]) lastTradeId.current = trades[0].id
  }, [trades])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w0 = mount.clientWidth || 640
    const h0 = mount.clientHeight || 360

    const scene = new THREE.Scene()
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 4
    skyCanvas.height = 256
    {
      const ctx = skyCanvas.getContext('2d')!
      const grd = ctx.createLinearGradient(0, 0, 0, 256)
      grd.addColorStop(0, '#070b14')
      grd.addColorStop(0.4, '#101820')
      grd.addColorStop(0.75, '#1a1418')
      grd.addColorStop(1, '#0c1012')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, 4, 256)
    }
    scene.background = new THREE.CanvasTexture(skyCanvas)
    scene.fog = new THREE.FogExp2(0x0c1014, 0.012)

    const camera = new THREE.PerspectiveCamera(46, w0 / h0, 0.1, 260)
    camera.position.set(0, 16, 28)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 1, 0)
    controls.maxPolarAngle = Math.PI * 0.48
    controls.minDistance = 12
    controls.maxDistance = 55

    const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x1a2820, 0.7)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.35)
    sun.position.set(12, 30, 14)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)
    const redRim = new THREE.PointLight(0xf6465d, 1.2, 40)
    redRim.position.set(14, 6, 0)
    scene.add(redRim)
    const greenRim = new THREE.PointLight(0x0ecb81, 1.2, 40)
    greenRim.position.set(-14, 6, 0)
    scene.add(greenRim)

    const makeHalf = (side: 'bull' | 'bear') => {
      const geo = new THREE.PlaneGeometry(22, 36, 32, 36)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const z = pos.getY(i)
        const wx = side === 'bull' ? x - 11 : x + 11
        pos.setZ(i, groundNoise(wx, z))
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
      const mat = new THREE.MeshStandardMaterial({
        color: side === 'bull' ? 0x0d3d28 : 0x3d1218,
        roughness: 0.92,
        metalness: 0.05,
        emissive: side === 'bull' ? 0x042818 : 0x280810,
        emissiveIntensity: 0.25,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.x = side === 'bull' ? -11 : 11
      mesh.receiveShadow = true
      return mesh
    }
    scene.add(makeHalf('bull'), makeHalf('bear'))

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.1, 30),
      new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.85, metalness: 0.15 })
    )
    road.position.y = 0.06
    road.receiveShadow = true
    scene.add(road)
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xf0b90b,
      emissive: 0xf0b90b,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    })
    for (let i = -13; i <= 13; i += 2) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.9), dashMat)
      dash.position.set(0, 0.12, i)
      scene.add(dash)
    }
    for (const sx of [-1.55, 1.55]) {
      const sh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.06, 30),
        new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.95 })
      )
      sh.position.set(sx, 0.05, 0)
      scene.add(sh)
    }

    const borderGeo = new THREE.BoxGeometry(0.08, 0.04, 30)
    const greenBorder = new THREE.Mesh(
      borderGeo,
      new THREE.MeshStandardMaterial({ color: 0x0ecb81, emissive: 0x0ecb81, emissiveIntensity: 0.6 })
    )
    greenBorder.position.set(-1.4, 0.1, 0)
    const redBorder = new THREE.Mesh(
      borderGeo.clone(),
      new THREE.MeshStandardMaterial({ color: 0xf6465d, emissive: 0xf6465d, emissiveIntensity: 0.6 })
    )
    redBorder.position.set(1.4, 0.1, 0)
    scene.add(greenBorder, redBorder)

    const decor = new THREE.Group()
    scene.add(decor)
    const treeSpots: [number, number, number, number][] = [
      [-14, 8, 1.1, 0x1b5e36], [-16, -6, 1.2, 0x247a42], [-12, 11, 0.95, 0x145c2e],
      [-15, 2, 1.0, 0x1b5e36], [-13, -10, 1.1, 0x2d8a4e], [-17, 4, 0.9, 0x1b5e36],
      [14, 7, 1.1, 0x5a2030], [16, -5, 1.2, 0x6b2838], [12, 10, 0.95, 0x4a1828],
      [15, -9, 1.1, 0x5a2030], [13, 2, 1.0, 0x6b2838], [17, -2, 0.9, 0x4a1828],
    ]
    for (const [x, z, sc, col] of treeSpots) {
      const tree = makeTree(sc, col)
      tree.position.set(x, groundNoise(x, z), z)
      decor.add(tree)
    }
    for (const [x, z, sc] of [
      [-6, 5, 1.0], [-7, -7, 0.9], [6, 6, 1.0], [7, -5, 0.85], [-5, 10, 0.7], [5, -10, 0.75],
    ] as const) {
      const rock = makeRock(sc, x < 0 ? 0x3a5548 : 0x553a42)
      rock.position.set(x, groundNoise(x, z), z)
      decor.add(rock)
    }

    const mountainGroup = new THREE.Group()
    scene.add(mountainGroup)
    const wallGroup = new THREE.Group()
    scene.add(wallGroup)

    const rebuildMountains = () => {
      while (mountainGroup.children.length) {
        const c = mountainGroup.children.pop()!
        if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose()
        mountainGroup.remove(c)
      }
      if (!showMountainsRef.current) return
      const bids = orderBookLive.current?.bids ?? []
      const asks = orderBookLive.current?.asks ?? []
      const maxQ = Math.max(
        ...bids.slice(0, 14).map((l) => l.qty),
        ...asks.slice(0, 14).map((l) => l.qty),
        0.0001
      )
      const buildRidge = (levels: { qty: number }[], side: 'bull' | 'bear') => {
        const n = Math.min(14, levels.length)
        if (n < 2) return
        const shape = new THREE.Shape()
        shape.moveTo(0, 0)
        for (let i = 0; i < n; i++) {
          const h = 0.4 + (levels[i]!.qty / maxQ) * 8
          shape.lineTo(2 + i * 0.85, h)
        }
        shape.lineTo(2 + (n - 1) * 0.85, 0)
        shape.lineTo(0, 0)
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 4.5,
          bevelEnabled: true,
          bevelThickness: 0.15,
          bevelSize: 0.12,
          bevelSegments: 2,
        })
        const mat = new THREE.MeshStandardMaterial({
          color: side === 'bull' ? 0x12d992 : 0xff5568,
          emissive: side === 'bull' ? 0x0a5c3a : 0x5c1018,
          emissiveIntensity: 0.35,
          roughness: 0.3,
          metalness: 0.35,
          transparent: true,
          opacity: 0.9,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (side === 'bull') {
          mesh.rotation.y = Math.PI / 2
          mesh.position.set(-8, 0.05, -6)
        } else {
          mesh.rotation.y = -Math.PI / 2
          mesh.position.set(8, 0.05, 6)
        }
        mountainGroup.add(mesh)
        const peakH = 0.4 + (levels[0]!.qty / maxQ) * 8
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: side === 'bull' ? 0x0ecb81 : 0xf6465d,
            emissiveIntensity: 1.4,
          })
        )
        if (side === 'bull') beacon.position.set(-10.5, peakH + 0.5, -3.5)
        else beacon.position.set(10.5, peakH + 0.5, 3.5)
        mountainGroup.add(beacon)
      }
      buildRidge(bids, 'bull')
      buildRidge(asks, 'bear')
    }

    const rebuildWalls = () => {
      while (wallGroup.children.length) {
        const c = wallGroup.children.pop()!
        if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose()
        wallGroup.remove(c)
      }
      const bids = orderBookLive.current?.bids ?? []
      const asks = orderBookLive.current?.asks ?? []
      const maxQ = Math.max(
        ...bids.slice(0, 12).map((l) => l.qty),
        ...asks.slice(0, 12).map((l) => l.qty),
        0.0001
      )
      const place = (levels: { qty: number }[], side: 'bull' | 'bear') => {
        levels.slice(0, 12).forEach((l, i) => {
          const h = 0.5 + (l.qty / maxQ) * 3.5
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, h, 0.55),
            new THREE.MeshStandardMaterial({
              color: side === 'bull' ? 0x12d18a : 0xff4d63,
              emissive: side === 'bull' ? 0x064d32 : 0x4a1018,
              emissiveIntensity: 0.28,
              roughness: 0.4,
              metalness: 0.3,
              transparent: true,
              opacity: 0.8,
            })
          )
          const x = side === 'bull' ? -3.5 - i * 0.65 : 3.5 + i * 0.65
          mesh.position.set(x, h / 2 + 0.05, -9 + (i % 4) * 0.4)
          mesh.castShadow = true
          wallGroup.add(mesh)
        })
      }
      place(bids, 'bull')
      place(asks, 'bear')
    }

    rebuildMountains()
    rebuildWalls()

    function spawnUnit(side: 'bull' | 'bear', kind: UnitKind, hp: number) {
      if (unitsRef.current.length > 80) return
      const stats = UNIT_STATS[kind]
      const root = makeUnitModel(side, kind)
      const lane = (Math.random() - 0.5) * 14
      const x = side === 'bull' ? -15 - Math.random() * 2 : 15 + Math.random() * 2
      root.position.set(x, 0.05, lane)
      root.scale.setScalar(1.35)
      scene.add(root)
      unitsRef.current.push({
        id: uid.current++,
        side,
        root,
        vx: side === 'bull' ? stats.speed : -stats.speed,
        vz: (Math.random() - 0.5) * 0.01,
        hp: hp || stats.hp,
        maxHp: stats.hp,
        kind,
        age: 0,
        cd: Math.floor(Math.random() * stats.cooldown),
        targetId: null,
      })
    }

    let raf = 0
    let lastBook = 0

    function tick() {
      raf = requestAnimationFrame(tick)
      controls.update()
      while (spawnQueue.current.length) {
        const j = spawnQueue.current.shift()!
        spawnUnit(j.side, j.kind, j.hp)
      }
      const now = performance.now()
      if (now - lastBook > 800) {
        lastBook = now
        rebuildMountains()
        rebuildWalls()
        if (unitsRef.current.length < 50) {
          if (buySRef.current > sellSRef.current + 0.06 && Math.random() < 0.4) {
            spawnQueue.current.push({
              side: 'bull',
              kind: Math.random() > 0.5 ? 'cavalry' : 'infantry',
              hp: UNIT_STATS.infantry.hp,
            })
          }
          if (sellSRef.current > buySRef.current + 0.06 && Math.random() < 0.4) {
            spawnQueue.current.push({
              side: 'bear',
              kind: Math.random() > 0.5 ? 'drone' : 'infantry',
              hp: UNIT_STATS.infantry.hp,
            })
          }
        }
      }

      const units = unitsRef.current
      for (const u of units) {
        u.age += 1
        if (u.cd > 0) u.cd -= 1
        const stats = UNIT_STATS[u.kind]
        let best: Unit | null = null
        let bestD = Infinity
        for (const o of units) {
          if (o.side === u.side || o.hp <= 0) continue
          const dx = o.root.position.x - u.root.position.x
          const dz = o.root.position.z - u.root.position.z
          const d = dx * dx + dz * dz
          if (d < bestD) {
            bestD = d
            best = o
          }
        }
        u.targetId = best?.id ?? null
        const dist = Math.sqrt(bestD)
        if (best && dist < stats.range * 2.4) {
          const dx = best.root.position.x - u.root.position.x
          const dz = best.root.position.z - u.root.position.z
          const len = Math.hypot(dx, dz) || 1
          if (dist > stats.range * 0.65) {
            u.vx = (dx / len) * stats.speed
            u.vz = (dz / len) * stats.speed
          } else if (dist < stats.range * 0.35 && (u.kind === 'sniper' || u.kind === 'artillery')) {
            u.vx = (-dx / len) * stats.speed * 0.55
            u.vz = (-dz / len) * stats.speed * 0.55
          } else {
            u.vx *= 0.85
            u.vz *= 0.85
          }
          if (dist <= stats.range && u.cd <= 0) {
            u.cd = stats.cooldown
            best.hp -= stats.damage * (best.kind === 'shield' ? 0.55 : 1)
            best.root.scale.setScalar(1.5)
            updateHpBar(best)
          }
        } else {
          const dir = u.side === 'bull' ? 1 : -1
          u.vx = dir * stats.speed * 0.85
          u.vz += (Math.random() - 0.5) * 0.002
          u.vz = Math.max(-0.04, Math.min(0.04, u.vz))
        }
        for (const o of units) {
          if (o.id === u.id || o.side !== u.side) continue
          const dx = u.root.position.x - o.root.position.x
          const dz = u.root.position.z - o.root.position.z
          const d2 = dx * dx + dz * dz
          const minD = (stats.radius + UNIT_STATS[o.kind].radius) * 1.2
          if (d2 < minD * minD && d2 > 1e-6) {
            const d = Math.sqrt(d2)
            u.vx += (dx / d) * 0.012
            u.vz += (dz / d) * 0.012
          }
        }
        u.root.scale.x += (1.35 - u.root.scale.x) * 0.12
        u.root.scale.y += (1.35 - u.root.scale.y) * 0.12
        u.root.scale.z += (1.35 - u.root.scale.z) * 0.12
        u.root.position.x += u.vx
        u.root.position.z += u.vz
        u.root.position.y =
          u.kind === 'drone'
            ? 0.9 + Math.sin(u.age * 0.2) * 0.1
            : 0.05 + Math.abs(Math.sin(u.age * 0.15)) * 0.05
        u.root.rotation.y = Math.atan2(u.vx, u.vz)
        u.root.position.z = Math.max(-12.5, Math.min(12.5, u.root.position.z))
        updateHpBar(u)
      }

      unitsRef.current = unitsRef.current.filter((u) => {
        if (Math.abs(u.root.position.x) > 20 || u.hp <= 0 || u.age > 1200) {
          scene.remove(u.root)
          return false
        }
        return true
      })
      renderer.render(scene, camera)
    }
    tick()

    spawnUnit('bull', 'infantry', UNIT_STATS.infantry.hp)
    spawnUnit('bull', 'cavalry', UNIT_STATS.cavalry.hp)
    spawnUnit('bear', 'infantry', UNIT_STATS.infantry.hp)
    spawnUnit('bear', 'sniper', UNIT_STATS.sniper.hp)

    const onResize = () => {
      const w = mount.clientWidth || 640
      const h = mount.clientHeight || 360
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      unitsRef.current = []
    }
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#040608] text-[#eaecef] select-none">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 border-b border-[#1e2a22] shrink-0 bg-gradient-to-r from-[#0a1810] via-[#0a0f0c] to-[#1a0c10]">
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase tracking-wider">
            {symbol} · Battlefield 3D
          </div>
          <div className="text-lg font-mono font-bold tabular-nums">
            {price
              ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : '—'}
          </div>
        </div>
        <div
          className={`text-[11px] font-mono ${
            chg >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
          }`}
        >
          {chg >= 0 ? '+' : ''}
          {chg.toFixed(2)}%
        </div>
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
          onClick={() => setShowMountains((v) => !v)}
        >
          {showMountains ? 'Hide depth' : 'Show depth'}
        </button>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <div className="text-right">
            <div className="text-[9px] text-[#f6465d] uppercase">Sell wall</div>
            <div className="font-mono font-semibold text-[#f6465d]">{fmtM(walls.sell)}</div>
          </div>
          <div className="px-2.5 py-1 rounded border border-[#f0b90b]/50 bg-[#f0b90b]/10 text-[#f0b90b] text-[10px] font-bold tracking-wide">
            {contested}
          </div>
          <div className="text-left">
            <div className="text-[9px] text-[#0ecb81] uppercase">Buy wall</div>
            <div className="font-mono font-semibold text-[#0ecb81]">{fmtM(walls.buy)}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[280px] relative">
        <div ref={mountRef} className="absolute inset-0" />
        {hint && (
          <button
            type="button"
            className="absolute bottom-3 left-3 z-10 text-[10px] px-2 py-1 rounded bg-[#0b0e11]/90 border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
            onClick={() => setHint(false)}
          >
            🟢 Bulls left · 🔴 Bears right · units fight · 🖱 orbit
          </button>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 text-[9px] font-mono pointer-events-none max-w-[200px]">
          <span className="px-1.5 py-0.5 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/50 font-semibold">
            ● GREEN = bids / bulls
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/50 font-semibold">
            ● RED = asks / bears
          </span>
        </div>
        {showMountains && (
          <DepthMountains2D bids={orderBook?.bids} asks={orderBook?.asks} />
        )}
      </div>
      <div className="border-t border-[#1e2a22] shrink-0 max-h-[100px] overflow-y-auto p-2 text-[10px] font-mono bg-[#080b09]">
        <div className="text-[9px] text-[#5e6673] uppercase mb-1">Combat feed · LIVE</div>
        {feedTick >= 0 && feedRef.current.length === 0 ? (
          <div className="text-[#5e6673]">Waiting for large tape hits — Start Live…</div>
        ) : (
          feedRef.current.slice(0, 10).map((f) => (
            <div
              key={f.id}
              className={
                f.side === 'bull'
                  ? 'text-[#0ecb81] py-0.5'
                  : f.side === 'bear'
                    ? 'text-[#f6465d] py-0.5'
                    : 'text-[#f0b90b] py-0.5'
              }
            >
              ● {f.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
