import type { ChainDef } from "./types";

/**
 * Redes com busca pública verificada (out/2026). Todas checadas com requisições reais,
 * robots.txt respeitado (redes que proíbem /api ficaram de fora).
 */
export const REGISTRY: ChainDef[] = [
  { key: "zonasul", name: "Zona Sul", platform: "vtex", host: "www.zonasul.com.br", states: ["RJ"], region: "required", search: "is", simulate: true, osm: ["zona sul"], coverage: "Rio de Janeiro e Niterói" },
  { key: "prezunic", name: "Prezunic", platform: "vtex", host: "www.prezunic.com.br", states: ["RJ"], region: "required", search: "is", simulate: true, osm: ["prezunic"], coverage: "Região metropolitana do Rio" },
  { key: "atacadao", name: "Atacadão", platform: "vtex", host: "www.atacadao.com.br", states: "*", region: "required", search: "is", simulate: true, osm: ["atacadao"], osmNot: ["dia a dia", "atacadao do povo"], coverage: "Nacional (todas as UFs)" },
  { key: "paodeacucar", name: "Pão de Açúcar", platform: "gpa", host: "www.paodeacucar.com", states: "*", region: "required", search: "is", simulate: false, osm: ["pao de acucar", "minuto pao de acucar"], coverage: "SP, RJ, DF, CE, PE, PB, PI, GO e outras (definido pelo CEP)" },
  { key: "samsclub", name: "Sam's Club", platform: "vtex", host: "www.samsclub.com.br", states: "*", region: "optional", search: "is", simulate: true, osm: ["sams club", "sam s club"], coverage: "Nacional (clube de compras)", note: "Preço para sócios do clube." },
  { key: "savegnago", name: "Savegnago", platform: "vtex", host: "www.savegnago.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["savegnago"], coverage: "Interior de SP (Ribeirão Preto, Franca, Araraquara...)" },
  { key: "covabra", name: "Covabra", platform: "vtex", host: "www.covabra.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["covabra"], coverage: "Região de Campinas (SP)" },
  { key: "coop", name: "Coop", platform: "vtex", host: "www.coopsupermercado.com.br", states: ["SP"], region: "optional", search: "is", simulate: true, osm: ["coop"], coverage: "Grande SP / ABC e interior de SP" },
  { key: "mambo", name: "Mambo", platform: "vtex", host: "www.mambo.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["mambo"], coverage: "São Paulo (capital)" },
  { key: "giga", name: "Giga Atacado", platform: "vtex", host: "www.gigaatacado.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["giga atacado"], coverage: "Grande SP" },
  { key: "oba", name: "Oba Hortifruti", platform: "vtex", host: "www.obahortifruti.com.br", states: ["SP", "DF", "GO", "PR"], region: "required", search: "is", simulate: true, osm: ["oba hortifruti", "oba"], coverage: "SP, DF, GO" },
  { key: "supernosso", name: "Super Nosso", platform: "vtex", host: "www.supernossoemcasa.com.br", states: ["MG"], region: "required", search: "is", simulate: true, osm: ["super nosso", "supernosso"], coverage: "Grande BH (MG)" },
  { key: "apoio", name: "Apoio Mineiro", platform: "vtex", host: "www.apoioentrega.com", states: ["MG"], region: "none", search: "catalog", simulate: true, osm: ["apoio mineiro", "apoio entrega"], coverage: "Grande BH (MG)" },
  { key: "muffato", name: "Super Muffato", platform: "vtex", host: "www.supermuffato.com.br", states: ["PR"], region: "none", search: "is", simulate: true, osm: ["muffato"], osmNot: ["max atacadista"], coverage: "PR e oeste de SP" },
  { key: "giassi", name: "Giassi", platform: "vtex", host: "www.giassi.com.br", states: ["SC"], region: "required", search: "is", simulate: true, osm: ["giassi"], coverage: "Santa Catarina" },
  { key: "carone", name: "Carone", platform: "vtex", host: "www.carone.com.br", states: ["ES"], region: "required", search: "is", simulate: true, osm: ["carone"], coverage: "Grande Vitória (ES)" },
  { key: "gbarbosa", name: "GBarbosa", platform: "vtex", host: "www.gbarbosa.com.br", states: ["SE", "BA", "AL", "PE"], region: "required", search: "is", simulate: true, osm: ["gbarbosa", "g barbosa"], coverage: "SE, BA, AL" },
  { key: "mercantil", name: "Mercantil Rodrigues", platform: "vtex", host: "www.mercantilrodrigues.com.br", states: ["BA"], region: "required", search: "is", simulate: true, osm: ["mercantil rodrigues"], coverage: "Bahia" },
  { key: "hiperideal", name: "Hiper Ideal", platform: "vtex", host: "www.hiperideal.com.br", states: ["BA"], region: "none", search: "is", simulate: true, osm: ["hiper ideal", "hiperideal"], coverage: "Salvador e região (BA)" },
];
