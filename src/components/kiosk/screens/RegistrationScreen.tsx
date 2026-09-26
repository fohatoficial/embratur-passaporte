import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { AsYouType, type CountryCode } from "libphonenumber-js";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { registerActivationParticipant } from "@/lib/registerParticipant.functions";
import { COUNTRIES, normalizeAge, normalizeEmail, normalizeName, normalizeWhatsapp } from "@/lib/participant";
import { OriginCountrySelect } from "../OriginCountrySelect";
import { BrasilLogo } from "../BrasilLogo";
import { DialCodeSelect } from "../DialCodeSelect";
import { KioskSpinner } from "../KioskSpinner";

const PRIVACY_URL = "https://embratur.com.br/institucional/ouvidoria/";

export type Participant = { participantId: string; sessionId: string };

type Props = { onBack: () => void; onRegistered: (p: Participant) => void };

function blurActive() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export function RegistrationScreen({ onBack, onRegistered }: Props) {
  // uma sessão por formulário: repetir o envio reutiliza o mesmo ID
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const register = useServerFn(registerActivationParticipant);

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<string | null>(null);
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<CountryCode>("AR");
  const [phone, setPhone] = useState("");
  // novo formulário a cada atendimento (a tela é remontada): ambos começam marcados
  const [privacy, setPrivacy] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const [touched, setTouched] = useState({ name: false, origin: false, age: false, email: false, phone: false });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [modal, setModal] = useState<"none" | "notice" | "channel">("none");
  const submitting = useRef(false);

  const validName = normalizeName(name);
  const validPhone = normalizeWhatsapp(phone, country);
  const validAge = normalizeAge(age);
  const validEmail = normalizeEmail(email);
  const allValid = !!validName && !!origin && !!validAge && !!validEmail && !!validPhone;
  const canSubmit = allValid && privacy && !saving;
  const showNameError = (touched.name || attempted) && !validName;
  const showOriginError = (touched.origin || attempted) && !origin;
  const showAgeError = (touched.age || attempted) && !validAge;
  const showEmailError = (touched.email || attempted) && !validEmail;
  const showPhoneError = (touched.phone || attempted) && !validPhone;
  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "";

  const clearAndBack = () => {
    blurActive();
    setName("");
    setOrigin(null);
    setAge("");
    setEmail("");
    setPhone("");
    setPrivacy(true);
    setMarketing(true);
    onBack();
  };

  const submit = async () => {
    setAttempted(true);
    blurActive();
    if (!validName || !origin || !validAge || !validEmail || !validPhone || !privacy || submitting.current)
      return;
    submitting.current = true;
    setSaving(true);
    setFailed(false);
    try {
      const res = await register({
        data: {
          sessionId,
          name: validName,
          whatsapp: validPhone,
          country,
          originCountry: origin,
          age: validAge,
          email: validEmail,
          privacyAccepted: true,
          marketingOptIn: marketing,
        },
      });
      if (!res.ok) throw new Error(res.error);
      onRegistered({ participantId: res.participantId, sessionId });
    } catch {
      setFailed(true);
      setSaving(false);
      submitting.current = false;
    }
  };

  const inputBase =
    "w-full rounded-[1.75rem] border-4 bg-card px-8 py-5 text-[2.4rem] font-semibold text-card-foreground outline-none transition-colors placeholder:text-card-foreground/40 focus:border-brasil-yellow focus:ring-4 focus:ring-brasil-yellow/40 disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        onClick={clearAndBack}
        disabled={saving}
        aria-label="Volver"
        className="absolute left-12 top-16 z-10 flex h-28 w-28 items-center justify-center rounded-full border-4 border-border bg-secondary/60 active:scale-95 disabled:opacity-50"
      >
        <ArrowLeft className="h-14 w-14" strokeWidth={3} />
      </button>

      <BrasilLogo className="w-[16rem]" />

      <form
        className="flex w-full max-w-[56rem] flex-col gap-6"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-4 text-center">
          <h1 className="font-display text-[3.6rem] font-black uppercase leading-[0.95]">
            Antes de comenzar,
            <br />
            cuéntanos quién eres.
          </h1>
          <p className="text-[1.85rem] font-medium leading-snug text-muted-foreground">
            Completa tus datos para vivir la experiencia y recibir tu fotografía impresa.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-display text-[1.75rem] font-black uppercase tracking-[0.12em]">
            Nombre
          </span>
          <input
            type="text"
            name="kiosk-visitor-name"
            value={name}
            disabled={saving}
            maxLength={80}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="¿Cómo podemos llamarte?"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            className={`${inputBase} ${showNameError ? "border-brasil-red" : "border-transparent"}`}
          />
          {showNameError && (
            <span className="text-[1.6rem] font-semibold text-brasil-yellow">
              Escribe un nombre válido.
            </span>
          )}
        </label>

        <div className="flex gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-display text-[1.75rem] font-black uppercase tracking-[0.12em]">País de origen</span>
            <OriginCountrySelect
              value={origin}
              disabled={saving}
              invalid={showOriginError}
              onChange={setOrigin}
              onClose={() => setTouched((t) => ({ ...t, origin: true }))}
            />
            {showOriginError && <span className="text-[1.6rem] font-semibold text-brasil-yellow">Selecciona tu país de origen.</span>}
          </div>
          <label className="flex w-[13rem] shrink-0 flex-col gap-2">
            <span className="font-display text-[1.75rem] font-black uppercase tracking-[0.12em]">Edad</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="kiosk-visitor-age"
              value={age}
              disabled={saving}
              autoComplete="off"
              enterKeyHint="next"
              placeholder="Edad"
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onBlur={() => setTouched((t) => ({ ...t, age: true }))}
              className={`${inputBase} text-center ${showAgeError ? "border-brasil-red" : "border-transparent"}`}
            />
            {showAgeError && <span className="text-[1.6rem] font-semibold text-brasil-yellow">Introduce una edad válida.</span>}
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-display text-[1.75rem] font-black uppercase tracking-[0.12em]">E-mail</span>
          <input
            type="email"
            inputMode="email"
            name="kiosk-visitor-email"
            value={email}
            disabled={saving}
            maxLength={254}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="nombre@correo.com"
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            className={`${inputBase} ${showEmailError ? "border-brasil-red" : "border-transparent"}`}
          />
          {showEmailError && <span className="text-[1.6rem] font-semibold text-brasil-yellow">Introduce un e-mail válido.</span>}
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-display text-[1.75rem] font-black uppercase tracking-[0.12em]">
            WhatsApp
          </span>
          <div className="flex gap-4">
            <DialCodeSelect
              value={country}
              disabled={saving}
              onChange={(code) => {
                setCountry(code);
                setPhone("");
              }}
            />
            <input
              type="tel"
              inputMode="tel"
              name="kiosk-visitor-phone"
              value={phone}
              disabled={saving}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder={country === "AR" ? "9 11 2345-6789" : country === "BR" ? "11 91234-5678" : "Número"}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
                setPhone(new AsYouType(country).input(digits));
              }}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              aria-describedby="dial-code"
              className={`${inputBase} ${showPhoneError ? "border-brasil-red" : "border-transparent"}`}
            />
          </div>
          <span id="dial-code" className="sr-only">
            Código {dial}
          </span>
          {showPhoneError && (
            <span className="text-[1.6rem] font-semibold text-brasil-yellow">
              Introduce un número de WhatsApp válido.
            </span>
          )}
        </div>

        <Checkbox checked={privacy} disabled={saving} onChange={setPrivacy}>
          He leído el{" "}
          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              blurActive();
              setModal("notice");
            }}
            className="font-bold text-brasil-yellow underline underline-offset-4"
          >
            Aviso de Privacidad
          </button>{" "}
          y autorizo el tratamiento de mis datos para realizar esta experiencia.
        </Checkbox>
        {!privacy && (
          <span className="-mt-5 pl-[6.5rem] text-[1.5rem] font-medium text-brasil-yellow">
            Debes aceptar el Aviso de Privacidad para continuar.
          </span>
        )}

        <Checkbox checked={marketing} disabled={saving} onChange={setMarketing}>
          Quiero recibir novedades y comunicaciones de Visit Brasil por e-mail y WhatsApp.
        </Checkbox>

        {failed && (
          <p role="alert" className="text-center text-[1.9rem] font-semibold text-brasil-yellow">
            No pudimos guardar tus datos. Inténtalo de nuevo.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="font-display flex w-full items-center justify-center gap-6 rounded-full bg-primary px-16 py-10 text-[3rem] font-black uppercase tracking-[0.08em] text-primary-foreground shadow-[var(--shadow-touch)] transition-transform active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
        >
          {saving ? (
            <>
              <KioskSpinner size={52} />
              Guardando…
            </>
          ) : failed ? (
            "Intentar de nuevo"
          ) : (
            <>
              Continuar
              <ArrowRight className="h-12 w-12" strokeWidth={3} />
            </>
          )}
        </button>
      </form>

      <p className="text-2xl font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Brasil 2027
      </p>

      {modal !== "none" && (
        <div className="animate-journey-in absolute inset-0 z-20 flex items-center justify-center bg-brasil-blue-dark/95 px-14 py-20 backdrop-blur-sm">
          {modal === "notice" ? (
            <PrivacyNotice onClose={() => setModal("none")} onChannel={() => setModal("channel")} />
          ) : (
            <PrivacyChannel onClose={() => setModal("notice")} />
          )}
        </div>
      )}
    </>
  );
}

