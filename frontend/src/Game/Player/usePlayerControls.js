import { useEffect } from "react";
import { useRunnerStore } from "../state/runnerStore";
import { useGameStore } from "../state/GameStateManager";

const SWIPE_MIN = 42;

function canvasEl() {
  return document.querySelector("canvas");
}

export default function usePlayerControls({ run = false, explore = false } = {}) {
  useEffect(() => {
    if (!run && !explore) return;

    const keys = new Set();
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let tracking = false;
    let touchLooking = false;

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

    function isExploreUi(e) {
      return Boolean(e.target?.closest?.("[data-explore-stick], [data-explore-ui]"));
    }

    function onMouseMove(e) {
      if (!explore) return;
      if (!document.pointerLockElement) return;
      if (e.movementX === 0 && e.movementY === 0) return;
      useRunnerStore.getState().addLookDelta(e.movementX, e.movementY, 0.0022);
    }

    function onPointerLockChange() {
      const locked = document.pointerLockElement === canvasEl();
      useRunnerStore.getState().setLookLocked(locked);
    }

    function onClick(e) {
      if (!explore || isExploreUi(e)) return;
      if (e.pointerType === "touch") return;
      if (document.pointerLockElement) return;
      canvasEl()?.requestPointerLock?.();
    }

    function onPointerDown(e) {
      if (explore && isExploreUi(e)) return;
      if (explore && e.pointerType !== "touch") {
        return;
      }
      if (explore && e.pointerType === "touch") {
        lastX = e.clientX;
        lastY = e.clientY;
        tracking = true;
        touchLooking = true;
        return;
      }
      startX = e.clientX;
      startY = e.clientY;
      tracking = true;
      touchLooking = false;
    }

    function onPointerMove(e) {
      if (!tracking || !touchLooking) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx !== 0 || dy !== 0) {
        useRunnerStore.getState().addLookDelta(dx, dy, 0.0048);
      }
      e.preventDefault();
    }

    function onPointerUp(e) {
      if (explore) {
        tracking = false;
        touchLooking = false;
        return;
      }
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
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
    window.addEventListener("click", onClick);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("click", onClick);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      useRunnerStore.getState().setExploreInput(0, 0);
      useRunnerStore.getState().setLookLocked(false);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [run, explore]);
}
