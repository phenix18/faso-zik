import { z } from "zod";
import { createUser, publicUser } from "@/lib/repo/users";
import { fail, json } from "@/lib/http";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres.").max(80),
  email: z.string().email("Adresse e-mail invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres."),
  role: z.enum(["auditeur", "artiste"]).default("auditeur"),
  city: z.string().max(80).optional(),
  bio: z.string().max(1000).optional(),
});

export async function POST(request) {
  const limit = await rateLimit(clientKey(request, "register"), {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfter,
      "Trop de comptes crees depuis cette connexion. Reessayez plus tard.",
    );
  }

  let payload;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    return fail(error.errors?.[0]?.message || "Donnees d'inscription invalides.", 422);
  }

  try {
    const user = await createUser(payload);
    return json({ user: publicUser(user) }, 201);
  } catch (error) {
    return fail(error.message, 409);
  }
}
