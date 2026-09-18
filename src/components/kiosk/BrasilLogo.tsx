import logoAsset from "@/assets/logo-brasil.png.asset.json";

export function BrasilLogo({ className = "w-[26rem]" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Brasil"
      className={`block h-auto max-w-full object-contain object-center p-[2%] ${className}`}
      draggable={false}
    />
  );
}
