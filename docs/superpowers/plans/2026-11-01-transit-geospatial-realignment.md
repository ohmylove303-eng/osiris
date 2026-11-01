# Transit Geospatial Realignment & Superpowers Integration Plan

**Date:** 2026-11-01  
**Author:** OSIRIS Autonomous Engineering Unit  
**Specification:** Physical grounding of all Korean transit corridors (buses, rail, metro, taxi) to dense road and track centerlines, eliminating all river cuts and land shortcuts, while verifying the full Superpowers skill suite under the Socratic 5-Gate Physical Truth Harness.

---

## 1. Problem Statement & Root Cause

### 1.1 Visual Defect Reported by User
In `media_1793527999121_210d55ea.jpg`:
- Transit lines (`3000번`, `M6117번`, `AREX`, `경의선 DMZ`, `7700번 BRT`) cut diagonally across the Han River, hills, and residential blocks.
- Bus markers (`3000번`, `BRT`) and trains appeared suspended over open water (e.g. over the Han River near Yangcheon Hyanggyo).

### 1.2 Root Cause Analysis (`systematic-debugging`)
- **Coarse Waypoints**: `src/lib/korean-transit.ts` used sparse station/interchange stops (10~20 coordinates across 30~50 km).
- **Linear Interpolation**: `interpolateRoutePosition()` moves vehicles in a straight line between successive waypoints; MapLibre draws straight chords.
- **Han River Crossing Errors**:
  - `bus-3000`: Jump from Gochon `[126.7550, 37.6010]` to Gaehwa `[126.7980, 37.5780]` sliced across the river mouth instead of hugging Route 48 (Gimpo-daero).
  - `rail-gyeongui-dmz`: Jump from DMC `[126.8990, 37.5690]` to Yongsan `[126.9640, 37.5300]` sliced straight across the Mapo bend of the Han River. The real Gyeongui Line tracks run entirely on the north bank through Gajwa, Hongik Univ, Sogang Univ, Gongdeok, and Hyochang Park.
  - `metro-arex`: Jump from Gimpo Airport `[126.8010, 37.5620]` to DMC `[126.8990, 37.5690]` cut across Gayang instead of crossing the Han River via the Magok Railway Bridge (`마곡철교`).
  - `bus-m6117`: Sparse Olympic Expressway points crossed into river water rather than tracing the curvature of the southern riverbank and Wonhyo Bridge.

### 1.3 Superpowers Tooling Root Cause
- The user had cloned or created `/Volumes/SAMSUNG/Superpowers-Selective-Validation`, but the skills (`writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`) were never symlinked into the Antigravity discovery path (`~/.gemini/config/skills/`) or indexed in the Samsung Autonomous Engine manifest (`/Volumes/SAMSUNG/.agents/system/manifest.json`).

---

## 2. Granular Task Breakdown

### Task 1: Complete Superpowers Skills Registration & Integrity (COMPLETED)
- Install `writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `using-superpowers`, and `brainstorming` into `~/.agents/skills/`.
- Symlink into `~/.gemini/config/skills/` and `/Volumes/SAMSUNG/.agents/skills/`.
- Run `jh-system scan` and verify that all 21 skills are indexed in `manifest.json`.

### Task 2: Dense Road & Rail Centerline Generation
- For road buses (`bus-3000`, `bus-m6117`, `bus-7700`, `bus-740`, `bus-273`, `bus-421`, `bus-150`, `bus-360`, `bus-9401`, `bus-70`, `bus-01`):
  - Precompute dense, curve-following road centerlines using local Valhalla/OSRM routing or curate high-density coordinates (20~80 points per corridor) following exact expressway lanes and bridge decks.
  - Enforce exact bridge deck crossings:
    - 3000번: Yanghwa Bridge (선유도 통과).
    - M6117번: Wonhyo Bridge (원효대교 중심 통과).
    - 740번: Seogang Bridge (서강대교 밤섬 횡단).
    - 421번 / 9401번: Hannam Bridge (한남대교).
    - 150번: Hangang Bridge (한강대교 노들섬 통과).
    - 70번: Choji Bridge (초지대교 강화 남단).
    - 7700번: Bongo-daero (봉오대로) BRT dedicated road, completely avoiding Gimpo Airport runways.
- For railways & metros (`rail-gyeongui-dmz`, `metro-arex`, `metro-line1`, `metro-line2`, `metro-line9`, `rail-ktx-gyeongbu`):
  - Gyeongui-Jungang Line: DMC -> Gajwa -> Sinchon -> Sogang Univ -> Gongdeok -> Hyochang Park -> Yongsan (100% north bank, zero water touch).
  - AREX: Gimpo Airport -> Magoknaru -> Magok Railway Bridge (마곡철교) -> DMC -> Hongik Univ -> Gongdeok -> Seoul Station.
  - Line 2: Dangsan Railway Bridge (당산철교) & Jamsil Railway Bridge (잠실철교).
  - Line 1 & KTX: Hangang Railway Bridge (한강철교 4복선 트러스교).

### Task 3: Unit Testing & Boundary Validation (`test-driven-development`)
- Create `src/lib/korean-transit-geometry.test.ts`.
- Test that:
  1. No road transit route point enters the Han River boundary unless it matches a known bridge centerline corridor.
  2. Gyeongui Line has 0 coordinates south of latitude 37.525 or across the Han River.
  3. AREX Han River crossing occurs strictly within the Magok Railway Bridge bounding box.
  4. 7700 BRT has 0 coordinates inside the Gimpo Airport runway security perimeter.
  5. All routes produce valid GeoJSON LineStrings with monotonically valid headings.

### Task 4: Regression & Tactical Backtest
- Run `npx tsc --noEmit` to ensure TypeScript strict compliance.
- Run `vitest run src/lib/korean-transit-geometry.test.ts`.
- Run `node scripts/test_tactical_layers_backtest.mjs` (all 49 tactical assertions).

### Task 5: Physical Truth Verification (`verification-before-completion`)
- Visual verification using browser capture to confirm zero floating vehicles and zero river cuts.
- Issue Socratic 5-Gate physical truth verdict.
- Commit, push, and update live deployment.
