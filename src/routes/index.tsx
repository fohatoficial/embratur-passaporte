import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { KioskFrame } from "@/components/kiosk/KioskFrame";
import { KioskViewport } from "@/components/kiosk/KioskViewport";
import { AttractScreen } from "@/components/kiosk/screens/AttractScreen";
import { InstructionsScreen } from "@/components/kiosk/screens/InstructionsScreen";
import { CameraScreen } from "@/components/kiosk/screens/CameraScreen";
import { ProcessingScreen } from "@/components/kiosk/screens/ProcessingScreen";
import { ReviewScreen } from "@/components/kiosk/screens/ReviewScreen";
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

type Step = "attract" | "instructions" | "camera" | "processing" | "review" | "done";

function Kiosk() {
  const [step, setStep] = useState<Step>("attract");
  const [photo, setPhoto] = useState<string | null>(null);

  const handleCaptured = useCallback((captured: string | null) => {
    setPhoto(captured);
    setStep("processing");
  }, []);

  return (
    <KioskViewport>
      <KioskFrame>
        {step === "attract" && <AttractScreen onStart={() => setStep("instructions")} />}
        {step === "instructions" && <InstructionsScreen onDone={() => setStep("camera")} />}
        {step === "camera" && <CameraScreen onCaptured={handleCaptured} />}
        {step === "processing" && <ProcessingScreen onDone={() => setStep("review")} />}
        {step === "review" && (
          <ReviewScreen
            photo={photo}
            onConfirm={() => setStep("done")}
            onRetake={() => {
              setPhoto(null);
              setStep("camera");
            }}
          />
        )}
        {step === "done" && (
          <DoneScreen
            onReset={() => {
              setPhoto(null);
              setStep("attract");
            }}
          />
        )}
      </KioskFrame>
    </KioskViewport>
  );
}
