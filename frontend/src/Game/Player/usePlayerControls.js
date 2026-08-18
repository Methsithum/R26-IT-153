import { useEffect } from "react";
import { useRunnerStore } from "../state/runnerStore";
import { useGameStore } from "../state/GameStateManager";

const SWIPE_MIN = 42;
const LOOK_MOVE_MIN = 8;

export default function usePlayerControls({ run = false, explore = false } = {}) {
  useEffect(() => {
    if (!run && !explore) return;

    const keys = new Set();
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let tracking = false;
    let looking = false;
    let lookMoved = 0;

    function syncExplore() {
      if (!explore) return;
      let x = 0;
      let z = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
      useRunnerStore.getState().setExploreInput(x, z);
    }

    function onKeyDown(e) {
      if (explore) {
        if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
          keys.add(e.code);
          if (e.code.startsWith("Arrow") || e.code === "KeyW" || e.code === "KeyS") e.preventDefault();
          syncExplore();
        }
        if (e.code === "KeyE" || e.code === "Enter") {
          e.preventDefault();
          useGameStore.getState().tryStartMission();
        }
        return;
      }

      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          useRunnerStore.getState().moveLeft();
          break;
        case "ArrowRight":
        case "KeyD":
          useRunnerStore.getState().moveRight();
          break;
        case "Space":
        case "ArrowUp":
        case "KeyW":
          e.preventDefault();
          useRunnerStore.getState().jump();
          break;
        case "ArrowDown":
        case "KeyS":
        case "ShiftLeft":
        case "ShiftRight":
          useRunnerStore.getState().slide();
          break;
        default:
          break;
      }
    }

    function onKeyUp(e) {
      if (!explore) return;
      keys.delete(e.code);
      syncExplore();
    }

    function point(e) {
      if (e.changedTouches?.[0]) return e.changedTouches[0];
      if (e.touches?.[0]) return e.touches[0];
      return e;
    }

    function isStick(e) {
      return Boolean(e.target?.closest?.("[data-explore-stick]"));
    }

    function onPointerDown(e) {
      if (explore && isStick(e)) return;
      const p = point(e);
      startX = p.clientX;
      startY = p.clientY;
      lastX = p.clientX;
      lastY = p.clientY;
      tracking = true;
      looking = explore;
      lookMoved = 0;
      if (looking) document.body.style.cursor = "grabbing";
    }

    function onPointerMove(e) {
      if (!tracking) return;
      const p = point(e);
      if (looking) {
        const dx = p.clientX - lastX;
        const dy = p.clientY - lastY;
        lastX = p.clientX;
        lastY = p.clientY;
        lookMoved += Math.hypot(dx, dy);
        if (dx !== 0 || dy !== 0) {
          useRunnerStore.getState().addLookDelta(dx, dy);
        }
        e.preventDefault();
      }
    }

    function onPointerUp(e) {
      if (!tracking) return;
      tracking = false;
      if (looking) document.body.style.cursor = "";
      const wasLooking = looking;
      looking = false;
      const p = point(e);
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;

      if (wasLooking) {
        if (lookMoved < LOOK_MOVE_MIN) useGameStore.getState().tryStartMission();
        return;
      }

      if (Math.hypot(dx, dy) < SWIPE_MIN) return;
      const runner = useRunnerStore.getState();
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) runner.moveLeft();
        else runner.moveRight();
      } else if (dy < 0) {
        runner.jump();
      } else {
        runner.slide();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      useRunnerStore.getState().setExploreInput(0, 0);
    };
  }, [run, explore]);
}
