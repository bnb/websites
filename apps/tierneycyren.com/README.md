# tierneycyren.com

tierney cyren's DJ site. Like tierney.camera, it reads everything live from the AT Protocol: the mixes are
`fm.plyr.track` records that [plyr.fm](https://plyr.fm) writes to the account's own repository, and the bio
is the `fm.plyr.actor.profile` record. Upload a mix to plyr.fm and it shows up here within five minutes.

## The page

- A masthead with the name in tall condensed Archivo, the plyr.fm bio, and laser fans behind it that pulse
  and sweep with the music (with a faint magenta strobe on drops, never more than three flashes a second)
- A marquee of the bio and every mix title (the shared `Marquee`, pausable), and a spectrum strip under it
- Every mix, newest first and numbered up from the oldest: its cover as the label of a record that spins
  while it plays (drag it to scrub, tap to play or pause), title, length with a bar to scale against the
  longest mix, date, format, description, and a native audio player. Players load nothing until pressed
  (`preload="none"`), stream from plyr.fm's CDN with the raw blob from the PDS as the fallback, and starting
  one stops the others. Both sources send CORS headers, so the players are `crossorigin="anonymous"` and Web
  Audio can analyse them.
- A now-playing bar once a mix has played, and lock-screen controls (Media Session)
- A footer with the mix count and total running time, and the wordmark
- A share card at `GET /og.png`, empty and outage states, an error page with the needle up, a skip link,
  `GET /healthz`

Everything that moves is still for reduced motion.

## Where things are

| | |
| --- | --- |
| `src/lib/plyr.ts` | reads the records and turns them into mixes (`assembleMixes` is pure and unit-tested) |
| `src/lib/server/crate.ts` | the five-minute stale-while-revalidate cache, with 8 s request timeouts |
| `src/lib/format.ts` | running times, dates, numbering, the marquee, the mix summary and length scale |
| `src/lib/player.svelte.ts` | what's playing, shared by the records, the bar and the lock screen; one mix at a time |
| `src/lib/audio.ts` | the one AudioContext and analyser, and the frame loop the visuals draw from |
| `src/lib/levels.ts`, `src/lib/platter.ts` | the pure parts: bass energy, spectrum bands, drop detection, the strobe cap; the record's angle to time |
| `src/lib/server/card.ts` | the share card (satori + resvg), served by `src/routes/og.png` |
| `src/lib/site.ts` | the name, the plyr.fm profile, and `BOOKING_EMAIL` |
| `src/lib/components/` | `Masthead`, `Mix`, `MixList`, `Record`, `Spectrum`, `NowPlaying`, `SiteFooter` and their stories |

Set `BOOKING_EMAIL` in `src/lib/site.ts` to add a booking address to the footer.

## Scripts

```sh
npm run dev           # http://localhost:5175
npm run build         # adapter-node build in build/
npm run preview       # http://localhost:4175
npm run check
npm run test:unit
npm run test:coverage
npm run test:e2e      # Playwright, with axe on a laptop and a phone
npm run lighthouse
```

## Deploy

`npm run build`, then `node build` (serves on `$PORT`). On Railway: build command `npm run build -w
apps/tierneycyren.com`, start command `node apps/tierneycyren.com/build`, healthcheck path `/healthz`, and the
`tierneycyren.com` domain.
