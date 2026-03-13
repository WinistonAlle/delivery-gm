import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const preventPinchAndHorizontalPan = () => {
  let startX = 0;
  let startY = 0;

  document.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
        return;
      }
      if (event.touches.length !== 1) return;
      const dx = Math.abs(event.touches[0].clientX - startX);
      const dy = Math.abs(event.touches[0].clientY - startY);
      if (dx > dy) event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("gesturechange", (event) => event.preventDefault());
  document.addEventListener("gestureend", (event) => event.preventDefault());

  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false },
  );
};

preventPinchAndHorizontalPan();

createRoot(document.getElementById("root")!).render(<App />);
