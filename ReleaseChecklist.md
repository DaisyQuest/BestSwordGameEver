# Release Checklist

## Build & Packaging
- [ ] Install dependencies (`npm install`) with a clean lockfile.
- [ ] Verify `npm start` serves the demo without errors.
- [ ] Confirm static hosting works from `/client` for simple deployments.

## Gameplay & Balance
- [ ] Review stamina drain/regeneration pacing across sprint and idle loops.
- [ ] Validate balance/posture transitions during rapid direction changes.
- [ ] Confirm weapon reach visuals align with pose data for each weapon type.

## Visual & UX
- [ ] Check HUD readability at common screen sizes (1366x768, 1440x900, 1920x1080).
- [ ] Ensure camera focus keeps both combatants visible during movement extremes.
- [ ] Validate color contrast for stamina and posture indicators.

## Accessibility & Controls
- [ ] Confirm keybindings match documentation in `HOWTO_PLAY.md`.
- [ ] Verify sprint and reset inputs work on multiple keyboard layouts.
- [ ] Audit UI text sizing for readability on smaller screens.

## Testing & Quality Gates
- [ ] Run `npm run test:coverage` and confirm no regressions.
- [ ] Review coverage report and address new gaps introduced since last release.
- [ ] Capture baseline screenshots if visual regression tooling is available.

## Documentation
- [ ] Update `WELCOME.md` and `HOWTO_PLAY.md` for any gameplay or control changes.
- [ ] Review `OverallProgressReport.md` and `StillToDo.md` for release alignment.
- [ ] Prepare a short release note summary for stakeholders.
