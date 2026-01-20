# Best Sword Game Ever - Game Specification

## 1. Vision & Goals
Build a physics-based fighting game that prioritizes deterministic simulation, modularity, and server-authoritative multiplayer. The experience centers on tactile, physics-driven melee combat with realistic armor, anatomy damage, and limb loss. The player is a stylized ovaloid humanoid with separated body-part geometries and a rich internal-organ model. The game runs in the browser via Three.js, can run headless, and supports extensive testing and automation.

### Core Goals
- **Physics-first combat**: Combat quality is driven by deterministic physics rather than animation.
- **Highly modular architecture**: Feature toggles allow selectively enabling/disabling systems for testing, performance, or product tiers.
- **Server-authoritative multiplayer**: The server owns canonical state; clients are prediction/visualization.
- **Complete testability**: Headless mode and deterministic simulation allow repeatable tests.
- **Scalable AI**: Pluggable AI “brains” for NPCs with adjustable difficulty and future extensibility.
- **Robust data and persistence**: User registration, loadouts, cosmetics, and progression stored in MongoDB.

---

## 2. Platform & Tech Stack
- **Runtime**: Node.js (server and deterministic simulation runtime).
- **Rendering**: Three.js (client-side rendering).
- **Networking**: WebSocket + authoritative game server.
- **Database**: MongoDB (user data, loadouts, cosmetics).
- **Testing**: Node.js test runner (Jest or Vitest), deterministic simulation test harness.
- **Deployment**: Azure (server hosting, matchmaking services, database integration, CI/CD).

---

## 3. Player Controls
### 3.1 Core Movement
- **WASD**: Move (physics-driven locomotion).
- **Space**: Kick with primary leg.
- **Shift + Space**: Kick with secondary leg.

### 3.2 Hand/Arm Control
- **Left click**: Raise left hand and bind it to mouse tracking.
- **Right click**: Raise right hand and bind it to mouse tracking.
- **Left + Right click**: Raise both hands.
- **Double left click**: Left-hand thrust attack.
- **Double right click**: Right-hand thrust attack.
- **Double left + right click**: Two-handed thrust attack.

### 3.3 Grabbing
- **Q**: Attempt grab with left hand.
- **E**: Attempt grab with right hand.

### 3.4 Keybind Remapping
- All keybinds and mouse bindings are remappable via in-game configuration and stored per user.

---

## 4. Character Anatomy & Damage Model
### 4.1 Body Parts
Primary components:
- Head
- Torso (upper + lower)
- Left/Right Arm (upper arm, forearm, hand)
- Left/Right Leg (thigh, shin, foot)

### 4.2 Internal Organs
Each torso region contains internal organs with hitboxes and damage states:
- Brain (in head)
- Heart (upper torso)
- Lungs (upper torso)
- Liver (upper abdomen)
- Kidneys (mid-lower back region)

### 4.3 Damage Types
- **Blunt damage**: Causes internal trauma, fractures, bruising, and limb dysfunction.
- **Sharp damage**: Causes bleeding, penetrating damage, and can sever limbs.

### 4.4 Limb Loss and Dysfunction
- **Blunt threshold**: Limb becomes impaired (reduced force, reduced accuracy).
- **Sharp threshold**: Limb can be severed; severed limbs stop responding to player control.

### 4.5 Organ Damage Effects
- **Brain**: Loss of consciousness; fatal threshold.
- **Heart**: Bleeding/fatal threshold, stamina loss.
- **Lungs**: Reduced stamina, forced limp if breathing compromised.
- **Liver/Kidneys**: Progressive debuffs and eventual fatality if untreated.

### 4.6 Leg Injury Effects
- Leg injuries cause limping, reduced balance, increased stumble risk.

---

## 5. Armor & Weak Points
### 5.1 Armor Layers
- **Outer armor**: Primary mitigation for blunt/sharp.
- **Padding/underlayer**: Reduces blunt trauma.

