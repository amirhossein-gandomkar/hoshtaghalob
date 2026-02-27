import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { detectTextRegions, cleanTextRegion } from '../services/gemini';
import { Loader2, Upload, Download, Trash2, Wand2, Plus, Image as ImageIcon } from 'lucide-react';

interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'idle' | 'cleaning' | 'cleaned' | 'error';
  cleanedImage?: string;
}

export default function MangaEditor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [drawingBox, setDrawingBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            setImage(img);
            setBoxes([]);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  } as any);

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        // Draw cleaned boxes
        boxes.forEach(box => {
          if (box.status === 'cleaned' && box.cleanedImage) {
            const cleanedImg = new Image();
            cleanedImg.onload = () => {
              ctx.drawImage(cleanedImg, box.x, box.y, box.width, box.height);
            };
            cleanedImg.src = box.cleanedImage;
          }
        });
      }
    }
  }, [image, boxes]);

  const handleDetect = async () => {
    if (!image || !imageFile) return;
    setIsDetecting(true);
    try {
      const CHUNK_HEIGHT = 2048;
      const numChunks = Math.ceil(image.height / CHUNK_HEIGHT);
      const newBoxes: BoundingBox[] = [];

      for (let i = 0; i < numChunks; i++) {
        const startY = i * CHUNK_HEIGHT;
        const currentChunkHeight = Math.min(CHUNK_HEIGHT, image.height - startY);
        
        const detectCanvas = document.createElement('canvas');
        detectCanvas.width = image.width;
        detectCanvas.height = currentChunkHeight;
        const detectCtx = detectCanvas.getContext('2d');
        if (!detectCtx) continue;
        
        detectCtx.drawImage(
          image,
          0, startY, image.width, currentChunkHeight,
          0, 0, image.width, currentChunkHeight
        );
        
        // Scale down if width is still too large (rare for manga, but safe)
        let scale = 1;
        const MAX_DIM = 2048;
        if (image.width > MAX_DIM) {
          scale = MAX_DIM / image.width;
          const scaledCanvas = document.createElement('canvas');
          scaledCanvas.width = image.width * scale;
          scaledCanvas.height = currentChunkHeight * scale;
          const scaledCtx = scaledCanvas.getContext('2d');
          if (scaledCtx) {
            scaledCtx.drawImage(detectCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
            detectCanvas.width = scaledCanvas.width;
            detectCanvas.height = scaledCanvas.height;
            detectCtx.drawImage(scaledCanvas, 0, 0);
          }
        }
        
        const base64Data = detectCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        const regions = await detectTextRegions(base64Data, 'image/jpeg');
        
        regions.forEach(r => {
          // Add 2% padding
          const padY = (r.ymax - r.ymin) * 0.05;
          const padX = (r.xmax - r.xmin) * 0.05;
          
          const ymin = Math.max(0, r.ymin - padY);
          const ymax = Math.min(100, r.ymax + padY);
          const xmin = Math.max(0, r.xmin - padX);
          const xmax = Math.min(100, r.xmax + padX);

          // Map back to original image coordinates
          const boxY = startY + (ymin / 100) * currentChunkHeight;
          const boxHeight = ((ymax - ymin) / 100) * currentChunkHeight;
          
          newBoxes.push({
            id: uuidv4(),
            x: (xmin / 100) * image.width,
            y: boxY,
            width: ((xmax - xmin) / 100) * image.width,
            height: boxHeight,
            status: 'idle'
          });
        });
      }
      
      setBoxes(prev => [...prev, ...newBoxes]);
    } catch (error) {
      console.error("Detection failed", error);
      alert("Failed to detect text. You can draw boxes manually.");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCleanAll = async () => {
    if (!image) return;
    setIsCleaning(true);
    
    const boxesToClean = boxes.filter(b => b.status === 'idle' || b.status === 'error');
    
    for (const box of boxesToClean) {
      setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, status: 'cleaning' } : b));
      
      try {
        // Crop the box from the original image
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = box.width;
        cropCanvas.height = box.height;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) continue;
        
        cropCtx.drawImage(
          image,
          box.x, box.y, box.width, box.height,
          0, 0, box.width, box.height
        );
        
        const base64Data = cropCanvas.toDataURL('image/png').split(',')[1];
        const cleanedBase64 = await cleanTextRegion(base64Data, 'image/png');
        
        setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, status: 'cleaned', cleanedImage: cleanedBase64 } : b));
      } catch (error) {
        console.error(`Failed to clean box ${box.id}`, error);
        setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, status: 'error' } : b));
      }
    }
    
    setIsCleaning(false);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'cleaned-manga.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const removeBox = (id: string) => {
    setBoxes(prev => prev.filter(b => b.id !== id));
  };

  // Mouse events for drawing boxes
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !image) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate scale between displayed size and actual image size
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setDrawingBox({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingBox || !containerRef.current || !image) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setDrawingBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  };

  const handleMouseUp = () => {
    if (drawingBox) {
      const x = Math.min(drawingBox.startX, drawingBox.currentX);
      const y = Math.min(drawingBox.startY, drawingBox.currentY);
      const width = Math.abs(drawingBox.currentX - drawingBox.startX);
      const height = Math.abs(drawingBox.currentY - drawingBox.startY);
      
      if (width > 10 && height > 10) {
        setBoxes(prev => [...prev, {
          id: uuidv4(),
          x, y, width, height,
          status: 'idle'
        }]);
      }
      setDrawingBox(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-semibold tracking-tight">Manga Cleaner AI</h1>
        </div>
        
        {image && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setImage(null); setBoxes([]); }}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button 
              onClick={handleDetect}
              disabled={isDetecting || isCleaning}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Auto Detect Text
            </button>
            <button 
              onClick={handleCleanAll}
              disabled={isCleaning || boxes.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              Clean {boxes.filter(b => b.status === 'idle').length} Regions
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white text-black hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative">
        {!image ? (
          <div 
            {...getRootProps()} 
            className={`h-full flex flex-col items-center justify-center border-2 border-dashed m-8 rounded-2xl transition-colors cursor-pointer
              ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'}`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-zinc-500 mb-4" />
            <p className="text-lg font-medium text-zinc-300">Drop your manga/manhwa image here</p>
            <p className="text-sm text-zinc-500 mt-2">Supports long webtoon strips (PNG, JPG)</p>
          </div>
        ) : (
          <div className="h-full overflow-auto p-8 bg-zinc-950 flex justify-center">
            <div 
              ref={containerRef}
              className="relative shadow-2xl select-none"
              style={{ 
                width: '100%', 
                maxWidth: image.width > 1200 ? '1200px' : image.width,
                aspectRatio: `${image.width} / ${image.height}`
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <canvas 
                ref={canvasRef} 
                className="w-full h-full block rounded-sm pointer-events-none"
              />
              
              {/* Render Bounding Boxes */}
              {boxes.map(box => (
                <div
                  key={box.id}
                  className={`absolute border-2 group ${
                    box.status === 'cleaned' ? 'border-emerald-500/50 bg-emerald-500/10' :
                    box.status === 'cleaning' ? 'border-amber-500 bg-amber-500/20' :
                    box.status === 'error' ? 'border-red-500 bg-red-500/20' :
                    'border-blue-500 bg-blue-500/20'
                  }`}
                  style={{
                    left: `${(box.x / image.width) * 100}%`,
                    top: `${(box.y / image.height) * 100}%`,
                    width: `${(box.width / image.width) * 100}%`,
                    height: `${(box.height / image.height) * 100}%`,
                  }}
                >
                  {box.status === 'idle' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBox(box.id); }}
                      className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {box.status === 'cleaning' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    </div>
                  )}
                </div>
              ))}

              {/* Drawing Box */}
              {drawingBox && (
                <div
                  className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 pointer-events-none"
                  style={{
                    left: `${(Math.min(drawingBox.startX, drawingBox.currentX) / image.width) * 100}%`,
                    top: `${(Math.min(drawingBox.startY, drawingBox.currentY) / image.height) * 100}%`,
                    width: `${(Math.abs(drawingBox.currentX - drawingBox.startX) / image.width) * 100}%`,
                    height: `${(Math.abs(drawingBox.currentY - drawingBox.startY) / image.height) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </main>
      
      {image && (
        <footer className="p-3 bg-zinc-900 border-t border-zinc-800 text-center text-xs text-zinc-500">
          Tip: Click and drag on the image to manually select text regions if auto-detect misses them.
        </footer>
      )}
    </div>
  );
}
