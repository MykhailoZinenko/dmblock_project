# B12 Hero Barrier + Win Condition & B13 Activation Timer — Design Spec

## B12: Hero Barrier + Win Condition

### Game Logic (`frontend/src/game/actions/heroActions.ts`)

**Barrier**: `isBarrierUp(state, playerId)` → true if any alive friendly unit exists. When barrier is up, hero cannot be targeted.

**Hero position**: Off-grid markers. P1 hero behind col 0 (left edge), P2 hero behind col 14 (right edge). Not a board cell — purely visual + targeting anchor.

**Targeting**:
- `canAttackHero(state, attackerUid, targetPlayerId)` → valid when barrier down, attacker has AP
- Melee: attacker must be on the edge column adjacent to hero (col 0 for P1 hero, col 14 for P2 hero)
- Ranged: can attack from anywhere when barrier down (costs ammo)
- Buildings cannot attack hero

**Damage**: Hero has no defense/MR. Raw unit attack damage (with crit roll). Ranged penalty rules still apply (enemy half, melee blocked).

**Execute**: `executeHeroAttack(state, attackerUid, targetPlayerId)` → damage dealt, hero died, crit. Sets `remainingAp = 0`.

**Win condition**: `checkWinCondition(state)` → `{ winner: number } | null`. Called after every hero-damaging action (attack + timeout). Hero HP ≤ 0 = defeat.

### Rendering (BattleScene)
- Hero markers rendered off-grid at left/right edges with HP bars
- Shield/barrier glow when barrier is up, removed when last unit dies
- Floating damage numbers on hero marker when hit
- `showBarrierDown(playerId)` — visual flash/text when barrier drops

### UI (Battle.tsx)
- Hero HP bars in top HUD (next to mana bars)
- Hero as attackable target in highlights (red for melee edge hexes, red glow on hero marker for ranged)
- Game over overlay: "P1/P2 WINS" with restart button
- Win condition check after every attack, spell, and timeout

## B13: Activation Timer + Timeout

### Game Logic
- `applyTimeoutDamage(state, playerId)` in `heroActions.ts`
- Reads `PlayerState.timeoutCount`, applies damage: `TIMEOUT_DAMAGE[min(count, 3)]` → [3, 6, 12, 24]
- Increments `timeoutCount`
- Returns `{ damage, heroDied }`

### Timer (Battle.tsx — React state)
- `timerRef` tracks seconds remaining (starts at 45 on activation start)
- `setInterval` ticks every second
- Resets to 45 on any action (move, attack, spell, pass)
- On expiry: apply timeout damage → floating text + red vignette → auto-pass activation
- Timer paused during animations and priority phase
- Timer bar in top HUD — turns red + pulses when ≤ 10s

### Rendering (BattleScene)
- `showVignetteFlash()` — brief red screen-edge overlay for timeout
- Floating damage text on hero marker reused from B12

## Constants (already defined)
- `HERO_HP = 30`
- `ACTIVATION_TIMER_SECONDS = 45`
- `TIMEOUT_DAMAGE = [3, 6, 12, 24]`

## Shared Integration
Both features feed `PlayerState.heroHp`. Win condition check is the same function called from both paths. `GamePhase = 'GAME_OVER'` already exists in types.
