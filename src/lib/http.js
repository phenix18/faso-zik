import fs from "node:fs";
import { Readable } from "node:stream";

/**
 * Reponse de streaming compatible HTTP Range (RFC 7233).
 *
 * Sans "206 Partial Content", le navigateur ne peut ni deplacer la tete de
 * lecture dans une video ni reprendre un telechargement interrompu : c'est la
 * piece maitresse d'un site de streaming, pas un detail d'optimisation.
 */
export function rangeResponse(absolutePath, stat, mime, rangeHeader, options = {}) {
  const total = stat.size;
  const headers = new Headers({
    "Content-Type": mime || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": options.cacheControl || "private, max-age=0, must-revalidate",
    "Last-Modified": stat.mtime.toUTCString(),
  });
  if (options.filename) {
    const safe = options.filename.replace(/["\\]/g, "");
    headers.set(
      "Content-Disposition",
      `${options.disposition || "inline"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(
        options.filename,
      )}`,
    );
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!match) {
    headers.set("Content-Length", String(total));
    return new Response(toWebStream(fs.createReadStream(absolutePath)), { status: 200, headers });
  }

  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);

  if (start === null && end === null) {
    headers.set("Content-Length", String(total));
    return new Response(toWebStream(fs.createReadStream(absolutePath)), { status: 200, headers });
  }
  if (start === null) {
    // Forme "bytes=-500" : les 500 derniers octets.
    start = Math.max(total - end, 0);
    end = total - 1;
  } else if (end === null || end >= total) {
    end = total - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" },
    });
  }

  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(toWebStream(fs.createReadStream(absolutePath, { start, end })), {
    status: 206,
    headers,
  });
}

function toWebStream(nodeStream) {
  return Readable.toWeb(nodeStream);
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Une requete Range qui ne commence pas a 0 est une reprise, pas une ecoute. */
export function isFirstRequest(rangeHeader) {
  if (!rangeHeader) return true;
  const match = /^bytes=(\d*)-/.exec(rangeHeader);
  return !!match && (match[1] === "" || Number(match[1]) === 0);
}
