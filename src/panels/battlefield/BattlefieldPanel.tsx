/**
 * Battlefield 3D — game-like arena: green/red territories, depth mountains (toggle),
 * defined unit models, live order-book walls + tape spawns.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useMarketStore } from '@/stores/marketStore'

type UnitKind = 'infantry' | 'tank' | 'heavy'

interface Unit {
  id: number
  side: 'bull' | 'bear'
  root: THREE.Group
  vx: number
  vz: number
  hp: number
  kind: UnitKind
  age: number
}

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
    Math.sin(x * 0.35 + z * 0.22) * 0.12 +
    Math.sin(x * 0.9 - z * 0.55) * 0.06
  )
}

function makeUnitModel(side: 'bull' | 'bear', kind: UnitKind): THREE.Group {
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

  if (kind === 'infantry') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.35, 4, 8), bodyMat)
    body.position.y = 0.45
    body.castShadow = true
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bodyMat)
    head.position.y = 0.85
    head.castShadow = true
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
    cabin.castShadow = true
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8), accentMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.5, 0.55)
    const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 1.1), armorMat)
    trackL.position.set(-0.38, 0.12, 0)
    const trackR = trackL.clone()
    trackR.position.x = 0.38
    g.add(hull, cabin, barrel, trackL, trackR)
  } else {
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
  }
  return g
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
      const kind: UnitKind =
        notional > 250_000 ? 'heavy' : notional > 50_000 ? 'tank' : 'infantry'
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
      spawnQueue.current.push({
        side: bull ? 'bull' : 'bear',
        kind,
        hp: kind === 'heavy' ? 5 : kind === 'tank' ? 3 : 1.2,
      })
    }
    if (trades[0]) lastTradeId.current = trades[0].id
  }, [trades])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w0 = mount.clientWidth || 640
    const h0 = mount.clientHeight || 360

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x040608)
    scene.fog = new THREE.FogExp2(0x040608, 0.014)

    const camera = new THREE.PerspectiveCamera(48, w0 / h0, 0.1, 220)
    camera.position.set(20, 16, 24)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 10
    controls.maxDistance = 60
    controls.maxPolarAngle = Math.PI * 0.47
    controls.target.set(0, 1.5, 0)
    controls.update()

    scene.add(new THREE.AmbientLight(0x8899aa, 0.35))
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.15)
    sun.position.set(14, 28, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 80
    sun.shadow.camera.left = -30
    sun.shadow.camera.right = 30
    sun.shadow.camera.top = 30
    sun.shadow.camera.bottom = -30
    scene.add(sun)
    const fillBull = new THREE.PointLight(0x0ecb81, 1.6, 50)
    fillBull.position.set(12, 8, 2)
    scene.add(fillBull)
    const fillBear = new THREE.PointLight(0xf6465d, 1.6, 50)
    fillBear.position.set(-12, 8, 2)
    scene.add(fillBear)

    function makeTerritory(side: 'bull' | 'bear', xOff: number): THREE.Mesh {
      const geo = new THREE.PlaneGeometry(18, 28, 24, 32)
      geo.rotateX(-Math.PI / 2)
      const pos = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + xOff
        const z = pos.getZ(i)
        pos.setY(i, groundNoise(x, z))
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
      const mat = new THREE.MeshStandardMaterial({
        color: side === 'bull' ? 0x0a3d28 : 0x3d1218,
        emissive: side === 'bull' ? 0x0ecb81 : 0xf6465d,
        emissiveIntensity: 0.12,
        roughness: 0.88,
        metalness: 0.05,
        flatShading: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.x = xOff
      mesh.receiveShadow = true
      return mesh
    }
    scene.add(makeTerritory('bear', -9))
    scene.add(makeTerritory('bull', 9))

    const stripGeo = new THREE.PlaneGeometry(1.4, 28, 1, 16)
    stripGeo.rotateX(-Math.PI / 2)
    const strip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshStandardMaterial({
        color: 0xf0b90b,
        emissive: 0xf0b90b,
        emissiveIntensity: 0.35,
        roughness: 0.5,
        metalness: 0.4,
      })
    )
    strip.position.y = 0.04
    strip.receiveShadow = true
    scene.add(strip)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(22, 0.18, 8, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2b3139,
        emissive: 0xf0b90b,
        emissiveIntensity: 0.15,
        metalness: 0.7,
        roughness: 0.3,
      })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.15
    scene.add(ring)

    const grid = new THREE.GridHelper(36, 36, 0x1e2a22, 0x12181c)
    grid.position.y = 0.06
    scene.add(grid)

    const mountainGroup = new THREE.Group()
    scene.add(mountainGroup)

    const rebuildMountains = () => {
      while (mountainGroup.children.length) {
        const c = mountainGroup.children.pop()!
        const m = c as THREE.Mesh
        m.geometry?.dispose()
        mountainGroup.remove(c)
      }
      if (!showMountainsRef.current) return

      const bids = orderBookLive.current?.bids ?? []
      const asks = orderBookLive.current?.asks ?? []
      const maxQ = Math.max(
        ...bids.slice(0, 20).map((l) => l.qty),
        ...asks.slice(0, 20).map((l) => l.qty),
        0.0001
      )

      const buildRidge = (
        levels: { price: number; qty: number }[],
        side: 'bull' | 'bear'
      ) => {
        const n = Math.min(20, levels.length)
        if (n < 2) return
        const shape = new THREE.Shape()
        shape.moveTo(0, 0)
        for (let i = 0; i < n; i++) {
          const h = 0.3 + (levels[i]!.qty / maxQ) * 7.5
          const x = (i / (n - 1)) * 10
          shape.lineTo(x, h)
        }
        shape.lineTo(10, 0)
        shape.lineTo(0, 0)
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 4.5,
          bevelEnabled: true,
          bevelThickness: 0.15,
          bevelSize: 0.12,
          bevelSegments: 2,
        })
        const mat = new THREE.MeshStandardMaterial({
          color: side === 'bull' ? 0x0ecb81 : 0xf6465d,
          emissive: side === 'bull' ? 0x0a5c3a : 0x5c1018,
          emissiveIntensity: 0.45,
          roughness: 0.35,
          metalness: 0.25,
          transparent: true,
          opacity: 0.92,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (side === 'bull') {
          mesh.rotation.y = -Math.PI / 2
          mesh.position.set(11, 0.05, -5)
        } else {
          mesh.rotation.y = Math.PI / 2
          mesh.position.set(-11, 0.05, 5)
        }
        mountainGroup.add(mesh)

        const peakH =
          0.3 + (Math.max(...levels.slice(0, n).map((l) => l.qty)) / maxQ) * 7.5
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: side === 'bull' ? 0x0ecb81 : 0xf6465d,
            emissiveIntensity: 1.2,
          })
        )
        if (side === 'bull') beacon.position.set(11, peakH + 0.4, -2.5)
        else beacon.position.set(-11, peakH + 0.4, 2.5)
        mountainGroup.add(beacon)
      }

      buildRidge(bids, 'bull')
      buildRidge(asks, 'bear')
    }
    rebuildMountains()

    const wallGroup = new THREE.Group()
    scene.add(wallGroup)
    const rebuildWalls = () => {
      while (wallGroup.children.length) {
        const c = wallGroup.children.pop()!
        const m = c as THREE.Mesh
        m.geometry?.dispose()
        wallGroup.remove(c)
      }
      const bids = orderBookLive.current?.bids ?? []
      const asks = orderBookLive.current?.asks ?? []
      const maxN = Math.max(
        ...bids.slice(0, 10).map((l) => l.price * l.qty),
        ...asks.slice(0, 10).map((l) => l.price * l.qty),
        1
      )
      const place = (
        levels: { price: number; qty: number }[],
        side: 'bull' | 'bear'
      ) => {
        levels.slice(0, 10).forEach((l, i) => {
          const h = 0.5 + ((l.price * l.qty) / maxN) * 5
          const geo = new THREE.BoxGeometry(0.55, h, 0.85)
          const mat = new THREE.MeshStandardMaterial({
            color: side === 'bull' ? 0x12d18a : 0xff4d63,
            emissive: side === 'bull' ? 0x064d32 : 0x4a1018,
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.35,
          })
          const m = new THREE.Mesh(geo, mat)
          m.castShadow = true
          const x = side === 'bull' ? 3.2 + i * 0.7 : -3.2 - i * 0.7
          m.position.set(x, h / 2 + 0.08, -8 + (i % 2) * 1.2)
          wallGroup.add(m)
        })
      }
      place(bids, 'bull')
      place(asks, 'bear')
    }
    rebuildWalls()

    const flagPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    )
    flagPole.position.y = 1.2
    scene.add(flagPole)
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.5, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xf0b90b,
        emissive: 0xf0b90b,
        emissiveIntensity: 0.5,
      })
    )
    flag.position.set(0.45, 2.1, 0)
    scene.add(flag)

    function makeLabel(text: string, color: string): THREE.Sprite {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 64
      const ctx = c.getContext('2d')!
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(8, 8, 240, 48)
      ctx.font = 'bold 28px monospace'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(text, 128, 42)
      const tex = new THREE.CanvasTexture(c)
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true })
      const spr = new THREE.Sprite(mat)
      spr.scale.set(4, 1, 1)
      return spr
    }
    const lblBull = makeLabel('BULLS', '#0ecb81')
    lblBull.position.set(10, 3.5, 12)
    scene.add(lblBull)
    const lblBear = makeLabel('BEARS', '#f6465d')
    lblBear.position.set(-10, 3.5, 12)
    scene.add(lblBear)

    function spawnUnit(side: 'bull' | 'bear', kind: UnitKind, hp: number) {
      const root = makeUnitModel(side, kind)
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true
      })
      const x = side === 'bull' ? 10 + Math.random() * 5 : -10 - Math.random() * 5
      const z = (Math.random() - 0.5) * 18
      root.position.set(x, groundNoise(x, z), z)
      scene.add(root)
      unitsRef.current.push({
        id: uid.current++,
        side,
        root,
        vx: side === 'bull' ? -0.035 - Math.random() * 0.025 : 0.035 + Math.random() * 0.025,
        vz: (Math.random() - 0.5) * 0.02,
        hp,
        kind,
        age: 0,
      })
    }

    for (let i = 0; i < 10; i++) {
      spawnUnit(i % 2 === 0 ? 'bull' : 'bear', 'infantry', 1.2)
    }

    let raf = 0
    let last = performance.now()
    let wallTick = 0
    let lastMountains = showMountainsRef.current

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w < 2 || h < 2) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      while (spawnQueue.current.length) {
        const s = spawnQueue.current.shift()!
        spawnUnit(s.side, s.kind, s.hp)
      }

      if (showMountainsRef.current !== lastMountains) {
        lastMountains = showMountainsRef.current
        rebuildMountains()
      }

      wallTick += dt
      if (wallTick > 1.1) {
        wallTick = 0
        rebuildWalls()
        if (showMountainsRef.current) rebuildMountains()
      }

      flag.rotation.y = Math.sin(now * 0.002) * 0.25
      flagPole.rotation.y += dt * 0.4

      const units = unitsRef.current
      for (const u of units) {
        u.age += dt
        u.root.position.x += u.vx * 60 * dt
        u.root.position.z += u.vz * 60 * dt
        u.root.position.y = groundNoise(u.root.position.x, u.root.position.z)
        u.root.rotation.y = Math.atan2(u.vx, u.vz)
        if (Math.abs(u.root.position.x) > 17) u.vx *= -1
        if (Math.abs(u.root.position.z) > 13) u.vz *= -1
      }

      for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
          const a = units[i]!
          const b = units[j]!
          if (a.side === b.side) continue
          const dx = a.root.position.x - b.root.position.x
          const dz = a.root.position.z - b.root.position.z
          if (dx * dx + dz * dz < 0.85) {
            a.hp -= dt * 0.9
            b.hp -= dt * 0.9
            a.vx += dx * 0.003
            a.vz += dz * 0.003
            b.vx -= dx * 0.003
            b.vz -= dz * 0.003
          }
        }
      }

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i]!
        if (u.hp <= 0 || u.age > 50) {
          scene.remove(u.root)
          units.splice(i, 1)
        }
      }

      if (units.length < 8 && Math.random() < 0.025) {
        spawnUnit(Math.random() > 0.5 ? 'bull' : 'bear', 'infantry', 1.2)
      }

      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      unitsRef.current = []
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#040608] text-[#eaecef] select-none">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 border-b border-[#1e2a22] shrink-0 bg-[#0a0f0c]/95">
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

        <label className="flex items-center gap-1.5 text-[10px] text-[#b7bdc6] cursor-pointer px-2 py-1 rounded border border-[#2b3139] hover:border-[#f0b90b]/40">
          <input
            type="checkbox"
            className="accent-[#f0b90b]"
            checked={showMountains}
            onChange={(e) => setShowMountains(e.target.checked)}
          />
          Depth mountains
        </label>

        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <div className="text-right">
            <div className="text-[9px] text-[#f6465d] uppercase">Sell wall</div>
            <div className="font-mono font-semibold text-[#f6465d]">{fmtM(walls.sell)}</div>
          </div>
          <div className="px-2 py-0.5 rounded border border-[#f0b90b]/40 text-[#f0b90b] text-[10px] font-semibold tracking-wide">
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
            className="absolute bottom-3 left-3 z-10 text-[10px] px-2 py-1 rounded bg-[#0b0e11]/85 border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]"
            onClick={() => setHint(false)}
          >
            🖱 Orbit · Scroll zoom · Right-drag pan · Toggle mountains above
          </button>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 text-[9px] font-mono pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40">
            ● GREEN zone = bids / bulls
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/40">
            ● RED zone = asks / bears
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
            ● GOLD strip = contested mid
          </span>
        </div>
      </div>

      <div className="border-t border-[#1e2a22] shrink-0 max-h-[110px] overflow-y-auto p-2 text-[10px] font-mono bg-[#080b09]">
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
