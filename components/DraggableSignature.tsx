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

  // Gestion du redimensionnement par les coins (souris + tactile) - Inspiré de PrepareDocumentPage
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

    // Utiliser les valeurs initiales (props) au lieu des valeurs affichées (tempTransform)
    // Cela évite les problèmes de calcul si le champ est en cours de manipulation
    const startX = clientX;
    const startY = clientY;
    const startWidth = width; // Utiliser width (prop) au lieu de displayWidth
    const startHeight = height; // Utiliser height (prop) au lieu de displayHeight
    const startPosX = x; // Utiliser x (prop) au lieu de displayX
    const startPosY = y; // Utiliser y (prop) au lieu de displayY

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      // 🔧 FIX MOBILE : Gérer les événements touch
      const moveClientX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const moveClientY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const dx = (moveClientX - startX) / zoomLevel;
      const dy = (moveClientY - startY) / zoomLevel;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      // Calculer les nouvelles dimensions selon la direction (même logique que PrepareDocumentPage)
      switch (corner) {
        case "se": // Bas-droite
          newWidth = Math.max(20, startWidth + dx);
          newHeight = Math.max(20, startHeight + dy);
          break;
        case "sw": // Bas-gauche
          newWidth = Math.max(20, startWidth - dx);
          newHeight = Math.max(20, startHeight + dy);
          newX = startPosX + (startWidth - newWidth);
          break;
        case "ne": // Haut-droite
          newWidth = Math.max(20, startWidth + dx);
          newHeight = Math.max(20, startHeight - dy);
          newY = startPosY + (startHeight - newHeight);
          break;
        case "nw": // Haut-gauche
          newWidth = Math.max(20, startWidth - dx);
          newHeight = Math.max(20, startHeight - dy);
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

    const handleMouseUp = (e?: MouseEvent | TouchEvent) => {
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

  // Fonction helper pour convertir une couleur hex en rgba avec opacité
  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Couleur par défaut (couleur primaire)
  const color = "#6750A4"; // Couleur primaire Material Design 3
  const borderColorWithOpacity = hexToRgba(color, 0.5);

  // Style pour le conteneur interne (contenu avec bordure colorée)
  const innerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    border: `2px solid ${color}`,
    backgroundColor: `${color}20`,
    cursor: "move",
    position: "relative",
  };

  // Style pour le conteneur externe (avec bordure colorée en hover/sélection avec 50% opacité)
  // Les coordonnées représentent le contenu interne
  // Le conteneur externe est décalé de -15px et agrandi de +30px (15px de chaque côté)
  const outerStyle: React.CSSProperties = {
    position: "absolute",
    left: `${(displayX - 15) * zoomLevel}px`,
    top: `${(displayY - 15) * zoomLevel}px`,
    width: `${(displayWidth + 30) * zoomLevel}px`, // +30px pour les 15px de chaque côté
    height: `${(displayHeight + 30) * zoomLevel}px`, // +30px pour les 15px de chaque côté
    padding: `${15 * zoomLevel}px`,
    touchAction: "none",
    borderColor: isSelected ? borderColorWithOpacity : 'transparent',
  };

  return (
    <div
      ref={containerRef}
      {...bindDrag()}
      {...bindPinch()}
      onClick={() => setIsSelected(true)}
      style={outerStyle}
      className={`group border-2 ${
        isSelected
          ? ""
          : "hover:border-opacity-100"
      } transition-all touch-none select-none ${
        isManipulating ? "cursor-grabbing z-50" : "cursor-grab"
      }`}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = borderColorWithOpacity;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
      onMouseDown={(e) => {
        // Ne démarrer le drag que si on ne clique pas sur une poignée de resize ou le bouton X
        const target = e.target as HTMLElement;
        if (!target.closest('.resize-handle') && !target.closest('.delete-button')) {
          // Le drag est géré par bindDrag
        }
      }}
    >
      {/* Conteneur interne avec le contenu */}
      <div
        style={innerStyle}
        className="w-full h-full flex flex-col justify-center items-center"
      >
        {/* Image de signature */}
        <img
          src={signatureData}
          alt="Signature"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
        
        {/* Poignées de redimensionnement - aux coins du rectangle principal, visibles seulement si sélectionné */}
        {isSelected && (
          <>
            <div
              className="resize-handle absolute -top-2 -left-2 w-4 h-4 rounded-full cursor-nw-resize shadow-lg border-2 border-white z-50"
              style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "nw");
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "nw");
              }}
            />
            <div
              className="resize-handle absolute -top-2 -right-2 w-4 h-4 rounded-full cursor-ne-resize shadow-lg border-2 border-white z-50"
              style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "ne");
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "ne");
              }}
            />
            <div
              className="resize-handle absolute -bottom-2 -left-2 w-4 h-4 rounded-full cursor-sw-resize shadow-lg border-2 border-white z-50"
              style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "sw");
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "sw");
              }}
            />
            <div
              className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 rounded-full cursor-se-resize shadow-lg border-2 border-white z-50"
              style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "se");
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleResizeStart(e, "se");
              }}
            />
          </>
        )}
      </div>

      {/* Bouton de suppression - en haut à droite de la bordure externe, dans un cercle légèrement plus gros que les poignées */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className="delete-button absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-50 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ touchAction: "none", pointerEvents: "auto", backgroundColor: color }}
        title="Supprimer la signature"
      >
        <X size={12} style={{ color: '#ffffff' }} />
      </button>
    </div>
  );
};

export default DraggableSignature;
