import path from "node:path";
import fsp from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MEDIA_ROOT, resolveMedia } from "@/lib/storage";
import { newId } from "@/lib/ids";

const run = promisify(execFile);

/**
 * Transcodage des medias deposes.
 *
 * Le fichier d'origine n'est jamais celui qu'on diffuse : un artiste depose
 * volontiers un WAV de 40 Mo ou un clip en pleine resolution, ce qui est
 * inecoutable sur une connexion mobile a Ouagadougou. On garde l'original pour
 * le telechargement, et on sert une version allegee pour l'ecoute.
 *
 * ffmpeg est invoque par execFile, jamais par un shell : les chemins viennent
 * de fichiers deposes par des tiers.
 */

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

let disponible = null;

/** ffmpeg est facultatif : sans lui le site fonctionne, en servant l'original. */
export async function ffmpegDisponible() {
  if (disponible !== null) return disponible;
  try {
    await run(FFMPEG, ["-version"]);
    await run(FFPROBE, ["-version"]);
    disponible = true;
  } catch {
    disponible = false;
  }
  return disponible;
}

/** Duree, debit, resolution : lus dans le conteneur, pas dans les tags. */
export async function analyser(relativePath) {
  if (!(await ffmpegDisponible())) return null;

  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    resolveMedia(relativePath),
  ]);

  const donnees = JSON.parse(stdout);
  const video = donnees.streams?.find((flux) => flux.codec_type === "video");
  const audio = donnees.streams?.find((flux) => flux.codec_type === "audio");

  return {
    duration: Math.round(Number(donnees.format?.duration) || 0),
    bitrate: Number(donnees.format?.bit_rate) || 0,
    width: video?.width || null,
    height: video?.height || null,
    audioCodec: audio?.codec_name || null,
    videoCodec: video?.codec_name || null,
    // Une pochette embarquee dans un MP3 apparait comme un flux video fixe.
    hasVideo: !!video && video.disposition?.attached_pic !== 1,
  };
}

/**
 * Version d'ecoute : MP3 128 kbit/s. Un WAV de 24 secondes passe de 2 Mo a
 * environ 380 Ko, soit six fois moins de donnees pour l'auditeur.
 */
export async function versionEcouteAudio(sourceRelative) {
  const cible = path.join("preview", `${newId()}.mp3`);
  await fsp.mkdir(path.join(MEDIA_ROOT, "preview"), { recursive: true });

  await run(FFMPEG, [
    "-nostdin", "-y",
    "-i", resolveMedia(sourceRelative),
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    resolveMedia(cible),
  ]);

  const { size } = await fsp.stat(resolveMedia(cible));
  return { relativePath: cible, mime: "audio/mpeg", size };
}

/** Image d'attente du clip, prise a la troisieme seconde. */
export async function afficheVideo(sourceRelative) {
  const cible = path.join("image", `${newId()}.jpg`);
  await fsp.mkdir(path.join(MEDIA_ROOT, "image"), { recursive: true });

  await run(FFMPEG, [
    "-nostdin", "-y",
    "-ss", "3",
    "-i", resolveMedia(sourceRelative),
    "-frames:v", "1",
    "-vf", "scale=640:-2",
    "-q:v", "4",
    resolveMedia(cible),
  ]);

  return cible;
}

/**
 * Decoupe le clip en HLS a deux definitions. Le lecteur choisit selon le debit
 * disponible et change en cours de route, au lieu de caler sur une seule
 * qualite trop lourde.
 */
export async function versionsHls(sourceRelative, { hauteurSource } = {}) {
  const dossier = path.join("hls", newId());
  const absolu = resolveMedia(dossier);
  await fsp.mkdir(path.join(absolu, "360"), { recursive: true });

  // Inutile de fabriquer un rendu 720p a partir d'une source plus petite.
  const avec720 = !hauteurSource || hauteurSource >= 700;
  if (avec720) await fsp.mkdir(path.join(absolu, "720"), { recursive: true });

  const filtre = avec720
    ? "[0:v]split=2[b1][b2];[b1]scale=w=640:h=360:force_original_aspect_ratio=decrease:force_divisible_by=2[v0];[b2]scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2[v1]"
    : "[0:v]scale=w=640:h=360:force_original_aspect_ratio=decrease:force_divisible_by=2[v0]";

  const arguments_ = [
    "-nostdin", "-y",
    "-i", resolveMedia(sourceRelative),
    "-filter_complex", filtre,
    "-map", "[v0]", "-c:v:0", "libx264", "-b:v:0", "700k", "-preset", "veryfast", "-g", "48",
    "-map", "0:a:0", "-c:a:0", "aac", "-b:a:0", "96k",
  ];

  if (avec720) {
    arguments_.push(
      "-map", "[v1]", "-c:v:1", "libx264", "-b:v:1", "2200k",
      "-map", "0:a:0", "-c:a:1", "aac", "-b:a:1", "128k",
    );
  }

  arguments_.push(
    "-f", "hls",
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_segment_filename", path.join(absolu, "%v", "segment_%03d.ts"),
    "-master_pl_name", "master.m3u8",
    "-var_stream_map", avec720 ? "v:0,a:0,name:360 v:1,a:1,name:720" : "v:0,a:0,name:360",
    path.join(absolu, "%v", "index.m3u8"),
  );

  await run(FFMPEG, arguments_, { maxBuffer: 16 * 1024 * 1024 });

  // Poids de la definition la plus basse : c'est ce qu'un auditeur en donnees
  // mobiles telechargera reellement, et non la taille du fichier d'origine.
  const dossier360 = path.join(absolu, "360");
  const fichiers = await fsp.readdir(dossier360);
  let poids360 = 0;
  for (const fichier of fichiers.filter((nom) => nom.endsWith(".ts"))) {
    poids360 += (await fsp.stat(path.join(dossier360, fichier))).size;
  }

  return { relativePath: dossier, master: path.join(dossier, "master.m3u8"), poids360 };
}
