export type PreparationVideo = {
  id: string;
  title: string;
  description: string;
  category: "fritura" | "forno" | "preparo";
  videoUrl: string;
  youtubeId: string;
  keywords: string[];
};

export const PREPARATION_VIDEOS: PreparationVideo[] = [
  {
    id: "churros",
    title: "Como fritar churros",
    description: "Tutorial rápido para fritar churros no ponto certo.",
    category: "fritura",
    videoUrl: "https://youtu.be/0vKTU9GLFeE?si=GXtVj4VnSOoWbQ17",
    youtubeId: "0vKTU9GLFeE",
    keywords: ["churros", "como fritar churros", "fritar churros", "tutorial churros"],
  },
  {
    id: "rosquinhas",
    title: "Como assar rosquinhas",
    description: "Modo de preparo para rosquinhas assadas.",
    category: "forno",
    videoUrl: "https://youtu.be/CrMiNxsH74Q?si=GDaY4rncHjOCj0jJ",
    youtubeId: "CrMiNxsH74Q",
    keywords: ["rosquinha", "rosquinhas", "assar rosquinhas", "como assar rosquinhas"],
  },
  {
    id: "pao-frances",
    title: "Como assar pão francês",
    description: "Passo a passo para assar pão francês.",
    category: "forno",
    videoUrl: "https://youtu.be/LKeXcUBIwwE?si=XO6eFfRJTSNq9sBd",
    youtubeId: "LKeXcUBIwwE",
    keywords: ["pao frances", "pão francês", "assar pao frances", "assar pão francês"],
  },
  {
    id: "coxinha",
    title: "Como fritar coxinha",
    description: "Tutorial direto para fritar coxinha.",
    category: "fritura",
    videoUrl: "https://youtu.be/t00N3cPyqdU?si=6YdbyxzYdxH6uY78",
    youtubeId: "t00N3cPyqdU",
    keywords: ["coxinha", "fritar coxinha", "como fritar coxinha"],
  },
  {
    id: "croquete",
    title: "Como fritar croquete",
    description: "Modo de preparo para croquete.",
    category: "fritura",
    videoUrl: "https://youtu.be/HRfyjoFldK8?si=gXkc9X5XNO7NYFqe",
    youtubeId: "HRfyjoFldK8",
    keywords: ["croquete", "fritar croquete", "como fritar croquete"],
  },
  {
    id: "dadinho",
    title: "Como fritar dadinho",
    description: "Tutorial de fritura para dadinho.",
    category: "fritura",
    videoUrl: "https://youtu.be/wvJeae4mj4s?si=tPNnDWkV36E3voVh",
    youtubeId: "wvJeae4mj4s",
    keywords: ["dadinho", "fritar dadinho", "como fritar dadinho"],
  },
  {
    id: "kibe",
    title: "Como fritar kibe",
    description: "Passo a passo rápido para fritar kibe.",
    category: "fritura",
    videoUrl: "https://youtu.be/yX0FOYwLUMQ?si=Yqji2G1Vry_01DhE",
    youtubeId: "yX0FOYwLUMQ",
    keywords: ["kibe", "quibe", "fritar kibe", "como fritar kibe", "fritar quibe"],
  },
  {
    id: "salgado-geral",
    title: "Como fritar salgado no geral",
    description: "Tutorial geral para fritura de salgados.",
    category: "fritura",
    videoUrl: "https://youtu.be/iB2dQXq8O24?si=umwg1kkU9VZSpOQr",
    youtubeId: "iB2dQXq8O24",
    keywords: [
      "salgado",
      "fritar salgado",
      "como fritar salgado",
      "fritura de salgado",
      "salgado no geral",
    ],
  },
  {
    id: "pao-de-queijo",
    title: "Como preparar pão de queijo",
    description: "Modo de preparo para pão de queijo.",
    category: "preparo",
    videoUrl: "https://youtu.be/KlMNCJ-KtUA?si=KL-T7Un23A0izJfx",
    youtubeId: "KlMNCJ-KtUA",
    keywords: [
      "pao de queijo",
      "pão de queijo",
      "preparar pao de queijo",
      "como preparar pao de queijo",
    ],
  },
  {
    id: "broa",
    title: "Como preparar broa",
    description: "Tutorial de preparo de broa.",
    category: "preparo",
    videoUrl: "https://youtu.be/bnlFJGYATpI?si=29uetInyUg78YWEd",
    youtubeId: "bnlFJGYATpI",
    keywords: ["broa", "preparar broa", "como preparar broa"],
  },
  {
    id: "biscoito-de-queijo",
    title: "Como preparar biscoito de queijo",
    description: "Passo a passo para preparar biscoito de queijo.",
    category: "preparo",
    videoUrl: "https://youtu.be/ELxTxW90Ab0?si=NuIR1j4gaEEphVYi",
    youtubeId: "ELxTxW90Ab0",
    keywords: [
      "biscoito de queijo",
      "preparar biscoito de queijo",
      "como preparar biscoito de queijo",
    ],
  },
];

export function getPreparationThumbnail(video: PreparationVideo) {
  return `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
}

