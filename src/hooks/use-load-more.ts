import { useCallback, useEffect, useRef, useState } from "react";

/** Chama `onReach` quando o marcador se aproxima da tela. Retorna a ref do marcador. */
export function useLoadMore(onReach: () => void, enabled: boolean) {
  const [node, setNode] = useState<Element | null>(null);
  const callback = useRef(onReach);
  callback.current = onReach;
  useEffect(() => {
    if (!node || !enabled || typeof IntersectionObserver === "undefined") return;
    // ao religar, o observador avisa de novo se o marcador continuar visível
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) callback.current(); }, { rootMargin: "500px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, enabled]);
  return useCallback((el: Element | null) => setNode(el), []);
}
