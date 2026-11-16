# AGENTS.md — Beam in the Dark

## Project
- **Title:** Beam in the Dark.
- **Genre:** Gothic top-down 3D stealth-horror with stylized low-poly visuals inspired by *Little Nightmares* and *My Mini Mart*.
- **Core loop:** Explore modular dungeon/castle floors, find a golden key, reach the exit, manage flashlight battery, and evade or slow monsters with light.
- Target desktop browsers, mobile browsers, and Telegram Mini Apps.

## Stack and constraints
- Keep the game a static website deployable to GitHub Pages, without a build step, npm dependencies, bundlers, or `node_modules`.
- Use vanilla JavaScript and native ES modules (`<script type="module">`).
- Load Three.js and NippleJS from a CDN through an import map or script tag. Pin exact versions when first adding them; keep Three.js addons on the same version. Update dependencies only as a separate, explicit task.
- Use relative project URLs that also work under a GitHub Pages repository subpath.
- Create models and visual assets procedurally. Synthesize sound with Web Audio API. Do not add downloaded models, textures, or audio without user approval.
- Run locally through an HTTP server, not `file://`.

## Module boundaries
Start with the following files as their functionality is implemented. Do not create empty scaffolding for later stages.
- `index.html`: Layout, HUD, overlays, dependency declarations, and module entry point.
- `style.css`: Dark gothic styling, responsive layout, touch controls, and safe-area spacing.
- `main.js`: Renderer, scene, fog, camera, the single animation loop, game state, floor transitions, and module coordination.
- `map.js`: Room templates, floor generation, map geometry, wall colliders, and spawn/item/exit placement data. It does not own the HUD or game-state transitions.
- `entities.js`: Player and monster creation and updates, flashlight behavior, and movement collision handling, until these need separate modules.

Keep modules focused. Extract a subsystem such as input, audio, UI, collision, or monster AI when it becomes independently substantial. Routine module extraction does not require approval. Avoid files for individual trivial functions, speculative abstractions, and circular imports. Pass dependencies explicitly.

## Development scope
- Implement only the requested stage. Preserve working mechanics and keep changes relevant to the task.
- Prefer validating movement, collisions, flashlight, one enemy, key, and exit on a small fixed map before procedural generation, unless the user requests a different order.
- Keep the roadmap and agreed gameplay rules in `README.md`; keep this file focused on development instructions. Do not silently change agreed rules.
- The run format (finite or endless), difficulty progression, empty-battery behavior, mobile aiming scheme, restart layout, and record semantics remain design decisions until agreed. Ask when an unresolved choice materially affects the requested stage; do not block unrelated work.

## Runtime and gameplay rules
- Use elapsed time for movement, battery consumption, and AI timers. Normalize diagonal movement. Bound simulation steps after stalls so entities cannot jump through walls.
- Use a circular player collider against wall bounds, with sliding along walls. Keep collision data separate from rendered models.
- Maintain explicit game states for play, pause, floor completion, and defeat. Completion and defeat overlays stop gameplay; restarting resets all floor-specific state.
- On focus loss or backgrounding, clear held input and pause gameplay. Resume with a fresh time baseline and an explicit player action.
- Keep exactly one animation loop. Restarting or changing floors must not duplicate event listeners, controls, audio nodes, or timers.
- Walls block monster vision and the flashlight's slowing effect. Evaluate gameplay visibility explicitly; do not infer it from rendered shadows.
- Enemies must navigate around walls. Define loss-of-sight behavior explicitly rather than granting permanent knowledge of the player.
- Generated floors must have connected walkable areas and reachable key and exit positions. Validate reachability before starting play. Use bounded generation retries and a valid fallback map.
- Prefer separate branches for key and exit where possible; provide valid placement when the generated layout has no suitable branches.
- Make procedural generation reproducible with a seed for debugging.

## Controls and presentation
- Desktop: WASD/arrows for movement and mouse aiming. Mobile: NippleJS movement and the agreed aiming scheme. Do not silently choose between movement-based aiming and a second stick.
- Prevent page scrolling and browser gestures on gameplay controls while preserving normal interaction with menus. Clear input on pointer cancellation.
- Keep the player, nearby obstacles, and interactive items readable in the dark. Use exponential fog and a subtle player light without relying on total darkness for difficulty.
- Follow the player smoothly with frame-rate-independent camera interpolation. Ensure nearby walls do not obscure essential action from the angled camera.
- Handle viewport resize and orientation changes, updating renderer dimensions and camera projection.

## Performance and resource ownership
- Reuse geometries, materials, and temporary vectors. Avoid per-frame object allocation and do not create geometry or materials in the update loop.
- Bound renderer pixel ratio and shadow resolution for mobile devices. Provide a lower-quality path; keep shadow-casting lights limited. Prefer soft shadows when the chosen Three.js version and device support them.
- Each subsystem owns cleanup of its resources. On floor replacement, remove obsolete objects and dispose of resources that are no longer used. Do not dispose of shared resources still in use.
- Stop obsolete sound sources and disconnect unused audio nodes. Start or resume Web Audio after a user gesture; provide a mute control when audio is added.

## Browser and Telegram integration
- Keep all core gameplay functional without Telegram.
- Feature-detect the SDK and each optional method, for example `window.Telegram?.WebApp?.expand?.()`. Gate version-dependent behavior on SDK support and handle unsupported features gracefully.
- `expand()` expands the Mini App height; it is not fullscreen. Use `requestFullscreen()` only when supported, and do not make fullscreen mandatory.
- Use supported haptic feedback for significant events, not every update. Respect Telegram safe areas when placing controls.
- Guard `localStorage` reads and writes and validate loaded values. Unavailable or malformed storage must not prevent play.
- Show a readable error if required dependencies or WebGL cannot initialize.

## Verification and handoff
- Serve locally, for example with `python3 -m http.server 8000`, and verify the implemented stage in a browser.
- Check for module, runtime, and WebGL errors in the console.
- As the relevant mechanics become available, verify:
  - Movement, diagonal speed, aiming, wall sliding, and corners/doorways.
  - Key pickup, locked exit, floor completion, defeat, and restart state.
  - Monster occlusion, navigation, loss of sight, and reaction to light.
  - Map connectivity, reachable objectives, and deterministic seed reproduction.
  - Repeated restarts and floor transitions without duplicated updates or growing live resource counts.
  - Touch input, pointer cancellation, viewport resize, background/resume, and mute.
  - Operation outside Telegram and storage failure handling.
- Add focused automated checks for algorithmic behavior such as generation reachability or collision edge cases when useful. Keep visual and interaction checks in the browser.
- Report what changed, what was actually verified, and any remaining limitations. Distinguish desktop touch emulation from testing on a real mobile device. Never claim a check passed if it was not run.
