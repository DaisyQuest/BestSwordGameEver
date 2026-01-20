# How to Play - Best Sword Game Ever Demo

## Run the demo locally

1. Install dependencies (once):
   ```bash
   npm install
   ```
2. Start a static file server from the repo root (any one of these works):
   ```bash
   python -m http.server 8000
   ```
   or
   ```bash
   python3 -m http.server 8000
   ```
3. Open the demo in your browser:
   ```
   http://localhost:8000/client/
   ```

## Controls

- **W / A / S / D**: Move around the arena.
- **Shift**: Sprint (drains stamina).
- **R** or **Reset Match**: Restart the session.

## Gameplay tips

- Sprinting consumes stamina quickly. When stamina is low, the hero slows down.
- The sparring partner patrols the arena, so keep your footing and stay inside the circle.
- If you hit the arena boundary, you will bounce back toward the center.
