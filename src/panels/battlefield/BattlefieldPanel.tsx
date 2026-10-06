/**
 * Battlefield 3D — video-game style arena driven by live order book + tape.
 * Orbit / pan / zoom with mouse (or touch). Bulls vs bears on deformable terrain.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useMarketStore } from '@/stores/marketStore'

interface Unit {
  id: number
  side: 'bull' | 'bear'
  mesh: THREE.Mesh
  vx: number
  vz: number
  hp: number
  kind: 'infantry' | 'tank' | 'heavy'
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

function terrainY(x: number, z: number, buyS: number, sellS: number): number {
  const ridgeBuy = Math.max(0, (x - 2) / 14) * buyS * 3.2
  const ridgeSell = Math.max(0, (-x - 2) / 14) * sellS * 3.2
  const noise =
    Math.sin(x * 0.55 + z * 0.4) * 0.25 + Math.sin(x * 1.1 - z * 0.7) * 0.15
  return ridgeBuy + ridgeSell + noise
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
  const orderBookLive = useRef(orderBook)
  orderBookLive.current = orderBook
  const spawnQueue = useRef<
    { side: 'bull' | 'bear'; kind: Unit['kind']; hp: number }[]
  >([])

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
      const kind: Unit['kind'] =
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
        hp: kind === 'heavy' ? 4 : kind === 'tank' ? 2.5 : 1,
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
    scene.background = new THREE.Color(0x05070a)
    scene.fog = new THREE.FogExp2(0x05070a, 0.018)

    const camera = new THREE.PerspectiveCamera(50, w0 / h0, 0.1, 200)
    camera.position.set(18, 14, 22)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 8
    controls.maxDistance = 55
    controls.maxPolarAngle = Math.PI * 0.48
    controls.target.set(0, 1, 0)
    controls.update()

    const amb = new THREE.AmbientLight(0x6a7a88, 0.45)
    scene.add(amb)
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.05)
    sun.position.set(12, 22, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)
    const rimBull = new THREE.PointLight(0x0ecb81, 1.2, 40)
    rimBull.position.set(10, 6, 0)
    scene.add(rimBull)
    const rimBear = new THREE.PointLight(0xf6465d, 1.2, 40)
    rimBear.position.set(-10, 6, 0)
    scene.add(rimBear)

    const grid = new THREE.GridHelper(40, 40, 0x1e2a22, 0x12181c)
    grid.position.y = 0.02
    scene.add(grid)

    const tSeg = 48
    const terrainGeo = new THREE.PlaneGeometry(36, 28, tSeg, tSeg)
    terrainGeo.rotateX(-Math.PI / 2)
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x0e1512,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: true,
    })
    const terrain = new THREE.Mesh(terrainGeo, terrainMat)
    terrain.receiveShadow = true
    scene.add(terrain)

    const updateTerrain = () => {
      const pos = terrainGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const z = pos.getZ(i)
        pos.setY(i, terrainY(x, z, buySRef.current, sellSRef.current))
      }
      pos.needsUpdate = true
      terrainGeo.computeVertexNormals()
    }
    updateTerrain()

    const wallGroup = new THREE.Group()
    scene.add(wallGroup)
    const rebuildWalls = () => {
      while (wallGroup.children.length) {
        const c = wallGroup.children.pop()!
        const mesh = c as THREE.Mesh
        mesh.geometry?.dispose()
        wallGroup.remove(c)
      }
      const bids = orderBookLive.current?.bids ?? []
      const asks = orderBookLive.current?.asks ?? []
      const maxN = Math.max(
        ...bids.slice(0, 12).map((l) => l.price * l.qty),
        ...asks.slice(0, 12).map((l) => l.price * l.qty),
        1
      )
      const place = (
        levels: { price: number; qty: number }[],
        side: 'bull' | 'bear'
      ) => {
        levels.slice(0, 12).forEach((l, i) => {
          const h = 0.4 + ((l.price * l.qty) / maxN) * 6
          const geo = new THREE.BoxGeometry(0.7, h, 1.1)
          const mat = new THREE.MeshStandardMaterial({
            color: side === 'bull' ? 0x0ecb81 : 0xf6465d,
            emissive: side === 'bull' ? 0x043d28 : 0x4a1018,
            emissiveIntensity: 0.35,
            roughness: 0.55,
            metalness: 0.25,
            transparent: true,
            opacity: 0.88,
          })
          const m = new THREE.Mesh(geo, mat)
          m.castShadow = true
          const x = side === 'bull' ? 6 + i * 0.85 : -6 - i * 0.85
          m.position.set(x, h / 2 + 0.05, -4 + (i % 3) * 2.2)
          wallGroup.add(m)
        })
      }
      place(bids, 'bull')
      place(asks, 'bear')
    }
    rebuildWalls()

    const flagGeo = new THREE.ConeGeometry(0.45, 1.4, 4)
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xf0b90b,
      emissive: 0xf0b90b,
      emissiveIntensity: 0.4,
    })
    const flag = new THREE.Mesh(flagGeo, flagMat)
    flag.position.set(0, 1.2, 0)
    scene.add(flag)

    const unitMatBull = new THREE.MeshStandardMaterial({
      color: 0x0ecb81,
      emissive: 0x0a5c3a,
      emissiveIntensity: 0.3,
    })
    const unitMatBear = new THREE.MeshStandardMaterial({
      color: 0xf6465d,
      emissive: 0x5c1018,
      emissiveIntensity: 0.3,
    })

    function spawnUnit(side: 'bull' | 'bear', kind: Unit['kind'], hp: number) {
      const size = kind === 'heavy' ? 0.55 : kind === 'tank' ? 0.42 : 0.28
      const geo =
        kind === 'heavy'
          ? new THREE.DodecahedronGeometry(size)
          : kind === 'tank'
            ? new THREE.BoxGeometry(size * 1.4, size, size * 1.8)
            : new THREE.SphereGeometry(size, 10, 10)
      const mesh = new THREE.Mesh(
        geo,
        side === 'bull' ? unitMatBull : unitMatBear
      )
      mesh.castShadow = true
      const x = side === 'bull' ? 8 + Math.random() * 4 : -8 - Math.random() * 4
      const z = (Math.random() - 0.5) * 16
      mesh.position.set(x, size + 0.2, z)
      scene.add(mesh)
      unitsRef.current.push({
        id: uid.current++,
        side,
        mesh,
        vx: side === 'bull' ? -0.04 - Math.random() * 0.03 : 0.04 + Math.random() * 0.03,
        vz: (Math.random() - 0.5) * 0.02,
        hp,
        kind,
        age: 0,
      })
    }

    for (let i = 0; i < 8; i++) {
      spawnUnit(i % 2 === 0 ? 'bull' : 'bear', 'infantry', 1)
    }

    let raf = 0
    let last = performance.now()
    let wallTick = 0

    const onResize = () => {
      if (!mount) return
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

      wallTick += dt
      if (wallTick > 1.2) {
        wallTick = 0
        rebuildWalls()
        updateTerrain()
      }

      flag.rotation.y += dt * 1.2
      flag.position.y = 1.1 + Math.sin(now * 0.003) * 0.12

      const units = unitsRef.current
      for (const u of units) {
        u.age += dt
        u.mesh.position.x += u.vx * (60 * dt)
        u.mesh.position.z += u.vz * (60 * dt)
        const y =
          terrainY(
            u.mesh.position.x,
            u.mesh.position.z,
            buySRef.current,
            sellSRef.current
          ) + (u.kind === 'heavy' ? 0.55 : u.kind === 'tank' ? 0.42 : 0.28)
        u.mesh.position.y = y
        u.mesh.rotation.y += dt * (u.side === 'bull' ? 2 : -2)
        if (Math.abs(u.mesh.position.x) > 16) u.vx *= -1
        if (Math.abs(u.mesh.position.z) > 12) u.vz *= -1
      }

      for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
          const a = units[i]!
          const b = units[j]!
          if (a.side === b.side) continue
          const dx = a.mesh.position.x - b.mesh.position.x
          const dz = a.mesh.position.z - b.mesh.position.z
          const d2 = dx * dx + dz * dz
          if (d2 < 0.7) {
            a.hp -= dt * 0.8
            b.hp -= dt * 0.8
            a.vx += dx * 0.002
            a.vz += dz * 0.002
            b.vx -= dx * 0.002
            b.vz -= dz * 0.002
          }
        }
      }

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i]!
        if (u.hp <= 0 || u.age > 45) {
          scene.remove(u.mesh)
          u.mesh.geometry.dispose()
          units.splice(i, 1)
        }
      }

      if (units.length < 6 && Math.random() < 0.02) {
        spawnUnit(Math.random() > 0.5 ? 'bull' : 'bear', 'infantry', 1)
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
      unitsRef.current.forEach((u) => {
        scene.remove(u.mesh)
        u.mesh.geometry.dispose()
      })
      unitsRef.current = []
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#05070a] text-[#eaecef] select-none">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[#1e2a22] shrink-0 bg-[#0a0f0c]/90">
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase tracking-wider">
            {symbol} · Battlefield 3D · LIVE
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
        <div className="ml-auto flex items-center gap-4 text-[11px]">
          <div className="text-right">
            <div className="text-[9px] text-[#f6465d] uppercase">Sell wall</div>
            <div className="font-mono font-semibold text-[#f6465d]">
              {fmtM(walls.sell)}
            </div>
          </div>
          <div className="px-2 py-0.5 rounded border border-[#f0b90b]/40 text-[#f0b90b] text-[10px] font-semibold tracking-wide">
            {contested}
          </div>
          <div className="text-left">
            <div className="text-[9px] text-[#0ecb81] uppercase">Buy wall</div>
            <div className="font-mono font-semibold text-[#0ecb81]">
              {fmtM(walls.buy)}
            </div>
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
            🖱 Drag orbit · Scroll zoom · Right-drag pan · Tap to dismiss
          </button>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 text-[9px] font-mono pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-[#0ecb81]/15 text-[#0ecb81] border border-[#0ecb81]/30">
            ● BULL = aggressive buy
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30">
            ● BEAR = aggressive sell
          </span>
        </div>
      </div>

      <div className="border-t border-[#1e2a22] shrink-0 max-h-[120px] overflow-y-auto p-2 text-[10px] font-mono bg-[#080b09]">
        <div className="text-[9px] text-[#5e6673] uppercase mb-1">Combat feed · LIVE</div>
        {feedTick >= 0 && feedRef.current.length === 0 ? (
          <div className="text-[#5e6673]">
            Waiting for large tape hits — Start Live on the desk…
          </div>
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
