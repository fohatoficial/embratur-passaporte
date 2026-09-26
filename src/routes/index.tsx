import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BootSplash } from "@/components/kiosk/BootSplash";
import { KioskFrame } from "@/components/kiosk/KioskFrame";
import { CancelSessionButton } from "@/components/kiosk/CancelSessionButton";
import { KioskViewport } from "@/components/kiosk/KioskViewport";
import { AttractScreen } from "@/components/kiosk/screens/AttractScreen";
import { RegistrationScreen, type Participant } from "@/components/kiosk/screens/RegistrationScreen";
import { PreCaptureScreen } from "@/components/kiosk/screens/PreCaptureScreen";
import { releaseCamera } from "@/hooks/useCamera";
import { resetRemoteCutout } from "@/lib/photoroomCutout";
import { CameraScreen } from "@/components/kiosk/screens/CameraScreen";
import { ProcessingScreen } from "@/components/kiosk/screens/ProcessingScreen";
import { ReviewScreen } from "@/components/kiosk/screens/ReviewScreen";
import { PrintingScreen } from "@/components/kiosk/screens/PrintingScreen";
import { DoneScreen } from "@/components/kiosk/screens/DoneScreen";
import { QrShareScreen } from "@/components/kiosk/screens/QrShareScreen";
import { startPhotoShare, type ShareResult } from "@/lib/photoShare";
import { deletePhotoShare } from "@/lib/photoShare.functions";

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
  | "register"
  | "precapture"
  | "camera"
  | "processing"
  | "review"
  | "printing"
  | "share"
  | "done";

function Kiosk() {
  const [step, setStep] = useState<Step>("attract");
  const [capture, setCapture] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [strip, setStrip] = useState<string | null>(null);
  // somente identificadores em memória; nunca nome/telefone
  const [participant, setParticipant] = useState<Participant | null>(null);
  // compartilhamento digital: um por atendimento, independente da impressão
  const shareRef = useRef<Promise<ShareResult | null> | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  // nova chave a cada atendimento: remonta as telas e invalida callbacks antigos
  const [sessionKey, setSessionKey] = useState(0);

  const clearShare = useCallback(() => {
    const pending = shareRef.current;
    shareRef.current = null;
    void pending?.then((r) => r && URL.revokeObjectURL(r.previewUrl));
  }, []);

  const confirmPhoto = useCallback(() => {
    if (photo && participant && !shareRef.current) {
      shareRef.current = startPhotoShare(photo, participant.sessionId, participant.participantId);
    }
    setStep("printing");
  }, [photo, participant]);

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

  // TOMAR OTRA FOTO após erro: descarta só esta captura (foto, tira, arte e
  // link digital), mantém cadastro e sessão, e volta direto à câmera.
  const retakeAfterError = useCallback(() => {
    const pending = shareRef.current;
    shareRef.current = null;
    void pending?.then((r) => {
      if (!r) return;
      URL.revokeObjectURL(r.previewUrl);
      void deletePhotoShare({ data: { token: r.token } }).catch(() => undefined);
    });
    setStrip(null);
    backToCamera();
  }, [backToCamera]);

  const reset = useCallback(() => {
    setCapture(null);
    setPhoto(null);
    setStrip(null);
    setParticipant(null);
    clearShare();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    resetRemoteCutout();
    releaseCamera();
    setConfirmExit(false);
    setSessionKey((k) => k + 1);
    setStep("attract");
  }, [clearShare]);

  const cancellable =
    step === "precapture" || step === "camera" || step === "processing" || step === "review";

  // limpeza ao desmontar: nada de foto guardada e câmera liberada
  useEffect(() => () => {
    setCapture(null);
    setPhoto(null);
    setStrip(null);
    resetRemoteCutout();
    releaseCamera();
  }, []);


  return (
    <>
    <BootSplash />
    <KioskViewport>
      <KioskFrame key={sessionKey}>
        {cancellable && (
          <CancelSessionButton
            open={confirmExit}
            onOpen={() => setConfirmExit(true)}
            onStay={() => setConfirmExit(false)}
            onExit={reset}
          />
        )}
        {step === "attract" && <AttractScreen onStart={() => setStep("register")} />}
        {step === "register" && (
          <RegistrationScreen
            onBack={() => setStep("attract")}
            onRegistered={(p) => {
              setParticipant(p);
              setStep("precapture");
            }}
          />
        )}
        {step === "precapture" && <PreCaptureScreen paused={confirmExit} onReady={() => setStep("camera")} />}
        {step === "camera" && <CameraScreen paused={confirmExit} onCaptured={handleCaptured} />}
        {step === "processing" && capture && (
          <ProcessingScreen
            capture={capture}
            paused={confirmExit}
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
            onConfirm={confirmPhoto}
            onRetake={backToCamera}
          />
        )}
        {step === "printing" && photo && (
          <PrintingScreen
            photo={photo}
            onRetake={retakeAfterError}
            onFinished={(printed) => {
              setStrip(printed);
              setStep(shareRef.current ? "share" : "done");
            }}
          />
        )}
        {step === "share" && shareRef.current && (
          <QrShareScreen share={shareRef.current} onNext={() => setStep("done")} />
        )}
        {step === "done" && <DoneScreen
            onReset={reset}
            strip={strip}
            share={shareRef.current}
            onViewQr={() => setStep("share")}
          />}
      </KioskFrame>
    </KioskViewport>
    </>
  );
}
