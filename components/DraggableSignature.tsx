import { useDrag, usePinch } from "@use-gesture/react";
import { X } from "lucide-react";
import React, { useRef, useState } from "react";

interface DraggableSignatureProps {
  id: string;
  signatureData: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zoomLevel: number;
  currentPage: number;
  totalPages: number;
  pageDimensions: { width: number; height: number }[];
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  viewerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (
    id: string,
    updates: { 
      x?: number; 
      y?: number; 
      width?: number; 
      height?: number;
      page?: number;
    }
  ) => void;
  onRemove: (id: string) => void;
  maxWidth: number;
  maxHeight: number;
}

const DraggableSignature: React.FC<DraggableSignatureProps> = ({
  id,
  signatureData,
  x,
  y,
  width,
  height,
  zoomLevel,
  currentPage,
  totalPages,
  pageDimensions,
  pageRefs,
  viewerRef,
  onUpdate,
  onRemove,
  maxWidth,
  maxHeight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [currentSize, setCurrentSize] = useState({ width, height });
  const [tempTransform, setTempTransform] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Fonction pour détecter dans quelle page se trouve la signature basée sur sa position absolue
  const detectPageFromPosition = (
    sigX: number,
    sigY: number,
    currentSigPage: number
  ): { page: number; newX: number; newY: number } => {
    if (!viewerRef.current || !containerRef.current || pageRefs.current.length === 0) {
      return { page: currentSigPage, newX: sigX, newY: sigY };
    }

    const viewerRect = viewerRef.current.getBoundingClientRect();
    const signatureRect = containerRef.current.getBoundingClientRect();
    const scrollTop = viewerRef.current.scrollTop;
    
    // Position du coin supérieur gauche de la signature par rapport au viewer (en pixels écran)
    const signatureTopLeftScreenX = signatureRect.left - viewerRect.left;
    const signatureTopLeftScreenY = signatureRect.top - viewerRect.top + scrollTop;
    
    // Position du centre de la signature pour la détection de page
    const signatureCenterScreenX = signatureTopLeftScreenX + (signatureRect.width / 2);
    const signatureCenterScreenY = signatureTopLeftScreenY + (signatureRect.height / 2);
    
    // Parcourir toutes les pages pour trouver dans laquelle se trouve le centre de la signature
    for (let i = 0; i < totalPages; i++) {
      const pageRef = pageRefs.current[i];
      if (!pageRef) continue;
      
      const pageRect = pageRef.getBoundingClientRect();
      const pageTop = pageRect.top - viewerRect.top + scrollTop;
      const pageBottom = pageTop + (pageDimensions[i]?.height || 0) * zoomLevel;
      const pageLeft = pageRect.left - viewerRect.left;
      const pageRight = pageLeft + (pageDimensions[i]?.width || 0) * zoomLevel;
      
      // Vérifier si le centre de la signature est dans cette page
      if (
        signatureCenterScreenY >= pageTop &&
        signatureCenterScreenY <= pageBottom &&
        signatureCenterScreenX >= pageLeft &&
        signatureCenterScreenX <= pageRight
      ) {
        // Calculer la position relative (coin supérieur gauche) dans cette nouvelle page
        const newX = (signatureTopLeftScreenX - pageLeft) / zoomLevel;
        const newY = (signatureTopLeftScreenY - pageTop) / zoomLevel;
        
        // Limiter aux bordures de la nouvelle page
        const newPageWidth = pageDimensions[i]?.width || maxWidth;
        const newPageHeight = pageDimensions[i]?.height || maxHeight;
        
        const clampedX = Math.max(0, Math.min(newX, newPageWidth - width));
        const clampedY = Math.max(0, Math.min(newY, newPageHeight - height));
        
        return {
          page: i + 1,
          newX: clampedX,
          newY: clampedY,
        };
      }
    }
    
    // Si aucune page trouvée, garder la page actuelle avec les coordonnées ajustées
    return { page: currentSigPage, newX: sigX, newY: sigY };
  };

  // Gérer le clic en dehors pour désélectionner
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsSelected(false);
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
          // Détecter si la signature a changé de page
          const pageDetection = detectPageFromPosition(
            tempTransform.x,
            tempTransform.y,
            currentPage
          );
          
          // Si la page a changé, mettre à jour avec la nouvelle page et position
          if (pageDetection.page !== currentPage) {
            onUpdate(id, {
              x: pageDetection.newX,
              y: pageDetection.newY,
              page: pageDetection.page,
            });
          } else {
            // Sinon, juste mettre à jour la position
            onUpdate(id, { x: tempTransform.x, y: tempTransform.y });
          }
          setTempTransform(null);
        }
      }
    },
    {
      from: () => [0, 0],
      pointer: { touch: true },
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
        // Calculer nouvelles dimensions avec limites basées sur la page
        const newWidth = Math.max(50, Math.min(maxWidth, currentSize.width * scale));
        const newHeight = Math.max(
          30,
          Math.min(maxHeight, currentSize.height * scale)
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

  // Gestion du redimensionnement par les coins (souris uniquement)
  const handleResizeStart = (
    e: React.MouseEvent,
    corner: "nw" | "ne" | "sw" | "se"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = displayWidth;
    const startHeight = displayHeight;
    const startPosX = displayX;
    const startPosY = displayY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoomLevel;
      const deltaY = (moveEvent.clientY - startY) / zoomLevel;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      // Redimensionnement libre (sans ratio d'aspect)
      switch (corner) {
        case "se": // Bas-droite
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = Math.max(30, startHeight + deltaY);
          break;
        case "sw": // Bas-gauche
          newWidth = Math.max(50, startWidth - deltaX);
          newHeight = Math.max(30, startHeight + deltaY);
          newX = startPosX + (startWidth - newWidth);
          break;
        case "ne": // Haut-droite
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = Math.max(30, startHeight - deltaY);
          newY = startPosY + (startHeight - newHeight);
          break;
        case "nw": // Haut-gauche
          newWidth = Math.max(50, startWidth - deltaX);
          newHeight = Math.max(30, startHeight - deltaY);
          newX = startPosX + (startWidth - newWidth);
          newY = startPosY + (startHeight - newHeight);
          break;
      }

      // Limiter aux bordures de la page
      newX = Math.max(0, Math.min(newX, maxWidth - newWidth));
      newY = Math.max(0, Math.min(newY, maxHeight - newHeight));
      newWidth = Math.min(newWidth, maxWidth - newX);
      newHeight = Math.min(newHeight, maxHeight - newY);

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
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      {...bindDrag()}
      {...bindPinch()}
      onClick={() => setIsSelected(true)}
      className={`absolute border-2 ${
        isSelected ? "border-primary" : "border-primary/30"
      } bg-primary/10 group touch-none select-none ${
        isManipulating ? "cursor-grabbing z-50" : "cursor-grab"
      }`}
      style={{
        left: `${displayX * zoomLevel}px`,
        top: `${displayY * zoomLevel}px`,
        width: `${displayWidth * zoomLevel}px`,
        height: `${displayHeight * zoomLevel}px`,
        outline: isManipulating
          ? "3px solid var(--md-sys-color-primary)"
          : "none",
        outlineOffset: "2px",
        transition: isManipulating ? "none" : "all 0.2s ease",
        touchAction: "none",
      }}
    >
      {/* Image de signature */}
      <img
        src={signatureData}
        alt="Signature"
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* Bouton supprimer - visible seulement si sélectionné */}
      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="absolute -top-2 -right-2 bg-error text-onError rounded-full p-1 transition-opacity z-10"
          title="Supprimer la signature"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Poignées de redimensionnement (4 coins) - visibles seulement si sélectionné */}
      {isSelected && (
        <>
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, "nw");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
              });
              handleResizeStart(mouseEvent as any, "nw");
            }}
            className="absolute -top-2 -left-2 w-6 h-6 bg-primary rounded-full cursor-nw-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto" }}
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, "ne");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
              });
              handleResizeStart(mouseEvent as any, "ne");
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full cursor-ne-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto" }}
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, "sw");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
              });
              handleResizeStart(mouseEvent as any, "sw");
            }}
            className="absolute -bottom-2 -left-2 w-6 h-6 bg-primary rounded-full cursor-sw-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto" }}
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, "se");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true,
              });
              handleResizeStart(mouseEvent as any, "se");
            }}
            className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full cursor-se-resize shadow-lg border-2 border-white z-50"
            style={{ touchAction: "none", pointerEvents: "auto" }}
          />
        </>
      )}
    </div>
  );
};

export default DraggableSignature;
