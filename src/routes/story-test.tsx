import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { buildSocialPhotoAssets } from "@/lib/buildSocialPhotoAssets";

export const Route = createFileRoute("/story-test")({
  component: StoryTest,
});

function makeTestPhoto(): string {
  const c = document.createElement("canvas");
  c.width = c.height = 1440;
  const x = c.getContext("2d")!;
  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 0, 1440, 1440);
  x.fillStyle = "#8a5a3b";
  x.beginPath();
  x.ellipse(720, 560, 240, 300, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "#3b2a1a";
  x.beginPath();
  x.ellipse(720, 380, 250, 160, 0, Math.PI, Math.PI * 2);
  x.fill();
  x.fillStyle = "#2b4a8a";
  x.beginPath();
  x.moveTo(340, 1440);
  x.quadraticCurve(720, 980, 1100, 1440);
  x.closePath();
  x.fill();
  return c.toDataURL("image/png");
}

function StoryTest() {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    buildSocialPhotoAssets(makeTestPhoto())
      .then(({ story }) => setUrl(URL.createObjectURL(story)))
      .catch(() => setErr("falha"));
  }, []);
  return (
    <div style={{ background: "#111", minHeight: "100vh" }}>
      {err && <p>{err}</p>}
      {url && <img src={url} alt="story" style={{ width: 540, height: 960 }} data-testid="story" />}
    </div>
  );
}