### 5.2 Weak Points
- Gaps in armor (joints, underarms, neck, visor, groin).
- Strikes landing in weak points apply higher damage multipliers.

---

## 6. Weapon System
### 6.1 Weapon Types
- Blunt weapons (maces, clubs)
- Swords
- Daggers
- Shields
- Spears
- Halberds
- Greatswords

### 6.2 Weapon Attributes
- **Sharpness** (affects penetration and severing)
- **Mass** (affects blunt force)
- **Length** (affects reach and leverage)
- **Balance** (affects control and swing speed)

### 6.3 Simple Geometry
Weapons can be represented as simple polygon meshes initially.

---

## 7. Player Customization & Class Creation
### 7.1 Custom Colors
Players can customize color schemes for armor, body, and gear.

### 7.2 Class Creation
- Player selects armor and weapons.
- **20 points** to spend on equipment.
- Each item has a point cost based on stats and rarity.

### 7.3 Persistence
- User registration and data stored in MongoDB.
- Loadouts, keybinds, and preferences saved per account.

---

## 8. Multiplayer Requirements
### 8.1 Networked Multiplayer
- Fully server authoritative.
- Client prediction with reconciliation.
- Deterministic simulation to ensure consistent state across clients.

### 8.2 Matchmaking & Social
- Matchmaking services for quick play.
- Friends list with invite and join capabilities.
- Public chat (lobby/global).
- Private chat (DM, party chat).

---

## 9. NPCs & AI
### 9.1 NPC Support
- NPCs can use the same physics and combat systems as players.

### 9.2 Pluggable AI Brain
- AI is implemented as interchangeable “brain” modules.
- Difficulty scaling by changing reaction time, aggressiveness, and prediction depth.
- Brain interface supports future extensions (tactical AI, team behaviors, learning AI).

---

## 10. Deterministic Physics & Headless Simulation
### 10.1 Deterministic Simulation
- Fixed time step.
- Deterministic input stream from authoritative server.
- Deterministic collision resolution and weapon interactions.

### 10.2 Headless Mode
- Runs without rendering for CI/testing.
- Used for simulation tests, AI tests, and network sync tests.

---

## 11. Architecture Principles
### 11.1 Modular Systems
All game features are implemented as independent modules with clear interfaces and dependency injection.

### 11.2 Feature Toggles
- Feature flags allow turning systems on/off (e.g., limb loss, organ damage, networked chat, NPCs).
- Build-level toggles for dev/test/perf.

### 11.3 Layered Design
- **Core Simulation Layer**: Physics, damage, collisions, deterministic update.
- **Gameplay Layer**: Rules, scoring, win/loss conditions.
- **Presentation Layer**: Rendering, UI, VFX.
- **Network Layer**: Authoritative server, replication, prediction.

---

## 12. Testing & Quality Requirements
- **95%+ branch coverage** target for all game code, with a long-term goal of full branch coverage where feasible.
- Deterministic simulation tests for physics and damage.
- Network sync tests to ensure reproducibility.
- Headless CI tests for all physics and multiplayer logic.
- Combat regression tests for weapon/armor/organ interactions.

---

## 13. Non-Functional Requirements
- **Performance**: Supports 60 FPS client-side for typical matches.
- **Scalability**: Server architecture supports multiple matches concurrently.
- **Security**: Server authoritative to prevent cheating; input validation on server.
- **Maintainability**: Highly modular, documented, and feature-flagged systems.
- **Deployment**: Cloud-hosted on Azure with environments for dev/test/prod and automated rollouts.

---

## 14. Open Questions
- Exact physics library for deterministic simulation (custom vs physics engine).
- How to handle authoritative rollback vs client-side prediction complexity.
- Schema for weapon/item data.
- Required external services for matchmaking and chat.

---

## 15. Deliverables (This Phase)
- `game_spec.md` (this document).
- `spec_implementation_checklist.md` (actionable implementation steps).
