import { Composition } from 'remotion'
import { FPS, TOTAL, sec } from './config'
import { Cut15, Film } from './Film'
import { CatArt, type CatArtProps, TomatoArt } from './SiteArt'

export function Root() {
  return (
    <>
      <Composition id="BrandFilm" component={Film} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
      <Composition id="BrandFilmVertical" component={Film} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
      <Composition id="Cut15" component={Cut15} durationInFrames={sec(15)} fps={FPS} width={1920} height={1080} />
      <Composition id="Cut15Vertical" component={Cut15} durationInFrames={sec(15)} fps={FPS} width={1080} height={1920} />
      <Composition
        id="CatArt"
        component={CatArt}
        durationInFrames={1}
        fps={FPS}
        width={720}
        height={384}
        defaultProps={{ mood: 'working' } as CatArtProps}
      />
      <Composition id="TomatoArt" component={TomatoArt} durationInFrames={1} fps={FPS} width={128} height={104} />
    </>
  )
}
