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
