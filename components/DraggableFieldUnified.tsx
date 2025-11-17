import { useDrag, usePinch } from "@use-gesture/react";
import { X } from "lucide-react";
import React, { useRef, useState } from "react";

interface DraggableFieldUnifiedProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zoomLevel: number;
  onUpdate: (
    id: string,
    updates: { x?: number; y?: number; width?: number; height?: number }
  ) => void;
  onRemove?: (id: string) => void;
  maxWidth: number;
  maxHeight: number;
  children: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  showRemoveButton?: boolean;
  color?: string; // Couleur du destinataire pour les poignées et le bouton de suppression
}

const DraggableFieldUnified: React.FC<DraggableFieldUnifiedProps> = ({
  id,
  x,
  y,
  width,
  height,
  zoomLevel,
  onUpdate,
  onRemove,
  maxWidth,
  maxHeight,
  children,
  isSelected = false,
  onSelect,
  showRemoveButton = false,
  color = "#6750A4", // Couleur par défaut (primary Material Design 3)
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [currentSize, setCurrentSize] = useState({ width, height });
  const [tempTransform, setTempTransform] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Gérer le clic en dehors pour désélectionner
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        isSelected
      ) {
        // La désélection sera gérée par le parent
      }
    };

    if (isSelected) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isSelected]);

  // 🖐️ Geste de déplacement (souris + tactile)
  const bindDrag = useDrag(
    ({ active, movement: [mx, my], first, last, event }) => {
      event?.stopPropagation();

      if (first) {
        setIsDragging(true);
      }

      if (active) {
        const dx = mx / zoomLevel;
        const dy = my / zoomLevel;

        // Limiter aux bordures
        const newX = Math.max(0, Math.min(x + dx, maxWidth - width));
        const newY = Math.max(0, Math.min(y + dy, maxHeight - height));

        setTempTransform({ x: newX, y: newY, width, height });
      }

      if (last) {
        setIsDragging(false);
        if (tempTransform) {
          onUpdate(id, { x: tempTransform.x, y: tempTransform.y });
          setTempTransform(null);
        }
      }
    },
    {
      from: () => [0, 0],
      pointer: { touch: true },
      filterTaps: true,
      threshold: 3, // Seuil de mouvement en pixels avant de démarrer le drag (évite les clics accidentels)
      preventScrollAxis: 'xy', // Empêcher le scroll pendant le drag
    }
  );

  // 🤏 Geste de pinch pour redimensionner (2 doigts)
  const bindPinch = usePinch(
    ({ active, offset: [scale], first, last, event }) => {
      event?.stopPropagation();

      if (first) {
        setIsPinching(true);
      }

      if (active) {
        // Calculer nouvelles dimensions avec limites
        const newWidth = Math.max(50, Math.min(400, currentSize.width * scale));
        const newHeight = Math.max(
          30,
          Math.min(300, currentSize.height * scale)
        );

        // Ajuster la position pour garder le centre
        const centerX = x + currentSize.width / 2;
        const centerY = y + currentSize.height / 2;
        const newX = Math.max(
          0,
          Math.min(centerX - newWidth / 2, maxWidth - newWidth)
        );
        const newY = Math.max(
          0,
          Math.min(centerY - newHeight / 2, maxHeight - newHeight)
        );

        setTempTransform({
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        });
      }

      if (last) {
        setIsPinching(false);
        if (tempTransform) {
          setCurrentSize({
            width: tempTransform.width,
            height: tempTransform.height,
          });
          onUpdate(id, {
            x: tempTransform.x,
            y: tempTransform.y,
            width: tempTransform.width,
            height: tempTransform.height,
          });
          setTempTransform(null);
        }
      }
    },
    {
      scaleBounds: { min: 0.5, max: 3 },
      rubberband: true,
    }
  );

  // Utiliser les valeurs temporaires pendant la manipulation, sinon les props
  const displayX = tempTransform?.x ?? x;
  const displayY = tempTransform?.y ?? y;
  const displayWidth = tempTransform?.width ?? width;
  const displayHeight = tempTransform?.height ?? height;

  const isManipulating = isDragging || isPinching || isResizing;

  // Gestion du redimensionnement par les coins (souris + tactile)
  const handleResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    corner: "nw" | "ne" | "sw" | "se"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);

    // 🔧 FIX MOBILE : Gérer les événements touch
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const startX = clientX;
    const startY = clientY;
    const startWidth = displayWidth;
    const startHeight = displayHeight;
    const startPosX = displayX;
    const startPosY = displayY;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      // 🔧 FIX MOBILE : Gérer les événements touch
      const moveClientX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const moveClientY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const deltaX = (moveClientX - startX) / zoomLevel;
      const deltaY = (moveClientY - startY) / zoomLevel;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      switch (corner) {
        case "se": // Bas-droite
          newWidth = Math.max(50, Math.min(400, startWidth + deltaX));
          newHeight = Math.max(30, Math.min(300, startHeight + deltaY));
          break;
        case "sw": // Bas-gauche
          newWidth = Math.max(50, Math.min(400, startWidth - deltaX));
          newHeight = Math.max(30, Math.min(300, startHeight + deltaY));
          newX = startPosX + (startWidth - newWidth);
          break;
        case "ne": // Haut-droite
          newWidth = Math.max(50, Math.min(400, startWidth + deltaX));
          newHeight = Math.max(30, Math.min(300, startHeight - deltaY));
          newY = startPosY + (startHeight - newHeight);
          break;
        case "nw": // Haut-gauche
          newWidth = Math.max(50, Math.min(400, startWidth - deltaX));
          newHeight = Math.max(30, Math.min(300, startHeight - deltaY));
          newX = startPosX + (startWidth - newWidth);
          newY = startPosY + (startHeight - newHeight);
          break;
      }

      // Limiter aux bordures
      newX = Math.max(0, Math.min(newX, maxWidth - newWidth));
      newY = Math.max(0, Math.min(newY, maxHeight - newHeight));

      setTempTransform({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (tempTransform) {
        setCurrentSize({
          width: tempTransform.width,
          height: tempTransform.height,
        });
        onUpdate(id, {
          x: tempTransform.x,
          y: tempTransform.y,
          width: tempTransform.width,
          height: tempTransform.height,
        });
        setTempTransform(null);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove, { passive: false });
    document.addEventListener("touchend", handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      {...bindDrag()}
      {...bindPinch()}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect();
      }}
      className="absolute group touch-none select-none"
      style={{
        left: `${displayX * zoomLevel}px`,
        top: `${displayY * zoomLevel}px`,
        width: `${displayWidth * zoomLevel}px`,
        height: `${displayHeight * zoomLevel}px`,
        cursor: isManipulating ? "grabbing" : "grab",
        zIndex: isManipulating ? 50 : "auto",
        touchAction: "none",
      }}
    >
      {/* Contenu du champ */}
      <div className="w-full h-full">{children}</div>

      {/* Bouton supprimer - visible seulement si sélectionné */}
      {showRemoveButton && isSelected && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="delete-button absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-50 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
          title="Supprimer le champ"
        >
          <X size={12} style={{ color: '#ffffff' }} />
        </button>
      )}

      {/* Poignées de redimensionnement (4 coins) - visibles seulement si sélectionné */}
      {isSelected && (
        <>
          <div
            onMouseDown={(e) => handleResizeStart(e, "nw")}
            onTouchStart={(e) => handleResizeStart(e, "nw")}
            className="resize-handle absolute -top-2 -left-2 w-4 h-4 rounded-full cursor-nw-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, "ne")}
            onTouchStart={(e) => handleResizeStart(e, "ne")}
            className="resize-handle absolute -top-2 -right-2 w-4 h-4 rounded-full cursor-ne-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, "sw")}
            onTouchStart={(e) => handleResizeStart(e, "sw")}
            className="resize-handle absolute -bottom-2 -left-2 w-4 h-4 rounded-full cursor-sw-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, "se")}
            onTouchStart={(e) => handleResizeStart(e, "se")}
            className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 rounded-full cursor-se-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
          />
        </>
      )}
    </div>
  );
};

export default DraggableFieldUnified;

