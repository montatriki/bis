// Moteur conversationnel de l'assistant : un modèle de langage (NVIDIA NIM,
// API compatible OpenAI) qui comprend la question en langage naturel et
// appelle des outils pour lire les données.
//
// Deux garde-fous essentiels :
//   1. le modèle ne touche jamais la base — il demande, `outils.ts` exécute,
//      avec le périmètre du rôle (un commercial n'obtient que ses données) ;
//   2. il ne doit citer que les chiffres renvoyés par les outils : la consigne
//      l'interdit explicitement d'inventer ou de recalculer.
//
// Sans clé configurée, l'appelant retombe sur le moteur local par mots-clés.

const URL_BASE = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODELE = process.env.NVIDIA_MODEL ?? "mistralai/mistral-nemotron";
/** Un tour = une question ; au-delà, on rend la main pour ne pas boucler. */
const MAX_TOURS = 4;

export const iaDisponible = () => Boolean(process.env.NVIDIA_API_KEY);

export type OutilIA = {
  nom: string;
  description: string;
  parametres: Record<string, unknown>;
  executer: (args: Record<string, unknown>) => Promise<unknown>;
};

type MessageIA = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

/**
 * Retire le raisonnement que certains modèles préfixent à leur réponse
 * (« Okay, the user asked… », balises <think>) : l'utilisateur veut la
 * réponse, pas la délibération.
 */
