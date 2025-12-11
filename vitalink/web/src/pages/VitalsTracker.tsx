import { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { processImage, addManualEvent, getHealthEvents } from "@/lib/api";
import { Loader2, Upload, Plus, History, Activity, Camera, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import correctImage from "@/assets/correct_image.jpeg";
import slantedImage from "@/assets/slanted_image.jpg";
import { toast } from "sonner";

export default function VitalsTracker() {
  const [activeTab, setActiveTab] = useState("scan");
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [manualForm, setManualForm] = useState({ sys: '', dia: '', pulse: '' });
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [pendingAction, setPendingAction] = useState<'camera' | 'upload' | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (userId) {
        setPatientId(userId);
      }
    }
    init();
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id; // Can be undefined, backend handles it
      const dataEvents = await getHealthEvents(userId);
      setEvents(dataEvents);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setOcrResult(null);
      setError(null);
      setSuccess(null);
    }
  };

  const handleScan = async () => {
    if (!selectedImage || !patientId) {
      toast.error("Unable to identify user. Please log in again.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await processImage(selectedImage, patientId);
      setOcrResult(result);
      toast.success("Scan complete! Please verify and save the readings.");
      // Pre-fill manual form with results for verification
      setManualForm({
        sys: result.sys || '',
        dia: result.dia || '',
        pulse: result.pulse || ''
      });
      // Scroll to results section
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err: any) {
      toast.error(err.message || "Failed to process image. Please try again with a clearer image.");
      // Clear the selected image so user can upload a new one
      setSelectedImage(null);
      setPreviewUrl(null);
      setOcrResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!patientId) {
      toast.error("Unable to identify user. Please log in again.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addManualEvent({
        type: 'blood_pressure',
        value1: manualForm.sys,
        value2: manualForm.dia,
        value3: manualForm.pulse
      }, patientId);
      toast.success("Blood pressure reading saved successfully!");
      setManualForm({ sys: '', dia: '', pulse: '' });
      setOcrResult(null);
      setSelectedImage(null);
      setPreviewUrl(null);
      fetchEvents(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || "Failed to save vitals");
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: 'camera' | 'upload') => {
    setPendingAction(action);
    setShowInstructions(true);
  };

  const handleContinue = () => {
    setShowInstructions(false);
    if (pendingAction === 'camera') {
      startCameraDirectly();
    } else if (pendingAction === 'upload') {
      fileInputRef.current?.click();
    }
    setPendingAction(null);
  };

  // Attach stream to video element when camera mode is active
  useEffect(() => {
    if (cameraMode && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraMode]);

  const startCameraDirectly = async () => {
    try {
      // Check if the browser supports camera access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera access is not supported in this browser. Please use a modern browser or upload an image instead.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      streamRef.current = stream;
      setCameraMode(true);
      setOcrResult(null);
      setError(null);
      setSuccess(null);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === 'NotFoundError') {
        toast.error("No camera found on this device. Please upload an image instead.");
      } else {
        toast.error("Failed to access camera. Please check permissions or upload an image instead.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraMode(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Vitals Tracker
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Methods */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="scan">Scan Monitor</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="space-y-6">
                {!cameraMode ? (
                  <>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <div onClick={() => handleActionClick('upload')} className="cursor-pointer flex flex-col items-center gap-2">
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="max-h-64 rounded-lg object-contain" />
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-muted-foreground" />
                            <span className="text-muted-foreground font-medium">Click to upload image</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => handleActionClick('camera')} variant="outline" className="flex-1">
                        <Camera className="w-4 h-4 mr-2" />
                        Use Camera
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="relative border-2 border-muted-foreground/25 rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                      />
                      <Button
                        onClick={stopCamera}
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button onClick={capturePhoto} className="w-full">
                      <Camera className="w-4 h-4 mr-2" />
                      Capture Photo
                    </Button>
                  </div>
                )}

                {selectedImage && (
                  <div className="space-y-2">
                    <Button onClick={handleScan} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Process Image"}
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedImage(null);
                        setPreviewUrl(null);
                        setOcrResult(null);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Upload Different Image
                    </Button>
                  </div>
                )}

                {ocrResult && (
                  <div ref={resultsRef} className="bg-muted/50 p-4 rounded-lg space-y-6">
                    {ocrResult.annotatedImage && (
                      <div className="flex flex-col items-center">
                        <p className="text-sm text-muted-foreground mb-2 self-start">Annotated Result:</p>
                        <img
                          src={`data:image/jpeg;base64,${ocrResult.annotatedImage}`}
                          alt="Annotated"
                          className="rounded-lg w-5/12 object-contain shadow-md"
                        />
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold">Verify & Edit Values</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recorded: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="scan-sys">SYS</Label>
                          <Input
                            id="scan-sys"
                            type="number"
                            value={manualForm.sys}
                            onChange={(e) => setManualForm({ ...manualForm, sys: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scan-dia">DIA</Label>
                          <Input
                            id="scan-dia"
                            type="number"
                            value={manualForm.dia}
                            onChange={(e) => setManualForm({ ...manualForm, dia: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scan-pulse">PULSE</Label>
                          <Input
                            id="scan-pulse"
                            type="number"
                            value={manualForm.pulse}
                            onChange={(e) => setManualForm({ ...manualForm, pulse: e.target.value })}
                          />
                        </div>
                      </div>

                      <Button onClick={(e) => handleManualSubmit(e)} disabled={loading} className="w-full">
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Result"}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Recording at: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sys">Systolic (mmHg)</Label>
                      <Input
                        id="sys"
                        type="number"
                        value={manualForm.sys}
                        onChange={(e) => setManualForm({ ...manualForm, sys: e.target.value })}
                        placeholder="120"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dia">Diastolic (mmHg)</Label>
                      <Input
                        id="dia"
                        type="number"
                        value={manualForm.dia}
                        onChange={(e) => setManualForm({ ...manualForm, dia: e.target.value })}
                        placeholder="80"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pulse">Pulse (bpm)</Label>
                      <Input
                        id="pulse"
                        type="number"
                        value={manualForm.pulse}
                        onChange={(e) => setManualForm({ ...manualForm, pulse: e.target.value })}
                        placeholder="72"
                        required
                      />
                    </div>
                  </div>

                  {error && <div className="text-destructive text-sm">{error}</div>}
                  {success && <div className="text-green-600 text-sm">{success}</div>}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Reading"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right Column: History */}
        <div>
          <Card className="p-6 h-full">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              Recent Readings
            </h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {events.length === 0 ? (
                <p className="text-muted-foreground text-sm">No readings recorded yet.</p>
              ) : (
                events.map((event: any) => (
                  <div key={event.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium capitalize">{event.type.replace('_', ' ')}</span>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>{new Date(event.created_at).toLocaleDateString()}</div>
                        <div>{new Date(event.created_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">SYS</span>
                        <div className="font-semibold">{event.value_1}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">DIA</span>
                        <div className="font-semibold">{event.value_2}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">PULSE</span>
                        <div className="font-semibold">{event.value_3}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">How to Take a Good Picture</DialogTitle>
            <DialogDescription>
              Please center the blood pressure monitor and ensure it's facing upright, not slanted. This helps our system accurately read the values.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 my-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Correct</span>
              </div>
              <div className="border-2 border-green-500 dark:border-green-400 rounded-lg overflow-hidden">
                <img src={correctImage} alt="Correct - Upright monitor" className="w-full h-auto" />
              </div>
              <p className="text-sm text-muted-foreground">Monitor is straight and clearly visible</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
                <XCircle className="w-5 h-5" />
                <span>Incorrect</span>
              </div>
              <div className="border-2 border-red-500 dark:border-red-400 rounded-lg overflow-hidden">
                <img src={slantedImage} alt="Incorrect - Slanted monitor" className="w-full h-auto" />
              </div>
              <p className="text-sm text-muted-foreground">Monitor is tilted or off-center</p>
            </div>
          </div>

          <Button onClick={handleContinue} className="w-full">
            Got It / Continue
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}