function Checkbox({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-6">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.25rem] border-4 transition-colors focus:outline-none focus:ring-4 focus:ring-brasil-yellow/50 disabled:opacity-60 ${
          checked ? "border-brasil-yellow bg-brasil-yellow text-brasil-blue-dark" : "border-border bg-secondary/60"
        }`}
      >
        {checked && <Check className="h-12 w-12" strokeWidth={4} />}
      </button>
      <p
        className="pt-2 text-[1.85rem] font-medium leading-snug"
        onClick={() => !disabled && onChange(!checked)}
      >
        {children}
      </p>
    </div>
  );
}

function PrivacyNotice({ onClose, onChannel }: { onClose: () => void; onChannel: () => void }) {
  return (
    <div className="flex max-h-full w-full max-w-[60rem] flex-col gap-10 rounded-[2.5rem] bg-card p-14 text-card-foreground">
      <h2 className="font-display text-[3.25rem] font-black uppercase leading-none">
        Aviso de Privacidad
      </h2>
      <div className="flex flex-col gap-6 overflow-y-auto text-[1.8rem] leading-snug">
        <p>
          Para participar en esta experiencia, recopilamos tu nombre, país de origen, edad, e-mail,
          número de WhatsApp y fotografía.
        </p>
        <p>
          Estos datos serán utilizados por{" "}
          <strong>Embratur – Agencia Brasileña de Promoción Internacional del Turismo</strong>{" "}
          exclusivamente para registrar tu participación, procesar y preparar tu fotografía,
          generar las copias impresas y la versión digital, gestionar eventuales reimpresiones,
          brindar soporte y mantener la seguridad y el correcto funcionamiento de la activación.
        </p>
        <p>
          Tu fotografía podrá ser procesada por proveedores tecnológicos contratados para la
          eliminación del fondo, el almacenamiento, la generación de los archivos, el envío a la
          estación de impresión y la disponibilidad de la versión digital mediante QR Code.
        </p>
        <p>
          Tus datos y fotografías{" "}
          <strong>
            no serán utilizados en campañas publicitarias, publicaciones institucionales o redes
            sociales de Embratur sin una autorización específica y separada
          </strong>
          .
        </p>
        <p>
          Tus datos de registro, comprobantes de autorización, fotografía y archivos relacionados
          podrán conservarse durante un plazo máximo de <strong>12 meses</strong>, exclusivamente
          para soporte, registro y gestión de esta activación. Después de ese plazo serán
          eliminados o anonimizados de forma segura, salvo que una obligación aplicable exija su
          conservación.
        </p>
        <p>
          Puedes solicitar información sobre el tratamiento de tus datos, acceso, corrección,
          revocación de la autorización o eliminación mediante el{" "}
          <button
            type="button"
            onClick={onChannel}
            className="font-bold text-brasil-blue underline underline-offset-4"
          >
            Canal de Privacidad de Embratur
          </button>
          .
        </p>
        <p>
          Al marcar la autorización y tocar <strong>CONTINUAR</strong>, declaras haber leído y comprendido este
          aviso y autorizas el tratamiento de tus datos para las finalidades informadas.
        </p>
      </div>
      <CloseButton onClick={onClose} />
    </div>
  );
}

function PrivacyChannel({ onClose }: { onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // gerado localmente; nenhum dado do visitante
    void QRCode.toString(PRIVACY_URL, { type: "svg", margin: 1, width: 480 }).then((s) => {
      if (alive) setSvg(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex w-full max-w-[52rem] flex-col items-center gap-10 rounded-[2.5rem] bg-card p-14 text-center text-card-foreground">
      <h2 className="font-display text-[3rem] font-black uppercase leading-none">
        Canal de Privacidad de Embratur
      </h2>
      <p className="text-[1.8rem] leading-snug">Escanea el código con tu teléfono.</p>
      <div className="h-[30rem] w-[30rem] bg-card">
        {svg && (
          <img
            alt="Código QR del Canal de Privacidad"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
            className="h-full w-full"
          />
        )}
      </div>
      <p className="break-all text-[1.4rem] opacity-70">{PRIVACY_URL}</p>
      <CloseButton onClick={onClose} />
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-display flex items-center justify-center gap-4 self-center rounded-full bg-brasil-blue px-14 py-7 text-[2.25rem] font-black uppercase tracking-[0.08em] text-foreground active:scale-95"
    >
      <X className="h-10 w-10" strokeWidth={3} />
      Cerrar
    </button>
  );
}
