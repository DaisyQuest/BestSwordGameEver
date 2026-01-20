# How to Play - Best Sword Game Ever Demo

## Run the demo locally

1. Install dependencies (once):
   ```bash
   npm install
   ```
2. Start the demo server from the repo root:
   ```bash
   npm start
   ```
   or start a static file server (any one of these works):
   ```bash
   python -m http.server 8000
   ```
   or
   ```bash
   python3 -m http.server 8000
   ```
3. Open the demo in your browser:
   - If you used `npm start`, visit:
     ```
     http://localhost:5173/
     ```
   - If you used a static server, visit:
     ```
     http://localhost:8000/client/
     ```

## Controls

- **W / A / S / D**: Move around the arena.
- **Shift**: Sprint (drains stamina).
- **R** or **Reset Match**: Restart the session.
- **M**: Toggle reduced motion mode.

## Accessibility & comfort

- The stamina bar color shifts when exhausted; keep an eye on the text readout if color contrast is hard to see.
- If motion makes you uncomfortable, reduce browser zoom or shrink the window to limit the visible arena.

## Gameplay tips

- Sprinting consumes stamina quickly. When stamina is low, the hero slows down.
- The sparring partner patrols the arena, so keep your footing and stay inside the circle.
- If you hit the arena boundary, you will bounce back toward the center.
