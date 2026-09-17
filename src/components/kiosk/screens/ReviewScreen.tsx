import { BrasilLogo } from "../BrasilLogo";
import { TouchButton } from "../TouchButton";

type Props = {
  photo: string;
  onConfirm: () => void;
  onRetake: () => void;
};

export function ReviewScreen({ photo, onConfirm, onRetake }: Props) {
  return (
    <>
      <BrasilLogo className="w-[16rem]" />

      <div className="animate-fade-up flex flex-col items-center gap-14">
        <h1 className="font-display text-[5.5rem] font-black uppercase leading-none">
          Gostou da sua foto?
        </h1>

        <div className="rounded-[1.5rem] bg-card p-6 shadow-[var(--shadow-touch)]">
          <div className="aspect-[5/7] w-[34rem] overflow-hidden bg-card">
            <img
              src={photo}
              alt="Prévia da sua foto para o passaporte"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mt-5 text-center text-2xl font-semibold uppercase tracking-[0.25em] text-card-foreground">
            Passaporte · 5x7
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-[52rem] flex-col gap-8">
        <TouchButton onClick={onConfirm}>Usar esta foto</TouchButton>
        <TouchButton variant="ghost" onClick={onRetake}>
          Tirar outra
        </TouchButton>
      </div>
    </>
  );
}
