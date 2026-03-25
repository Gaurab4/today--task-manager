import { useEffect, useMemo, useRef } from 'react'
import type {
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import type { Theme } from '../lib/theme'

type Props = { theme: Theme }

const ROT_SPEEDS: [number, number][] = [
  [0.33, 0.48],
  [-0.28, 0.42],
  [0.41, -0.35],
  [0.36, 0.4],
]

function cornerSizePx(): number {
  if (typeof window === 'undefined') return 160
  return Math.min(200, Math.floor(window.innerWidth * 0.22))
}

export function CornerDecor({ theme }: Props) {
  const tl = useRef<HTMLDivElement>(null)
  const tr = useRef<HTMLDivElement>(null)
  const bl = useRef<HTMLDivElement>(null)
  const br = useRef<HTMLDivElement>(null)

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (prefersReducedMotion) return

    const slots = [tl.current, tr.current, bl.current, br.current]
    if (slots.some((el) => !el)) return

    let cancelled = false
    let dispose: (() => void) | undefined

    import('three').then((THREE) => {
      if (cancelled) return

      const geometries = [
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.OctahedronGeometry(1.1),
        new THREE.TorusGeometry(0.85, 0.35, 16, 32),
        new THREE.TorusKnotGeometry(0.65, 0.22, 64, 12),
      ]

      const color = theme === 'dark' ? 0x5c6370 : 0x8b909a
      const material = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.36,
      })

      type Sys = {
        renderer: WebGLRenderer
        scene: Scene
        camera: PerspectiveCamera
        mesh: Mesh
      }

      const systems: Sys[] = []
      let s = cornerSizePx()

      slots.forEach((el, i) => {
        if (!el) return
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
        camera.position.z = 3.2
        const mesh = new THREE.Mesh(geometries[i], material)
        scene.add(mesh)

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'low-power',
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(s, s)
        renderer.setClearColor(0x000000, 0)
        el.appendChild(renderer.domElement)
        systems.push({ renderer, scene, camera, mesh })
      })

      const clock = new THREE.Clock()
      let raf = 0

      function animate() {
        if (cancelled) return
        raf = requestAnimationFrame(animate)
        const t = clock.getElapsedTime()
        systems.forEach((sys, i) => {
          const [rx, ry] = ROT_SPEEDS[i]
          sys.mesh.rotation.x = t * rx
          sys.mesh.rotation.y = t * ry
          sys.renderer.render(sys.scene, sys.camera)
        })
      }
      animate()

      function onResize() {
        s = cornerSizePx()
        systems.forEach((sys) => {
          sys.renderer.setSize(s, s)
        })
      }
      window.addEventListener('resize', onResize)

      dispose = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
        geometries.forEach((g) => g.dispose())
        material.dispose()
        systems.forEach((sys) => {
          sys.renderer.dispose()
          sys.renderer.domElement.remove()
        })
      }
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [theme, prefersReducedMotion])

  if (prefersReducedMotion) return null

  return (
    <div className="corner-decor" aria-hidden>
      <div ref={tl} className="corner-decor__slot corner-decor__slot--tl" />
      <div ref={tr} className="corner-decor__slot corner-decor__slot--tr" />
      <div ref={bl} className="corner-decor__slot corner-decor__slot--bl" />
      <div ref={br} className="corner-decor__slot corner-decor__slot--br" />
    </div>
  )
}
