import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Center, Grid, Environment } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Palette, Loader2, Box } from 'lucide-react';

interface STLModelProps {
  url: string;
  color: string;
}

function STLModel({ url, color }: STLModelProps) {
  const geometry = useLoader(STLLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);
  
  useEffect(() => {
    if (geometry) {
      geometry.center();
      geometry.computeVertexNormals();
    }
  }, [geometry]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial 
        color={color} 
        metalness={0.3} 
        roughness={0.6}
        flatShading={false}
      />
    </mesh>
  );
}

function CameraController({ resetTrigger }: { resetTrigger: number }) {
  const { camera, gl } = useThree();
  
  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.set(0, 0, 100);
      camera.lookAt(0, 0, 0);
    }
  }, [resetTrigger, camera]);
  
  return null;
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Загрузка 3D модели...</p>
      </div>
    </div>
  );
}

interface STLViewerProps {
  url: string;
  className?: string;
  onFullscreen?: () => void;
}

const colorPresets = [
  { name: 'Белый', value: '#f0f0f0' },
  { name: 'Кость', value: '#e8d4b8' },
  { name: 'Синий', value: '#4a90d9' },
  { name: 'Зелёный', value: '#4ad99f' },
  { name: 'Красный', value: '#d94a4a' },
  { name: 'Золотой', value: '#d9b44a' },
];

export function STLViewer({ url, className = '', onFullscreen }: STLViewerProps) {
  const [color, setColor] = useState('#e8d4b8');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
  };

  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen();
    } else if (containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative bg-muted/30 rounded-lg overflow-hidden ${className}`}>
      {loading && <LoadingSpinner />}
      
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleReset}
          className="bg-background/90 hover:bg-background shadow-sm"
          title="Сбросить вид"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="bg-background/90 hover:bg-background shadow-sm"
          title="Цвет модели"
        >
          <Palette className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleFullscreen}
          className="bg-background/90 hover:bg-background shadow-sm"
          title="Полноэкранный режим"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Color picker */}
      {showColorPicker && (
        <div className="absolute top-14 left-3 z-20 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg border border-border">
          <Label className="text-xs text-muted-foreground mb-2 block">Цвет модели</Label>
          <div className="flex flex-wrap gap-2 max-w-[180px]">
            {colorPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setColor(preset.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === preset.value ? 'border-primary scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 z-20 text-xs text-muted-foreground bg-background/80 backdrop-blur rounded px-2 py-1">
        🔄 ЛКМ — вращение • 🔍 Скролл — зум • ↔️ ПКМ — панорама
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 100], fov: 50 }}
        onCreated={() => setLoading(false)}
        shadows
        style={{ height: '100%', minHeight: '400px' }}
      >
        <CameraController resetTrigger={resetTrigger} />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 10]} 
          intensity={1} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-10, -10, -10]} intensity={0.3} />
        <pointLight position={[0, 50, 0]} intensity={0.5} />
        
        <Suspense fallback={null}>
          <Center>
            <STLModel url={url} color={color} />
          </Center>
        </Suspense>
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={500}
          dampingFactor={0.1}
          enableDamping
        />
        
        <Grid 
          args={[200, 200]} 
          cellSize={10}
          cellThickness={0.5}
          cellColor="#6b7280"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#4b5563"
          fadeDistance={300}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={true}
        />
      </Canvas>
    </div>
  );
}

// Full screen viewer dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface STLViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function STLViewerDialog({ open, onOpenChange, url, title }: STLViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Box className="w-5 h-5 text-primary" />
            {title || '3D Модель'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 p-4 pt-2">
          <STLViewer url={url} className="h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
