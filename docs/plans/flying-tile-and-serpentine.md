# Plan: Animación de ficha voladora + Serpentine real

## Context

Hoy, cuando un jugador coloca una ficha en el dominó:

- La ficha aparece en su slot final con un `SlideIn{Up,Down,Left,Right}.duration(280)` desde el borde adyacente del Board (lógica en [Board.tsx:47-54](../../apps/mobile/src/components/game/Board.tsx#L47-L54), aplicada en [Board.tsx:97-118](../../apps/mobile/src/components/game/Board.tsx#L97-L118)). El SlideIn entra desde el borde de la pantalla más cercano al asiento — no desde la posición real del asiento — y dura muy poco, así que no se "siente" que la ficha viene del jugador.
- La cadena es 100% vertical, dentro de un `ScrollView` que crece sin fin. Cuando hay muchas fichas, la cadena se sale visualmente del área de la mesa (no hay codos / serpentine real). El layout reside en [Board.tsx:91-122](../../apps/mobile/src/components/game/Board.tsx#L91-L122).

Queremos:

1. **Animación de ficha voladora (Opción A confirmada)**: una copia animada de la ficha viaja desde el `PlayerSeat` del jugador que la jugó hasta el extremo de la cadena donde se asentó (~600ms, con float/rotación sutil). Mientras vuela, el slot estático queda reservado pero invisible.
2. **Serpentine real (Opción 1 confirmada)**: la cadena se dobla 90° cuando llega al borde del área jugable, formando segmentos en S — como un dominó real.

Resultado esperado: cuando un oponente juega, ves la ficha "saliendo" de su asiento y aterrizando en la cadena; y la cadena nunca se sale de la mesa porque serpentea.

## Critical files

- [apps/mobile/src/components/game/Board.tsx](../../apps/mobile/src/components/game/Board.tsx) — reescribir layout a serpentine; exponer posición de cada slot.
- [apps/mobile/src/screens/GameScreen.tsx](../../apps/mobile/src/screens/GameScreen.tsx) — orquestar overlay de animación; medir asientos; ajustar `DropGhost` a los extremos serpentine.
- [apps/mobile/src/components/game/DropGhost.tsx](../../apps/mobile/src/components/game/DropGhost.tsx) — recibir posición/orientación del extremo activo (ya no asumir vertical pura).
- **Nuevo**: `apps/mobile/src/components/game/FlyingTileLayer.tsx` — overlay que renderiza una ficha animada origen → destino.
- [apps/mobile/src/store/game.ts](../../apps/mobile/src/store/game.ts) — verificar que `publicState.lastEvent` y `stateVersion` están expuestos (ya lo están según `PublicState` en [packages/game-core/src/types.ts:22-36](../../packages/game-core/src/types.ts#L22-L36)).

Reutilizamos:

- [DominoTile](../../apps/mobile/src/components/DominoTile.tsx) con sus props `flipped` y `orientation`.
- `enteringForPosition` / `getSeatPosition` — `getSeatPosition` queda; `enteringForPosition` se elimina (lo reemplaza el overlay).
- `publicState.lastEvent` + `stateVersion` para detectar la jugada más reciente sin tocar el engine.

---

## Parte 1 — Animación de ficha voladora

### Arquitectura

1. **Detectar jugada nueva** en `GameScreen`:
   - Subscribir a `publicState.stateVersion` + `publicState.lastEvent`.
   - `useEffect` que compara contra la versión vista anteriormente; si `lastEvent.type === 'PLAYED'`, dispara animación con `{ seat, tile, end, tileId }`.
   - Estado local: `animatingTile: { tile, fromSeat, end } | null`.

2. **Medir origen (asiento del jugador)**:
   - Añadir `onLayout` a cada wrapper de `PlayerSeat` ([GameScreen.tsx:216-232](../../apps/mobile/src/screens/GameScreen.tsx#L216-L232)) y guardar `seatRects: Record<SeatPosition, {x,y,w,h}>` en estado.
   - Usar `measureInWindow` o el `onLayout` del seatsLayer absoluto para obtener coordenadas relativas al `GameTable`.

3. **Medir destino (slot final)**:
   - El Board ya conoce el layout de cada ficha porque vamos a calcularlo (ver Parte 2). Añadir callback `onTileLayout(tileId, rect)` que reporta cada slot al padre — o exponer una función `getSlotForTile(tileId)` vía ref imperativo.
   - Para el `end` recién jugado: usar `boardRect` + `chainBounds` (ya existe en [GameScreen.tsx:124-131](../../apps/mobile/src/screens/GameScreen.tsx#L124-L131)) más la nueva info de serpentine para saber dónde queda el tile.

4. **Renderizar `FlyingTileLayer`**:
   - Componente full-screen, `pointerEvents="none"`, encima de `Board` pero debajo del `DragLayer`.
   - Cuando hay `animatingTile`, monta un `Animated.View` con un `DominoTile` adentro.
   - Animaciones con Reanimated:
     - `translateX/Y`: de origen → destino con `withTiming(duration: 600, easing: Easing.out(Easing.cubic))`.
     - `scale`: arranca en 1.15 (más grande para "flotar cerca de la cámara"), aterriza en 1.0.
     - `rotateZ`: pequeña rotación inicial (~-5°) que vuelve a 0°, simula caída natural.
     - `translateY` adicional con `withSequence`: pequeño bump hacia arriba al inicio (-12px) que vuelve a 0, simula flotar.
   - Al terminar (~600ms) → `runOnJS(setAnimatingTile)(null)`.

5. **Ocultar slot estático mientras la copia vuela**:
   - Pasar `hiddenTileId` al `Board`. La ficha con ese id renderiza con `opacity: 0` (sigue ocupando espacio para no desordenar el layout).
   - Al limpiar `animatingTile`, el slot estático queda visible con un fade-in suave (`FadeIn.duration(120)`).
   - Quitar la lógica `enteringForPosition` / `SlideIn*` en Board (la reemplaza este overlay; el opener queda con `FadeIn` simple).

### Casos borde

- **Tu propia jugada**: también se anima desde tu asiento sur — usuario ve consistencia visual.
- **Opener (`end === 'start'`)**: anima desde el asiento de quien abrió hacia el centro del tablero.
- **Reconnect / hidratación inicial**: si recibimos varios stateVersion saltados (ej. al entrar a la sala), NO animar — solo animar cuando la diferencia de versión es 1.
- **Pasar (PASSED)**: no anima (no hay ficha).
- **Doble fast-play**: si entra una segunda jugada antes de que termine la anterior, mantener una cola o simplemente saltar la primera animación.

---

## Parte 2 — Serpentine real

### Arquitectura

El engine en [packages/game-core/src/state.ts:115-159](../../packages/game-core/src/state.ts#L115-L159) ya nos da una cadena lógica con `end: 'left' | 'right' | 'start'` y `flipped` correcto. **No tocamos el engine.** Toda la lógica de serpentine vive en el cliente, dentro de `Board.tsx`.

### Algoritmo de layout

1. **Contenedor acotado**: el `Board` deja de usar `StyleSheet.absoluteFillObject`. En su lugar, recibe (o calcula con `onLayout`) un `playArea = { w, h }` que es el área jugable de la mesa (con un padding interior para no pegarse al borde).

2. **Construir lista ordenada**:
   - Usar `orderForRender` que ya existe ([Board.tsx:35-45](../../apps/mobile/src/components/game/Board.tsx#L35-L45)). Eso da el orden visual de izquierda-a-derecha de la cadena lógica.

3. **Calcular segmentos de serpentine**:
   - Direcciones cíclicas: `down → right → up → left → down → ...` (o el orden que mejor encaje con el aspect ratio de la mesa; probablemente arranca vertical para mantener el "look" actual del primer tramo).
   - Para cada ficha en orden:
     - Determinar tamaño según orientación en su segmento:
       - Ficha alineada al sentido del segmento: longitud `2 * tileUnit`, ancho `tileUnit`.
       - Doble: siempre perpendicular al segmento (longitud `tileUnit`, ancho `2 * tileUnit`).
     - Avanzar el "cursor" en la dirección actual por la longitud de la ficha + gap.
     - Si el cursor + próxima ficha excede el bounding box del segmento: **girar 90°**. El tile actual se convierte en el "codo" (rotado para encajar con el giro). Reiniciar cursor en la nueva dirección, desplazado al lado para empezar el siguiente segmento.
   - Resultado: array `slots: Array<{ tileId, x, y, rotation: 0|90|180|270, flipped }>`.

4. **Auto-escalar `tileUnit`**:
   - Computar el tamaño total que ocuparía la cadena con tileUnit máximo (32px).
   - Si excede el playArea (incluso con todos los giros posibles dentro del bounding box), reducir tileUnit hasta caber, con mínimo 14px.
   - Esto reemplaza el `computeTileSize` actual ([Board.tsx:24-33](../../apps/mobile/src/components/game/Board.tsx#L24-L33)) que solo considera altura.

5. **Renderizar**:
   - Sin `ScrollView`. Cada slot se renderiza con `position: 'absolute'` en `{x, y}` con `transform: [{ rotate: rotation+'deg' }]`.
   - Pasar `flipped` (del engine) directamente al `DominoTile`. La rotación visual del segmento NO afecta `flipped` — solo `transform: rotate`. La pip "matching" sigue tocando el vecino correcto porque el orden lógico no cambia.

6. **Reportar al padre**:
   - `onChainBoundsChange` ahora reporta un **conjunto de rects** (uno por segmento) o el bounding box global.
   - Nuevo callback `onEndPositions({ left: {x,y,orientation}, right: {x,y,orientation} })` para que `DropGhost` sepa dónde poner el fantasma y con qué orientación. El extremo "left" puede estar arriba, a la derecha, abajo o a la izquierda dependiendo de cuántos giros lleve.
   - Nuevo callback `onTileLayout(tileId, rect)` consumido por `FlyingTileLayer` para conocer el destino exacto.

### Casos borde

- **Tablero vacío**: no hay slots, el extremo "fantasma" se posiciona en el centro del playArea (como hoy).
- **Una sola ficha (opener)**: un solo segmento, sin giros. Comportamiento idéntico al actual.
- **Re-layout cuando aparece una jugada**: la `LinearTransition` actual no aplica con `position: absolute`. Animar transiciones con Reanimated `withTiming` sobre `translateX/Y` de cada slot vía `useAnimatedStyle` keyed por tileId. Para esta primera versión podemos omitir la transición y dejar layout estático — pero documentamos como follow-up si se ve abrupto.
- **Rotación del Board**: si el dispositivo gira (landscape ya está bloqueado vía `useLandscapeLock`), no es un problema.

### Ajustes en `DropGhost` y `ghosts` calc

- `ghosts` en [GameScreen.tsx:141-183](../../apps/mobile/src/screens/GameScreen.tsx#L141-L183) hoy asume que `left` va arriba del chain y `right` debajo. Eso ya no es cierto.
- Reemplazar `chainBounds` por `endPositions` (reportado por Board) y posicionar cada fantasma en la coordenada + orientación que devuelva el Board.
- El cálculo de `flipped` (ya implementado correctamente con la regla del engine) se mantiene.

---

## Orden sugerido de implementación

1. **Refactor Board a layout absoluto** sin serpentine todavía (solo cambiar ScrollView → absolute, exponer `onTileLayout` y `endPositions`). Validar que las fichas se ven igual que antes.
2. **Implementar algoritmo serpentine** dentro de Board. Probar con cadenas largas hasta confirmar que no sale del playArea.
3. **Adaptar DropGhost** a `endPositions`. Probar drag-and-drop con cadena que ya tenga giros.
4. **Crear `FlyingTileLayer`** y conectar `lastEvent` + seat rects + `onTileLayout`. Probar con jugadas propias y de oponente.
5. **Pulir**: timing, easing, suprimir animación en jugadas viejas al reconectar.

---

## Verificación

End-to-end manual:

- Levantar app móvil:
  ```
  pnpm --filter ./apps/mobile start
  ```
  Y abrir en el simulador (o `i`/`a`).
- Iniciar partida 1v1 o 4 jugadores en local (server: `pnpm --filter ./apps/server dev` o el comando real del proyecto — confirmar en `package.json`).
- **Animación**:
  - Jugar una ficha tú: confirmar que vuela desde tu `PlayerSeat` sur hasta el extremo de la cadena.
  - Como segundo jugador (otra sesión / dev tools), jugar y observar la ficha volando desde el asiento del oponente correspondiente.
  - Probar opener: la primera ficha debe volar desde el asiento del que abrió.
  - Reconectar a una partida ya empezada: confirmar que NO se reproducen animaciones de jugadas viejas.
- **Serpentine**:
  - Forzar partida larga (jugar suficientes fichas para que la cadena llegue al borde): debe doblar 90° y seguir creciendo dentro del área de la mesa.
  - Confirmar que `DropGhost` aparece en el extremo correcto cuando la cadena ya tiene giros.
  - Confirmar que los pips de conexión siguen siendo coherentes (lo enforzamos vía `flipped` del engine).
- **Tests automatizados**:
  - Si hay tests en `packages/game-core`: `pnpm --filter @pintintin/game-core test`. No deberían romperse (no tocamos engine).
  - Smoke test del cliente: `pnpm --filter ./apps/mobile typecheck` para asegurar que el refactor de Board compila.
