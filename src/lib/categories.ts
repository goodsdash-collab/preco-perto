import { normalize } from "./text";

export type Niche = "mercado" | "padaria" | "farmacia" | "pet" | "construcao" | "autopecas" | "eletronicos" | "outros";

export const NICHE_INFO: Record<Niche, { label: string; icon: string; color: string }> = {
  mercado: { label: "Mercados", icon: "🛒", color: "#2f9e44" },
  padaria: { label: "Padarias", icon: "🥖", color: "#e67700" },
  farmacia: { label: "Farmácias", icon: "💊", color: "#e03131" },
  pet: { label: "Pet shops", icon: "🐾", color: "#9c36b5" },
  construcao: { label: "Construção", icon: "🧱", color: "#a0522d" },
  autopecas: { label: "Autopeças", icon: "🔧", color: "#1c7ed6" },
  eletronicos: { label: "Eletrônicos", icon: "📱", color: "#0b7285" },
  outros: { label: "Lojas", icon: "🏬", color: "#495057" },
};

/** Tipo de loja do OSM -> nicho */
export function nicheForShop(shop: string): Niche {
  switch (shop) {
    case "supermarket":
    case "convenience":
    case "wholesale":
    case "greengrocer":
      return "mercado";
    case "bakery":
    case "pastry":
    case "confectionery":
      return "padaria";
    case "pharmacy":
    case "chemist":
      return "farmacia";
    case "pet":
      return "pet";
    case "doityourself":
    case "hardware":
    case "trade":
    case "paint":
      return "construcao";
    case "car_parts":
    case "tyres":
      return "autopecas";
    case "electronics":
    case "mobile_phone":
    case "computer":
    case "appliance":
    case "hifi":
      return "eletronicos";
    default:
      return "outros";
  }
}

export const OSM_SHOPS = [
  "supermarket", "convenience", "wholesale", "greengrocer",
  "bakery", "pastry", "confectionery",
  "chemist", "pet",
  "doityourself", "hardware", "trade", "paint",
  "car_parts", "tyres",
  "electronics", "mobile_phone", "computer", "appliance", "hifi",
  "department_store", "variety_store",
];

