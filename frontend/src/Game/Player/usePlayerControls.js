import { useEffect } from "react";
import { useRunnerStore } from "../state/runnerStore";

// Keyboard input -> lane movement / jump / slide.
export default function usePlayerControls(enabled = true) {
  const { moveLeft, moveRight, jump, slide, dismissHints } = useRunnerStore.getState();

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e) {
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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
