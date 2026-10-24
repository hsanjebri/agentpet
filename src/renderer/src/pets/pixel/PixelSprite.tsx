import './pixel.css'
import type { CSSProperties } from 'react'
import { type Layer, PAD, type PixelMap, toRuns } from './canvas'

interface Props {
  className: string
  width: number // drawing size in cells (without the outline border)
  height: number
  /** screen pixels per cell; integers keep the art crisp */
  scale: number
  palette: Readonly<Record<string, string>>
  /** layers that move with the pet and count as "the pet" for mouse hits */
  sprite: Layer[]
  /** floating extras drawn on top (never catch the mouse) */
  effects: Layer[]
}

function Cells({ map, palette }: { map: PixelMap; palette: Props['palette'] }): React.JSX.Element {
  return (
    <>
      {toRuns(map).map((run) => (
        <rect
          key={`${run.x},${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={palette[run.key] ?? '#FF00FF'}
        />
      ))}
    </>
  )
}

function LayerGroup({
  layer,
  palette
}: {
  layer: Layer
  palette: Props['palette']
}): React.JSX.Element {
  const frames = layer.frames.length
  const style = layer.speed ? ({ '--frame-speed': layer.speed } as CSSProperties) : undefined

  return (
    <g className={`layer ${layer.name}`} style={style}>
      {layer.frames.map((frame, i) => (
        <g
          key={i}
          className={frames > 1 ? `frame frames-${frames}` : 'frame'}
          // frame i is visible during the i-th slice of the cycle
          style={
            frames > 1
              ? {
                  animationDelay: `calc(var(--frame-speed) * ${-((frames - i) % frames) / frames})`
                }
              : undefined
          }
        >
          <Cells map={frame} palette={palette} />
        </g>
      ))}
    </g>
  )
}

/** Renders pixel layers as crisp SVG rects; 1 SVG unit = 1 cell. */
export function PixelSprite({
  className,
  width,
  height,
  scale,
  palette,
  sprite,
  effects
}: Props): React.JSX.Element {
  const w = width + 2 * PAD
  const h = height + 2 * PAD

  return (
    <svg
      className={`pixel-sprite ${className}`}
      width={w * scale}
      height={h * scale}
      viewBox={`${-PAD} ${-PAD} ${w} ${h}`}
      shapeRendering="crispEdges"
    >
      <g className="sprite" data-pet-hit="">
        {sprite.map((layer) => (
          <LayerGroup key={layer.name} layer={layer} palette={palette} />
        ))}
      </g>
      <g className="effects">
        {effects.map((layer) => (
          <LayerGroup key={layer.name} layer={layer} palette={palette} />
        ))}
      </g>
    </svg>
  )
}
