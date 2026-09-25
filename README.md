# Woodshed

A desktop practice tutor built with Tauri, React and TypeScript. It covers seven practice paths (Rhythm Guitar, Lead Guitar, Bass Guitar, Piano, Clean Vocals, Extreme Vocals and Ukulele), a tab library with play-along, and a tuner. Rhythm, Lead and Bass also have genre sections (blues, rock, metal, punk, funk, reggae and ska, country, jazz). Press `?` on the Home screen to see every feature and keyboard shortcut.

## Video tutorials

The genre skills in Rhythm, Lead and Bass, and every Clean Vocals, Extreme Vocals and Ukulele skill, have a **Tutorial** section on their setup screen. It picks a helpful YouTube video for the skill and shows two alternatives.

### How a video is picked

YouTube no longer shares dislike counts, so each video is scored on what the API still provides:

1. **Views**, on a log scale so a 10M-view video doesn't automatically beat a 200k-view one.
2. **Like rate** (likes per view). Small videos are pulled toward a typical rate, so a handful of likes on a few views can't win on a lucky ratio.
3. **Comments.** For the top 5 candidates, 50 of the most relevant comments are read. Comments like "this finally clicked" count for a video and comments like "my throat hurts" or "lost my voice" count against it. Comments with more likes count for more, and phrases like "doesn't hurt" are treated as praise.

Shorts (under 2 minutes), videos over an hour and videos under 1,000 views are skipped. The ranking logic and its tests are in `src-tauri/src/tutorials.rs`.

Picks are cached in the `skill_tutorials` table for 14 days. The **Refresh** button searches again.

### Watching in the app

**Watch** plays the video in its own Woodshed window, which closes when Woodshed closes. **Open on YouTube** opens it in your browser instead. So do links inside the player, such as the title, the channel and up-next videos. Videos whose uploader blocks embedding always open in the browser.

The player can't be an iframe in the main window. YouTube's embed refuses to play (Error 153) without an http(s) Referer, and release builds serve the app from `tauri://localhost`, which doesn't send one. So the player window loads a small page with the base URL `https://com.woodshed.app/`, built from the app identifier. This is how YouTube asks native apps to identify themselves. It works through WebKitGTK's `load_html`, so for now in-app playback is Linux-only; other platforms open the browser. The logic is in `src-tauri/src/player.rs`.

### Setup

Video picking needs a YouTube Data API key:

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **YouTube Data API v3** and create an API key.
2. Add it to `src-tauri/.env` (this file is ignored by git):

   ```
   YOUTUBE_API_KEY=your-key
   ```

3. Restart `npm run tauri dev`, since the key is read at startup.

Without a key, the Tutorial section shows a **Search YouTube** button instead.

Each new pick uses about 106 of the 10,000 free daily quota units. A skill's video is only picked when you open it, but picking for all 65 skills that have a tutorial would cost about 6,900.

### Adding a tutorial to another skill

Give the skill a `tutorial_query` in its `config` in a new migration. The Tutorial section appears on any skill that has one:

```sql
UPDATE skills
SET config = config || '{"tutorial_query": "barre chord tutorial"}'::jsonb
WHERE id = 'rhythm.barre_chords';
```

## Vocal mic checks

Every Clean Vocals and Extreme Vocals skill has a **Mic check** under its tutorial. You do a short exercise into a mic and Woodshed scores it from the live pitch and level readings:

- **Pitch:** whether a held note is on the target (in any octave) or centered on a real note, how steady it stays, and whether it drifts flat as the breath runs out.
- **Sustain:** how long one breath or one note lasts, and how evenly.
- **Vibrato:** speed and width.
- **Safety, for screams, fry and belting:** loudness against your own speaking level (measured once by counting to ten), bursts that run long, too little rest between them, and a clipping input. After each of these checks it asks whether anything scratched or hurt.

A mic hears the sound, not what the throat is doing, so the safety readings are signs to back off, not a diagnosis. Mic checks use their own input setting and skip guitar interfaces; a USB mic gives the steadiest readings. Scoring is in `src/lib/voiceCheck.ts` and each skill's check is its `mic_check` config (see migration `0014`). Nothing is recorded.

## Development

```
npm install
npm run tauri dev   # run the app
npm test            # frontend tests
cd src-tauri && cargo test
```

The app needs Postgres. It connects to a local `woodshed` database by default. To use a different one, set `DATABASE_URL` in `src-tauri/.env`. Migrations run on startup.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
