/**
 * Battlefield 3D — realistic game arena: green/red territories, depth mountains,
 * road / rocks / trees / grass, ACES lighting, live order-book + tape.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useMarketStore } from '@/stores/marketStore'
import { DepthMountains2D } from './DepthMountains2D'

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
    Math.sin(x * 0.28 + z * 0.19) * 0.14 +
    Math.sin(x * 0.75 - z * 0.48) * 0.07 +
    Math.sin(x * 1.4 + z * 1.1) * 0.03 +
    Math.cos(x * 0.15 - z * 0.35) * 0.05
  )
}

function makeTree(scale = 1): THREE.Group {
  const g = new THREE.Group()
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3d2a1a,
    roughness: 0.95,
    metalness: 0.02,
  })
  const leafColors = [0x1b5e36, 0x247a42, 0x145c2e, 0x2d8a4e]
  const leafMat = new THREE.MeshStandardMaterial({
    color: leafColors[Math.floor(Math.random() * leafColors.length)]!,
    roughness: 0.78,
    metalness: 0.04,
  })
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.14 * scale, 0.85 * scale, 7),
    trunkMat
  )
  trunk.position.y = 0.42 * scale
  trunk.castShadow = true
  trunk.receiveShadow = true
  const layers = [
    { y: 0.95, r: 0.52, h: 0.85 },
    { y: 1.35, r: 0.4, h: 0.7 },
    { y: 1.65, r: 0.26, h: 0.5 },
  ]
  for (const L of layers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(L.r * scale, L.h * scale, 8),
      leafMat
    )
    cone.position.y = L.y * scale
    cone.castShadow = true
    cone.receiveShadow = true
    g.add(cone)
  }
  g.add(trunk)
  g.rotation.y = Math.random() * Math.PI * 2
  return g
}

function makeRock(scale = 1): THREE.Group {
  const g = new THREE.Group()
  const colors = [0x6a6e76, 0x555a62, 0x7a7e86, 0x4a4e56]
  const mat = new THREE.MeshStandardMaterial({
    color: colors[Math.floor(Math.random() * colors.length)]!,
    roughness: 0.92,
    metalness: 0.08,
    flatShading: true,
  })
  const a = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38 * scale, 0), mat)
  a.scale.set(1.2, 0.75, 1)
  a.position.y = 0.18 * scale
  a.rotation.set(0.25, 0.6, 0.12)
  a.castShadow = true
  a.receiveShadow = true
  const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * scale, 0), mat)
  b.scale.set(1, 0.7, 1.15)
  b.position.set(0.3 * scale, 0.1 * scale, 0.12 * scale)
  b.rotation.set(-0.25, 0.9, 0.35)
  b.castShadow = true
  const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 * scale, 0), mat)
  c.position.set(-0.2 * scale, 0.08 * scale, 0.15 * scale)
  c.castShadow = true
  g.add(a, b, c)
  return g
}

function makeBush(scale = 1): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x145c32,
    emissive: 0x0a2e18,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    flatShading: true,
  })
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 * scale, 0), mat)
  m.position.y = 0.18 * scale
  m.castShadow = true
  return m
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
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 4
    skyCanvas.height = 256
    {
      const ctx = skyCanvas.getContext('2d')!
      const grd = ctx.createLinearGradient(0, 0, 0, 256)
      grd.addColorStop(0, '#0a1420')
      grd.addColorStop(0.35, '#121c28')
      grd.addColorStop(0.7, '#1a2830')
      grd.addColorStop(1, '#0d1814')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, 4, 256)
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas)
    skyTex.magFilter = THREE.LinearFilter
    scene.background = skyTex
    scene.fog = new THREE.FogExp2(0x0c1418, 0.011)

    const camera = new THREE.PerspectiveCamera(46, w0 / h0, 0.1, 260)
    camera.position.set(22, 14, 26)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w0, h0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 10
    controls.maxDistance = 55
    controls.maxPolarAngle = Math.PI * 0.46
    controls.target.set(0, 1.2, 0)
    controls.update()

    const hemi = new THREE.HemisphereLight(0xb8c8d8, 0x1a2a1e, 0.55)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffe6c0, 1.35)
    sun.position.set(18, 32, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.00025
    sun.shadow.normalBias = 0.03
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 90
    sun.shadow.camera.left = -32
    sun.shadow.camera.right = 32
    sun.shadow.camera.top = 32
    sun.shadow.camera.bottom = -32
    scene.add(sun)
    const fillBull = new THREE.PointLight(0x0ecb81, 0.9, 42, 2)
    fillBull.position.set(11, 5, 2)
    scene.add(fillBull)
    const fillBear = new THREE.PointLight(0xf6465d, 0.9, 42, 2)
    fillBear.position.set(-11, 5, 2)
    scene.add(fillBear)
    const rim = new THREE.DirectionalLight(0x88aacc, 0.25)
    rim.position.set(-8, 10, 20)
    scene.add(rim)

    function makeTerritory(side: 'bull' | 'bear', xOff: number): THREE.Mesh {
      const geo = new THREE.PlaneGeometry(18, 28, 48, 56)
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
        color: side === 'bull' ? 0x0c4a30 : 0x4a141c,
        emissive: side === 'bull' ? 0x0a6b40 : 0x6b1820,
        emissiveIntensity: 0.08,
        roughness: 0.92,
        metalness: 0.03,
        flatShading: false,
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
        emissiveIntensity: 0.25,
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
        emissiveIntensity: 0.12,
        metalness: 0.7,
        roughness: 0.3,
      })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.15
    scene.add(ring)

    const grid = new THREE.GridHelper(36, 36, 0x152018, 0x0e1410)
    grid.position.y = 0.05
    ;(grid.material as THREE.Material).opacity = 0.35
    ;(grid.material as THREE.Material).transparent = true
    scene.add(grid)

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2c3038,
      roughness: 0.88,
      metalness: 0.12,
    })
    const road = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 26.5), roadMat)
    road.position.set(0, 0.09, 0)
    road.receiveShadow = true
    scene.add(road)
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4d8,
      roughness: 0.6,
      metalness: 0.1,
    })
    for (const sx of [-1.05, 1.05]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 26), edgeMat)
      edge.position.set(sx, 0.13, 0)
      scene.add(edge)
    }
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xf0b90b,
      emissive: 0xf0b90b,
      emissiveIntensity: 0.15,
      roughness: 0.5,
    })
    for (let i = -11; i <= 11; i += 2) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.85), dashMat)
      dash.position.set(0, 0.13, i)
      scene.add(dash)
    }
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x3a3630,
      roughness: 0.98,
    })
    const shL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 26.5), shoulderMat)
    shL.position.set(-1.4, 0.07, 0)
    shL.receiveShadow = true
    const shR = shL.clone()
    shR.position.x = 1.4
    scene.add(shL, shR)

    const decor = new THREE.Group()
    scene.add(decor)
    const treeSpots: [number, number, number][] = [
      [14, 8, 1.1], [16, -6, 1.25], [12, 11, 0.9], [15, 3, 1.0], [13, -11, 1.15],
      [17, 4, 0.95], [14.5, -2, 1.05], [11, 6, 0.8], [-14, 7, 1.05], [-16, -5, 1.2],
      [-12, 10, 0.95], [-15, -9, 1.1], [-13, 2, 1.0], [-17, 1, 1.15], [-14.5, -3, 0.9],
      [-11, 5, 0.85], [8, 12, 0.85], [-8, 12, 0.85], [9, -12, 0.9], [-9, -12, 0.9],
      [6, 13, 0.75], [-6, -13, 0.8],
    ]
    for (const [x, z, sc] of treeSpots) {
      const tree = makeTree(sc)
      tree.position.set(x, groundNoise(x, z), z)
      decor.add(tree)
    }
    const rockSpots: [number, number, number][] = [
      [5, 6, 1.2], [6, -4, 0.9], [-5, 5, 1.1], [-6, -7, 1.0], [4, 10, 0.7],
      [-4, -10, 0.8], [11, 0, 1.3], [-11, 1, 1.15], [7, -9, 0.85], [-7, 8, 0.95],
      [2.5, 4, 0.6], [-2.5, -3, 0.65],
    ]
    for (const [x, z, sc] of rockSpots) {
      const rock = makeRock(sc)
      rock.position.set(x, groundNoise(x, z), z)
      rock.rotation.y = Math.random() * Math.PI
      decor.add(rock)
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? 1 : -1
      const x = side * (3.5 + (i % 5) * 1.8 + Math.random())
      const z = -12 + (i * 1.4) % 24
      if (Math.abs(x) < 2.5) continue
      const bush = makeBush(0.7 + Math.random() * 0.5)
      bush.position.set(x, groundNoise(x, z), z)
      decor.add(bush)
    }
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x1f6b3a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    })
    for (let i = 0; i < 80; i++) {
      const side = Math.random() > 0.5 ? 1 : -1
      const x = side * (2.8 + Math.random() * 14)
      const z = (Math.random() - 0.5) * 24
      if (Math.abs(x) < 2.2) continue
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 + Math.random() * 0.04, 0.25 + Math.random() * 0.2, 4),
        grassMat
      )
      blade.position.set(x, groundNoise(x, z) + 0.08, z)
      blade.rotation.y = Math.random() * Math.PI
      blade.rotation.z = (Math.random() - 0.5) * 0.25
      blade.castShadow = true
      decor.add(blade)
    }

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
          shape.lineTo((i / (n - 1)) * 10, h)
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
          color: side === 'bull' ? 0x12d992 : 0xff5568,
          emissive: side === 'bull' ? 0x0a5c3a : 0x5c1018,
          emissiveIntensity: 0.28,
          roughness: 0.28,
          metalness: 0.35,
          transparent: true,
          opacity: 0.88,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (side === 'bull') {
          mesh.rotation.y = Math.PI / 2
          mesh.position.set(8, 0.05, -5)
        } else {
          mesh.rotation.y = -Math.PI / 2
          mesh.position.set(-8, 0.05, 5)
        }
        mountainGroup.add(mesh)
        const peakH = 0.3 + (levels[0]!.qty / maxQ) * 7.5
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 12, 12),
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
        ;(c as THREE.Mesh).geometry?.dispose()
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
          const h = 0.4 + (l.qty / maxQ) * 3.2
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, h, 0.55),
            new THREE.MeshStandardMaterial({
              color: side === 'bull' ? 0x12d18a : 0xff4d63,
              emissive: side === 'bull' ? 0x064d32 : 0x4a1018,
              emissiveIntensity: 0.2,
              roughness: 0.4,
              metalness: 0.3,
              transparent: true,
              opacity: 0.75,
            })
          )
          const x = side === 'bull' ? 3.2 + i * 0.7 : -3.2 - i * 0.7
          mesh.position.set(x, h / 2 + 0.05, -8 + (i % 3) * 0.3)
          mesh.castShadow = true
          wallGroup.add(mesh)
        })
      }
      place(bids, 'bull')
      place(asks, 'bear')
    }
    rebuildWalls()

    function spawnUnit(side: 'bull' | 'bear', kind: UnitKind, hp: number) {
      const root = makeUnitModel(side, kind)
      const x = side === 'bull' ? 10 + Math.random() * 5 : -10 - Math.random() * 5
      const z = (Math.random() - 0.5) * 14
      root.position.set(x, 0.05, z)
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

    let lastMountains = showMountainsRef.current
    let lastBook = 0
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      controls.update()
      while (spawnQueue.current.length) {
        const j = spawnQueue.current.shift()!
        spawnUnit(j.side, j.kind, j.hp)
      }
      if (showMountainsRef.current !== lastMountains) {
        lastMountains = showMountainsRef.current
        rebuildMountains()
      }
      const now = performance.now()
      if (now - lastBook > 800) {
        lastBook = now
        if (showMountainsRef.current) rebuildMountains()
        rebuildWalls()
      }
      for (const u of unitsRef.current) {
        u.age += 1
        u.root.position.x += u.vx
        u.root.position.z += u.vz
        u.root.position.y = 0.05 + Math.abs(Math.sin(u.age * 0.15)) * 0.04
        u.root.rotation.y = Math.atan2(u.vx, u.vz)
      }
      unitsRef.current = unitsRef.current.filter((u) => {
        if (Math.abs(u.root.position.x) > 20 || u.hp <= 0 || u.age > 900) {
          scene.remove(u.root)
          return false
        }
        return true
      })
      for (let i = 0; i < unitsRef.current.length; i++) {
        for (let j = i + 1; j < unitsRef.current.length; j++) {
          const a = unitsRef.current[i]!
          const b = unitsRef.current[j]!
          if (a.side === b.side) continue
          const dx = a.root.position.x - b.root.position.x
          const dz = a.root.position.z - b.root.position.z
          if (dx * dx + dz * dz < 0.85) {
            a.hp -= 0.04
            b.hp -= 0.04
          }
        }
      }
      renderer.render(scene, camera)
    }
    tick()

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
        <label className="flex items-center gap-1.5 text-[10px] text-[#c8cdd5] px-2 py-1 rounded border border-[#2b3139] bg-[#0b0e11]/80">
          <span className="text-[#848e9c] uppercase tracking-wider text-[9px]">Montagne</span>
          <select
            className="bg-[#0b0e11] border border-[#2b3139] rounded px-1.5 py-0.5 text-[11px] text-[#eaecef] outline-none focus:border-[#f0b90b]"
            value={showMountains ? 'on' : 'off'}
            onChange={(e) => setShowMountains(e.target.value === 'on')}
            title="Montagne depth verdi (bid) / rosse (ask) — 3D scene + overlay 2D"
          >
            <option value="on">Visibili (verde / rosso)</option>
            <option value="off">Nascoste</option>
          </select>
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
            🖱 Orbit · Scroll zoom · Right-drag pan
          </button>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 text-[9px] font-mono pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40">
            ● GREEN = bids / bulls
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/40">
            ● RED = asks / bears
          </span>
        </div>
        {showMountains && (
          <DepthMountains2D bids={orderBook?.bids} asks={orderBook?.asks} />
        )}
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
