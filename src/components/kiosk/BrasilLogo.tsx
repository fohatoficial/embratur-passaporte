import logoAsset from "@/assets/brasil-logo.png.asset.json";

export function BrasilLogo({ className = "w-[26rem]" }: { className?: string }) {
  return <img src={logoAsset.url} alt="Brasil" className={className} draggable={false} />;
}
