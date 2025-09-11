import { useEffect, useState } from "react";

function useWindowDimensions() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= 1024;
}
