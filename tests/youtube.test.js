/**
 * Reconnaissance d'une adresse YouTube.
 *
 * Un DJ colle ce qu'il a sous la main : lien de partage, adresse longue,
 * short, parfois l'identifiant seul. Tout doit tomber juste — et surtout, une
 * adresse d'un autre domaine ne doit jamais passer : ce serait charger un cadre
 * arbitraire dans la page.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { identifiantYouTube } = await import("@/lib/youtube");

test("les formes usuelles d'une adresse YouTube sont reconnues", () => {
  const attendu = "dQw4w9WgXcQ";
  for (const adresse of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "  dQw4w9WgXcQ  ",
  ]) {
    assert.equal(identifiantYouTube(adresse), attendu, adresse);
  }
});

test("tout ce qui n'est pas YouTube est refuse", () => {
  for (const adresse of [
    "https://exemple.bf/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.attaquant.bf/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=trop-court",
    "https://www.youtube.com/",
    "",
    null,
  ]) {
    assert.equal(identifiantYouTube(adresse), null, String(adresse));
  }
});
