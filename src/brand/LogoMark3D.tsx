/**
 * Animated isometric 3D logo mark for NACS Lab Terminal.
 * Pure CSS + SVG — no WebGL dependency.
 */

interface LogoMark3DProps {
  size?: number
  /** Animate prism + rings */
  animated?: boolean
  className?: string
}

export function LogoMark3D({
  size = 48,
  animated = true,
  className = '',
}: LogoMark3DProps) {
  return (
    <div
      className={`nacs-logo3d ${animated ? 'nacs-logo3d--live' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="nacs-logo3d-scene">
        {/* Orbital rings */}
        <div className="nacs-logo3d-ring nacs-logo3d-ring--a" />
        <div className="nacs-logo3d-ring nacs-logo3d-ring--b" />
        <div className="nacs-logo3d-ring nacs-logo3d-ring--c" />

        {/* Isometric prism */}
        <div className="nacs-logo3d-prism">
          <div className="nacs-logo3d-face nacs-logo3d-face--top" />
          <div className="nacs-logo3d-face nacs-logo3d-face--left" />
          <div className="nacs-logo3d-face nacs-logo3d-face--right" />
          <div className="nacs-logo3d-core" />
        </div>

        {/* Floating particles */}
        <span className="nacs-logo3d-particle nacs-logo3d-particle--1" />
        <span className="nacs-logo3d-particle nacs-logo3d-particle--2" />
        <span className="nacs-logo3d-particle nacs-logo3d-particle--3" />
      </div>
    </div>
  )
}
