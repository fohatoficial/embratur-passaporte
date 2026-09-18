import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BootSplash } from "@/components/kiosk/BootSplash";
import { KioskFrame } from "@/components/kiosk/KioskFrame";
import { KioskViewport } from "@/components/kiosk/KioskViewport";
import { AttractScreen } from "@/components/kiosk/screens/AttractScreen";
import { PreCaptureScreen } from "@/components/kiosk/screens/PreCaptureScreen";
import { releaseCamera } from "@/hooks/useCamera";
import { resetRemoteCutout } from "@/lib/photoroomCutout";
import { CameraScreen } from "@/components/kiosk/screens/CameraScreen";
import { ProcessingScreen } from "@/components/kiosk/screens/ProcessingScreen";
import { ReviewScreen } from "@/components/kiosk/screens/ReviewScreen";
import { PrintingScreen } from "@/components/kiosk/screens/PrintingScreen";
import { DoneScreen } from "@/components/kiosk/screens/DoneScreen";

const title = "Brasil 2027 · Sua foto para o passaporte | EMBRATUR";
const description =
  "Experiência touchscreen da EMBRATUR na FIT: tire sua foto estilo passaporte e prepare-se para viver o Brasil na Copa do Mundo Feminina de 2027.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Kiosk,
});

type Step =
  | "attract"
  | "precapture"
  | "camera"
  | "processing"
  | "review"
  | "printing"
  | "done";

function Kiosk() {
  const [step, setStep] = useState<Step>("attract");
  const [capture, setCapture] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [strip, setStrip] = useState<string | null>(null);

  const handleCaptured = useCallback((captured: string) => {
    setCapture(captured);
    setPhoto(null);
    setStep("processing");
  }, []);

  const backToCamera = useCallback(() => {
    setCapture(null);
    setPhoto(null);
    resetRemoteCutout();
    setStep("camera");
  }, []);

  const reset = useCallback(() => {
    setCapture(null);
    setPhoto(null);
    setStrip(null);
    resetRemoteCutout();
    releaseCamera();
    setStep("attract");
  }, []);

  // limpeza ao desmontar: nada de foto guardada e câmera liberada
  useEffect(() => () => {
    setCapture(null);
    setPhoto(null);
    setStrip(null);
    releaseCamera();
  }, []);


  return (
    <>
    <BootSplash />
    <KioskViewport>
      <KioskFrame>
        {step === "attract" && <AttractScreen onStart={() => setStep("precapture")} />}
        {step === "precapture" && <PreCaptureScreen onReady={() => setStep("camera")} />}
        {step === "camera" && <CameraScreen onCaptured={handleCaptured} />}
        {step === "processing" && capture && (
          <ProcessingScreen
            capture={capture}
            onDone={(processed) => {
              setPhoto(processed);
              setStep("review");
            }}
            onBackToCamera={backToCamera}
          />
        )}
        {step === "review" && photo && (
          <ReviewScreen
            photo={photo}
            onConfirm={() => setStep("printing")}
            onRetake={backToCamera}
          />
        )}
        {step === "printing" && photo && (
          <PrintingScreen
            photo={photo}
            onFinished={(printed) => {
              setStrip(printed);
              setStep("done");
            }}
          />
        )}
        {step === "done" && <DoneScreen onReset={reset} strip={strip} />}
      </KioskFrame>
    </KioskViewport>
    </>
  );
}