// Palavras (normalizadas, comparadas como prefixo de palavra) -> nichos. Frases têm prioridade.
const RULES: [string, Niche[]][] = [
  // pet (antes de construção por causa de "areia sanitária")
  ["areia sanitaria", ["pet"]], ["areia higienica", ["pet"]], ["areia para gato", ["pet"]], ["tapete higienico", ["pet"]],
  ["racao", ["pet"]], ["petisco", ["pet"]], ["antipulga", ["pet"]], ["coleira", ["pet"]], ["bravecto", ["pet"]], ["nexgard", ["pet"]], ["simparic", ["pet"]],
  ["pedigree", ["pet"]], ["whiskas", ["pet"]], ["golden", ["pet"]], ["premier pet", ["pet"]], ["royal canin", ["pet"]], ["sache", ["pet"]], ["arranhador", ["pet"]],
  ["aquario", ["pet"]], ["comedouro", ["pet"]], ["bebedouro pet", ["pet"]], ["caes", ["pet"]], ["cachorro", ["pet"]], ["gato", ["pet"]], ["felino", ["pet"]], ["canino", ["pet"]],
  // farmácia
  ["dipirona", ["farmacia"]], ["paracetamol", ["farmacia"]], ["ibuprofeno", ["farmacia"]], ["remedio", ["farmacia"]], ["medicamento", ["farmacia"]], ["novalgina", ["farmacia"]],
  ["dorflex", ["farmacia"]], ["neosaldina", ["farmacia"]], ["buscopan", ["farmacia"]], ["tylenol", ["farmacia"]], ["advil", ["farmacia"]], ["aspirina", ["farmacia"]],
  ["omeprazol", ["farmacia"]], ["losartana", ["farmacia"]], ["amoxicilina", ["farmacia"]], ["loratadina", ["farmacia"]], ["xarope", ["farmacia"]], ["colirio", ["farmacia"]],
  ["soro fisiologico", ["farmacia"]], ["teste de gravidez", ["farmacia"]], ["termometro", ["farmacia"]], ["curativo", ["farmacia"]], ["band aid", ["farmacia"]],
  ["preservativo", ["farmacia", "mercado"]], ["camisinha", ["farmacia", "mercado"]], ["vitamina", ["farmacia"]], ["protetor solar", ["farmacia", "mercado"]],
  ["fralda", ["farmacia", "mercado"]], ["absorvente", ["farmacia", "mercado"]], ["hidratante", ["farmacia", "mercado"]], ["dermocosmetico", ["farmacia"]],
  ["generico", ["farmacia"]], ["comprimido", ["farmacia"]], ["pomada", ["farmacia"]], ["antialergico", ["farmacia"]], ["anti inflamatorio", ["farmacia"]],
  ["shampoo", ["mercado", "farmacia"]], ["condicionador", ["mercado", "farmacia"]], ["desodorante", ["mercado", "farmacia"]], ["creme dental", ["mercado", "farmacia"]],
  ["escova de dente", ["mercado", "farmacia"]], ["fio dental", ["mercado", "farmacia"]], ["sabonete", ["mercado", "farmacia"]], ["alcool 70", ["farmacia", "mercado"]],
  // autopeças (antes de construção/eletrônicos por "lâmpada farol", "bateria")
  ["pastilha de freio", ["autopecas"]], ["disco de freio", ["autopecas"]], ["fluido de freio", ["autopecas"]], ["oleo de motor", ["autopecas"]], ["oleo motor", ["autopecas"]],
  ["5w30", ["autopecas"]], ["5w40", ["autopecas"]], ["15w40", ["autopecas"]], ["10w40", ["autopecas"]], ["20w50", ["autopecas"]], ["filtro de oleo", ["autopecas"]], ["filtro de ar", ["autopecas"]],
  ["vela de ignicao", ["autopecas"]], ["bateria automotiva", ["autopecas"]], ["bateria de carro", ["autopecas"]], ["bateria moura", ["autopecas"]], ["pneu", ["autopecas"]],
  ["amortecedor", ["autopecas"]], ["correia dentada", ["autopecas"]], ["embreagem", ["autopecas"]], ["palheta", ["autopecas"]], ["limpador de para brisa", ["autopecas"]],
  ["lampada farol", ["autopecas"]], ["farol", ["autopecas"]], ["aditivo radiador", ["autopecas"]], ["radiador", ["autopecas"]], ["calota", ["autopecas"]], ["retrovisor", ["autopecas"]],
  // construção
  ["cimento", ["construcao"]], ["argamassa", ["construcao"]], ["areia", ["construcao"]], ["tijolo", ["construcao"]], ["bloco de concreto", ["construcao"]], ["telha", ["construcao"]],
  ["tinta", ["construcao"]], ["massa corrida", ["construcao"]], ["rejunte", ["construcao"]], ["piso", ["construcao"]], ["porcelanato", ["construcao"]], ["azulejo", ["construcao"]],
  ["cano", ["construcao"]], ["tubo pvc", ["construcao"]], ["pvc", ["construcao"]], ["torneira", ["construcao"]], ["chuveiro", ["construcao"]], ["fio eletrico", ["construcao"]],
  ["cabo flexivel", ["construcao"]], ["disjuntor", ["construcao"]], ["tomada", ["construcao"]], ["interruptor", ["construcao"]], ["parafuso", ["construcao"]], ["prego", ["construcao"]],
  ["furadeira", ["construcao"]], ["parafusadeira", ["construcao"]], ["martelo", ["construcao"]], ["serrote", ["construcao"]], ["ferramenta", ["construcao"]], ["chave de fenda", ["construcao"]],
  ["vaso sanitario", ["construcao"]], ["caixa d agua", ["construcao"]], ["caixa dagua", ["construcao"]], ["impermeabilizante", ["construcao"]], ["gesso", ["construcao"]],
  ["brita", ["construcao"]], ["vergalhao", ["construcao"]], ["compensado", ["construcao"]], ["fechadura", ["construcao"]], ["lampada", ["construcao", "mercado"]], ["fita isolante", ["construcao"]],
  // eletrônicos
  ["celular", ["eletronicos"]], ["smartphone", ["eletronicos"]], ["iphone", ["eletronicos"]], ["galaxy", ["eletronicos"]], ["xiaomi", ["eletronicos"]], ["motorola", ["eletronicos"]],
  ["fone", ["eletronicos"]], ["headset", ["eletronicos"]], ["carregador", ["eletronicos"]], ["cabo usb", ["eletronicos"]], ["power bank", ["eletronicos"]], ["smart tv", ["eletronicos"]],
  ["televisao", ["eletronicos"]], ["tv", ["eletronicos"]], ["notebook", ["eletronicos"]], ["computador", ["eletronicos"]], ["tablet", ["eletronicos"]], ["monitor", ["eletronicos"]],
  ["mouse", ["eletronicos"]], ["teclado", ["eletronicos"]], ["caixa de som", ["eletronicos"]], ["smartwatch", ["eletronicos"]], ["videogame", ["eletronicos"]], ["playstation", ["eletronicos"]],
  ["xbox", ["eletronicos"]], ["nintendo", ["eletronicos"]], ["pendrive", ["eletronicos"]], ["ssd", ["eletronicos"]], ["impressora", ["eletronicos"]], ["roteador", ["eletronicos"]],
  ["air fryer", ["eletronicos"]], ["airfryer", ["eletronicos"]], ["liquidificador", ["eletronicos"]], ["micro ondas", ["eletronicos"]], ["microondas", ["eletronicos"]], ["geladeira", ["eletronicos"]],
  ["ventilador", ["eletronicos"]], ["ar condicionado", ["eletronicos"]], ["pilha", ["mercado", "eletronicos"]],
  // padaria
  ["pao frances", ["padaria", "mercado"]], ["pao de sal", ["padaria", "mercado"]], ["pao de queijo", ["padaria", "mercado"]], ["pao doce", ["padaria", "mercado"]],
  ["sonho", ["padaria"]], ["croissant", ["padaria"]], ["baguete", ["padaria", "mercado"]], ["broa", ["padaria"]], ["rosca", ["padaria", "mercado"]], ["bolo", ["padaria", "mercado"]],
  ["salgado", ["padaria"]], ["coxinha", ["padaria"]], ["torta", ["padaria"]], ["sanduiche", ["padaria"]], ["pao", ["padaria", "mercado"]],
];

/** Classifica a busca em nichos (mercado como padrão). */
export function classify(q: string): Niche[] {
  let n = ` ${normalize(q)} `;
  const found: Niche[] = [];
  for (const [kw, niches] of RULES) {
    const words = n.trim().split(" ");
    const hit = kw.includes(" ")
      ? n.includes(` ${kw}`)
      : words.some((w) => w === kw || (kw.length >= 4 && w.startsWith(kw)));
    if (!hit) continue;
    if (kw.includes(" ")) n = n.replace(` ${kw}`, " "); // frase consumida não conta de novo
    for (const x of niches) if (!found.includes(x)) found.push(x);
    if (found.length >= 3) break;
  }
  return found.length ? found : ["mercado"];
}