function nettoyer(texte: string): string {
  let t = texte.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();

  // Délibération explicite (« Here's a thinking process: 1. … ») : on ne garde
  // que ce qui suit, ou rien si le modèle n'a pas conclu.
  const entete = t.match(/^(?:here'?s? (?:a|my) (?:thinking|thought) process|thinking process|my thought process|reasoning)\s*:?/i);
  if (entete) {
    const lignes = t.split("\n");
    // La réponse finale est la dernière portion en français sans numérotation.
    const i = lignes.findIndex((l, k) => k > 2 && /[éèàûôç]|TND|dinars/i.test(l) && !/^\s*[\d*\-.]+\s/.test(l) && l.trim().length > 25);
    t = i > 0 ? lignes.slice(i).join("\n").trim() : "";
  }
  // Raisonnement en anglais avant la réponse française : on garde l'après.
  const marqueurs = [/\bLet me (?:answer|respond|provide|format)\b[^\n]*\n+/i, /\bSo the (?:answer|response) is\b[^\n]*\n+/i, /\bFinal answer\b\s*:?\s*/i, /\bRéponse\s*:\s*/i];
  for (const m of marqueurs) {
    const i = t.search(m);
    if (i >= 0) { const apres = t.slice(i).replace(m, "").trim(); if (apres.length > 20) t = apres; }
  }
  // Paragraphes d'analyse en anglais en tête (« The user is asking… »).
  const paras = t.split(/\n{2,}/);
  if (paras.length > 1) {
    const utiles = paras.filter((p, i) => i === 0 ? !/^(okay|ok|the user|we need|i need|let'?s|first,|looking at)/i.test(p.trim()) : true);
    if (utiles.length && utiles.length < paras.length) t = utiles.join("\n\n").trim();
  }
  // Le modèle cite parfois sa consigne (« Actually, the rule: … ») : on ne
  // garde que ce qui suit, s'il a fini par répondre.
  const citation = t.match(/^(?:actually|but|however|wait)[,:]?\s+(?:the\s+)?(?:rule|instruction|system|guideline)/i);
  if (citation) {
    const paras = t.split(/\n{2,}/).filter((x) => !/\b(rule|instruction|system prompt|guideline)\b/i.test(x));
    t = paras.join("\n\n").trim();
  }
  // Reste un texte d'analyse en anglais : on préfère l'avouer que l'afficher.
  if (t && /^(okay|ok\b|the user|we need|i need|let'?s|first,|looking at|here'?s|actually|so,? the)/i.test(t.trim())) return "";
  return t.trim();
}

/**
 * Repère l'anglais qui subsiste au milieu d'une phrase française
 * (« J'ai from the tool: … »), que `nettoyer()` ne peut pas découper :
 * la réponse est alors redemandée au modèle.
 */
function anglaisResiduel(t: string): boolean {
  if (t.length < 4) return true;
  if (/\b(from the tool|the tool|the user|I should|I need to|according to|here is|here's|exists?, code|balance|city)\b/i.test(t)) return true;
  // Notes de travail du modèle (« Key points: », « Steps: », listes à puces
  // en anglais) : ce n'est pas une réponse à afficher.
  if (/^(key points?|steps?|notes?|plan|analysis|summary)\s*:/i.test(t.trim())) return true;
  if (/\b(I must call|I have to call|must call|when user names|when I open)\b/i.test(t)) return true;
  // Le modèle raconte parfois sa démarche en français : « L'utilisateur a
  // demandé…, j'ai utilisé chercher_client… ». Ce n'est pas une réponse.
  return /\b(l'utilisateur a demandé|j'ai (?:utilisé|appelé) (?:l'outil )?[a-z_]+|l'outil [a-z_]+ (?:a )?(?:renvoy|retourn))/i.test(t)
    || /\b(ouvrir_page|chercher_client|ouvrir_fiche)\b/.test(t);
}

/** Identifiant d'appel d'outil : certains modèles exigent 9+ caractères. */
const idAppel = () => `call_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

async function appelModele(messages: MessageIA[], outils: OutilIA[], signal: AbortSignal) {
  const r = await fetch(`${URL_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: MODELE,
      messages,
      // Température basse : on veut des réponses factuelles, pas créatives.
      temperature: 0.2,
      max_tokens: 700,
      ...(outils.length
        ? {
            tools: outils.map((o) => ({
              type: "function",
              function: { name: o.nom, description: o.description, parameters: o.parametres },
            })),
          }
        : {}),
    }),
    signal,
  });
  if (!r.ok) throw new Error(`NIM ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const m = d?.choices?.[0]?.message;
  if (!m) throw new Error("Réponse du modèle illisible");
  return m as MessageIA & { reasoning_content?: string };
}

/**
 * Conduit la conversation : le modèle peut demander des outils, on les exécute
 * et on lui rend les résultats, jusqu'à sa réponse finale.
 */
export async function repondreAvecIA(
  consigne: string,
  historique: { role: "user" | "assistant"; content: string }[],
  question: string,
  outils: OutilIA[],
  timeoutMs = 70_000,
): Promise<{ reponse: string; outilsUtilises: string[]; navigation?: string }> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);
  const utilises: string[] = [];
  // Un outil peut demander d'ouvrir un écran : on retient la dernière demande.
  let navigation: string | undefined;
  try {
    const messages: MessageIA[] = [
      { role: "system", content: consigne },
      // Les derniers échanges suffisent au suivi (« et en dinars ? »).
      ...historique.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    for (let tour = 0; tour < MAX_TOURS; tour++) {
      const m = await appelModele(messages, outils, ctrl.signal);
      const appels = m.tool_calls ?? [];
      if (!appels.length) {
        const texte = nettoyer(m.content ?? "");
        if (texte && !anglaisResiduel(texte)) return { reponse: texte, outilsUtilises: utilises, navigation };
        // Réponse absente, en anglais ou mêlée de raisonnement : on redemande
        // la phrase finale, en réutilisant les résultats d'outils déjà obtenus.
        if (tour < MAX_TOURS - 1) {
          messages.push({ role: "assistant", content: (m.content ?? "").slice(0, 400) });
          messages.push({
            role: "user",
            content:
              "Reformule en UNE phrase, entièrement en français, à partir des données déjà obtenues. "
              + "Aucun mot anglais, aucune explication, aucun raisonnement.",
          });
          continue;
        }
        // Dernier tour : mieux vaut la phrase imparfaite que rien.
        if (texte) return { reponse: texte, outilsUtilises: utilises, navigation };
        break;
      }

      messages.push({ role: "assistant", content: m.content ?? "", tool_calls: appels });
      for (const appel of appels) {
        const outil = outils.find((o) => o.nom === appel.function.name);
        let resultat: unknown;
        if (!outil) {
          resultat = { erreur: `Outil « ${appel.function.name} » inconnu.` };
        } else {
          utilises.push(outil.nom);
          try {
            const args = appel.function.arguments ? JSON.parse(appel.function.arguments) : {};
            resultat = await outil.executer(args as Record<string, unknown>);
          } catch (e) {
            resultat = { erreur: e instanceof Error ? e.message : "Lecture impossible" };
          }
        }
        if (resultat && typeof resultat === "object" && typeof (resultat as { navigation?: unknown }).navigation === "string") {
          const demande = (resultat as { navigation: string }).navigation;
          // Une fiche précise (/clients/41105383) prime sur l'écran qui la
          // contient (/clients) : le modèle appelle parfois les deux outils.
          const plusPrecis = !navigation
            || demande.startsWith(navigation)
            || !navigation.startsWith(demande);
          if (plusPrecis) navigation = demande;
        }
        messages.push({
          role: "tool",
          tool_call_id: appel.id || idAppel(),
          content: JSON.stringify(resultat),
        });
      }
    }
    throw new Error("Le modèle n'a pas conclu");
  } finally {
    clearTimeout(minuteur);
  }
}
