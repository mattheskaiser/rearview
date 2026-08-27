/**
 * Controlled multilingual corpus for retrieval tests (session prompt > Testing).
 *
 * Each `theme` is expressed in German, English and Spanish, deliberately using
 * different wording so a match cannot come from shared keywords. Cross-language
 * retrieval tests embed every entry and check that same-theme entries across
 * languages are semantically close and that a query in one language surfaces the
 * theme's entries written in the other two.
 *
 * These are synthetic fixtures, not real journal content.
 */

export type CorpusLang = "de" | "en" | "es";

export type CorpusEntry = {
  id: string;
  theme: string;
  lang: CorpusLang;
  /** `YYYY-MM-DD` — spread across years so date-range filtering can be tested. */
  date: string;
  text: string;
};

export const MULTILINGUAL_CORPUS: CorpusEntry[] = [
  // ---- goals: concrete, measurable targets --------------------------------
  {
    id: "goals-de",
    theme: "goals",
    lang: "de",
    date: "2024-01-14",
    text: "Meine Ziele für dieses Jahr: die App endlich veröffentlichen und einen Halbmarathon laufen. Konkrete, messbare Vorhaben, an denen ich den Fortschritt sehen kann.",
  },
  {
    id: "goals-en",
    theme: "goals",
    lang: "en",
    date: "2024-02-03",
    text: "The targets I want to hit this year are shipping version one of the product and finishing a half marathon. Concrete milestones I can measure myself against.",
  },
  {
    id: "goals-es",
    theme: "goals",
    lang: "es",
    date: "2024-02-20",
    text: "Mis objetivos para el año: lanzar por fin la aplicación y correr una media maratón. Metas concretas y medibles con las que puedo seguir mi avance.",
  },

  // ---- work stress -------------------------------------------------------
  {
    id: "stress-de",
    theme: "stress",
    lang: "de",
    date: "2023-03-09",
    text: "Die Deadlines im Büro erdrücken mich gerade. Ich schlafe schlecht, bin dünnhäutig und der Druck lässt einfach nicht nach.",
  },
  {
    id: "stress-en",
    theme: "stress",
    lang: "en",
    date: "2023-05-22",
    text: "The workload this quarter has been crushing. Constant pressure, no room to breathe, and I go to bed tense every night.",
  },
  {
    id: "stress-es",
    theme: "stress",
    lang: "es",
    date: "2023-07-01",
    text: "Las entregas en la oficina me están aplastando. Duermo mal, estoy irritable y la presión no baja nunca.",
  },

  // ---- relationships ---------------------------------------------------
  {
    id: "rel-de",
    theme: "relationships",
    lang: "de",
    date: "2022-06-11",
    text: "Ein langes Telefonat mit meiner Schwester hat mir gutgetan. Enge Freundschaften und Zeit mit der Familie geben mir Halt.",
  },
  {
    id: "rel-en",
    theme: "relationships",
    lang: "en",
    date: "2022-08-19",
    text: "Had dinner with old friends and felt held by them. The people close to me are what I lean on when things wobble.",
  },
  {
    id: "rel-es",
    theme: "relationships",
    lang: "es",
    date: "2022-09-30",
    text: "Una larga charla con mi hermano me hizo bien. Las amistades cercanas y el tiempo en familia son mi punto de apoyo.",
  },

  // ---- happiness / contentment --------------------------------------
  {
    id: "joy-de",
    theme: "happiness",
    lang: "de",
    date: "2024-05-04",
    text: "Ein leichter, zufriedener Tag. Sonne auf dem Balkon, ein gutes Buch, nichts Dringendes — einfach ruhig und schön.",
  },
  {
    id: "joy-en",
    theme: "happiness",
    lang: "en",
    date: "2024-06-15",
    text: "A light, contented day. Coffee in the sun, a good novel, nothing urgent pulling at me. Just calm and pleasant.",
  },
  {
    id: "joy-es",
    theme: "happiness",
    lang: "es",
    date: "2024-07-22",
    text: "Un día ligero y a gusto. Sol en el balcón, un buen libro, nada urgente. Simplemente tranquilo y agradable.",
  },

  // ---- personal growth: a past realization about rest / boundaries --
  {
    id: "growth-de",
    theme: "growth",
    lang: "de",
    date: "2023-10-02",
    text: "Ich habe gelernt, Nein zu sagen und meine Pausen zu verteidigen. Früher hätte ich mich für andere überarbeitet.",
  },
  {
    id: "growth-en",
    theme: "growth",
    lang: "en",
    date: "2023-11-18",
    text: "One thing that has changed in me: I can turn down requests now and guard my downtime instead of overextending for everyone.",
  },
  {
    id: "growth-es",
    theme: "growth",
    lang: "es",
    date: "2023-12-27",
    text: "Aprendí a decir que no y a proteger mi descanso. Antes me habría sobrecargado con tal de no decepcionar a nadie.",
  },

  // ---- motivation: reconnecting with the reason to keep going ------
  {
    id: "motivation-de",
    theme: "motivation",
    lang: "de",
    date: "2024-09-08",
    text: "Ich versuche, wieder zu spüren, warum ich angefangen habe. Wenn der Antrieb zurückkommt, fühlt sich selbst ein kleiner Schritt lohnend an.",
  },
  {
    id: "motivation-en",
    theme: "motivation",
    lang: "en",
    date: "2024-10-12",
    text: "Trying to reconnect with the why behind all of this. When the drive comes back, even one small step forward feels worth it.",
  },
  {
    id: "motivation-es",
    theme: "motivation",
    lang: "es",
    date: "2024-11-05",
    text: "Intento reconectar con el porqué de todo esto. Cuando vuelve el impulso, hasta un pequeño paso adelante se siente valioso.",
  },

  // ---- a single entry mixing all three languages -----------------
  {
    id: "mixed-language",
    theme: "motivation",
    lang: "de",
    date: "2024-12-01",
    text: "Kurze Notiz: heute wieder angefangen. I want to keep going even when it is hard. Sigo adelante porque el motivo por el que empecé sigue ahí.",
  },

  // ---- a long entry, to exercise chunking in the pipeline test ---
  {
    id: "long-workday-en",
    theme: "daily-life",
    lang: "en",
    date: "2024-04-01",
    text: [
      "A fairly ordinary Monday. I woke up before the alarm, made coffee, and spent the first two hours clearing the backlog of messages that had piled up over the weekend. None of it was urgent, but leaving it unanswered nags at me, so I worked through the list one by one until the inbox was quiet again.",
      "Most of the afternoon disappeared into a review meeting that honestly could have been a paragraph in a document. Three people repeated the same point in slightly different words, and by the end I had lost the thread of what we actually decided. I made a note to suggest an agenda next time, though I say that after most of these meetings and never follow through.",
      "The one good stretch was late afternoon: a clear ninety minutes with no interruptions, which I spent on the retrieval code. It finally clicked how the ranking should handle entries in different languages, and I got a first version working. Small thing, but it is the part of the day I will remember.",
      "In the evening I cooked instead of ordering in, took a short walk around the block while the pasta water heated, and read for half an hour before bed. Nothing about the day was remarkable, and yet it felt balanced and sustainable in a way that a lot of days this year have not. That is the pace I keep saying I want.",
    ].join("\n\n"),
  },
];
