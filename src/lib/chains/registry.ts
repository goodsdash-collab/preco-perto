import type { ChainDef } from "./types";

/**
 * Redes com busca pública verificada (out/2026). Todas checadas com requisições reais,
 * robots.txt respeitado (redes que proíbem /api ficaram de fora).
 */
export const REGISTRY: ChainDef[] = [
  { key: "zonasul", name: "Zona Sul", niches: ["mercado"], platform: "vtex", host: "www.zonasul.com.br", states: ["RJ"], region: "required", search: "is", simulate: true, osm: ["zona sul"], coverage: "Rio de Janeiro e Niterói" },
  { key: "prezunic", name: "Prezunic", niches: ["mercado"], platform: "vtex", host: "www.prezunic.com.br", states: ["RJ"], region: "required", search: "is", simulate: true, osm: ["prezunic"], coverage: "Região metropolitana do Rio" },
  { key: "atacadao", name: "Atacadão", niches: ["mercado"], platform: "vtex", host: "www.atacadao.com.br", states: "*", region: "required", search: "is", simulate: true, osm: ["atacadao"], osmNot: ["dia a dia", "atacadao do povo"], coverage: "Nacional (todas as UFs)" },
  { key: "paodeacucar", name: "Pão de Açúcar", niches: ["mercado"], platform: "gpa", host: "www.paodeacucar.com", states: "*", region: "required", search: "is", simulate: false, osm: ["pao de acucar", "minuto pao de acucar"], coverage: "SP, RJ, DF, CE, PE, PB, PI, GO e outras (definido pelo CEP)" },
  { key: "samsclub", name: "Sam's Club", niches: ["mercado"], platform: "vtex", host: "www.samsclub.com.br", states: "*", region: "optional", search: "is", simulate: true, osm: ["sams club", "sam s club"], coverage: "Nacional (clube de compras)", note: "Preço para sócios do clube." },
  { key: "savegnago", name: "Savegnago", niches: ["mercado"], platform: "vtex", host: "www.savegnago.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["savegnago"], coverage: "Interior de SP (Ribeirão Preto, Franca, Araraquara...)" },
  { key: "covabra", name: "Covabra", niches: ["mercado"], platform: "vtex", host: "www.covabra.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["covabra"], coverage: "Região de Campinas (SP)" },
  { key: "coop", name: "Coop", niches: ["mercado"], platform: "vtex", host: "www.coopsupermercado.com.br", states: ["SP"], region: "optional", search: "is", simulate: true, osm: ["coop"], coverage: "Grande SP / ABC e interior de SP" },
  { key: "mambo", name: "Mambo", niches: ["mercado"], platform: "vtex", host: "www.mambo.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["mambo"], coverage: "São Paulo (capital)" },
  { key: "giga", name: "Giga Atacado", niches: ["mercado"], platform: "vtex", host: "www.gigaatacado.com.br", states: ["SP"], region: "required", search: "is", simulate: true, osm: ["giga atacado"], coverage: "Grande SP" },
  { key: "oba", name: "Oba Hortifruti", niches: ["mercado"], platform: "vtex", host: "www.obahortifruti.com.br", states: ["SP", "DF", "GO", "PR"], region: "required", search: "is", simulate: true, osm: ["oba hortifruti", "oba"], coverage: "SP, DF, GO" },
  { key: "supernosso", name: "Super Nosso", niches: ["mercado"], platform: "vtex", host: "www.supernossoemcasa.com.br", states: ["MG"], region: "required", search: "is", simulate: true, osm: ["super nosso", "supernosso"], coverage: "Grande BH (MG)" },
  { key: "apoio", name: "Apoio Mineiro", niches: ["mercado"], platform: "vtex", host: "www.apoioentrega.com", states: ["MG"], region: "none", search: "catalog", simulate: true, osm: ["apoio mineiro", "apoio entrega"], coverage: "Grande BH (MG)" },
  { key: "muffato", name: "Super Muffato", niches: ["mercado"], platform: "vtex", host: "www.supermuffato.com.br", states: ["PR"], region: "none", search: "is", simulate: true, osm: ["muffato"], osmNot: ["max atacadista"], coverage: "PR e oeste de SP" },
  { key: "giassi", name: "Giassi", niches: ["mercado"], platform: "vtex", host: "www.giassi.com.br", states: ["SC"], region: "required", search: "is", simulate: true, osm: ["giassi"], coverage: "Santa Catarina" },
  { key: "carone", name: "Carone", niches: ["mercado"], platform: "vtex", host: "www.carone.com.br", states: ["ES"], region: "required", search: "is", simulate: true, osm: ["carone"], coverage: "Grande Vitória (ES)" },
  { key: "gbarbosa", name: "GBarbosa", niches: ["mercado"], platform: "vtex", host: "www.gbarbosa.com.br", states: ["SE", "BA", "AL", "PE"], region: "required", search: "is", simulate: true, osm: ["gbarbosa", "g barbosa"], coverage: "SE, BA, AL" },
  { key: "mercantil", name: "Mercantil Rodrigues", niches: ["mercado"], platform: "vtex", host: "www.mercantilrodrigues.com.br", states: ["BA"], region: "required", search: "is", simulate: true, osm: ["mercantil rodrigues"], coverage: "Bahia" },
  { key: "hiperideal", name: "Hiper Ideal", niches: ["mercado"], platform: "vtex", host: "www.hiperideal.com.br", states: ["BA"], region: "none", search: "is", simulate: true, osm: ["hiper ideal", "hiperideal"], coverage: "Salvador e região (BA)" },

  // ---- Farmácias
  { key: "paguemenos", name: "Pague Menos", niches: ["farmacia"], platform: "vtex", host: "www.paguemenos.com.br", states: "*", region: "none", search: "is", simulate: true, osm: ["pague menos"], coverage: "Nacional" },
  { key: "pacheco", name: "Drogarias Pacheco", niches: ["farmacia"], platform: "vtex", host: "www.drogariaspacheco.com.br", states: ["RJ", "MG", "ES", "GO", "DF", "BA"], region: "none", search: "is", simulate: true, osm: ["pacheco"], coverage: "RJ, MG, ES, GO, DF, BA" },
  { key: "drogariasp", name: "Drogaria São Paulo", niches: ["farmacia"], platform: "vtex", host: "www.drogariasaopaulo.com.br", states: ["SP", "DF", "GO", "PR", "BA", "PE"], region: "none", search: "is", simulate: true, osm: ["drogaria sao paulo"], coverage: "SP e outras UFs" },
  { key: "venancio", name: "Drogaria Venancio", niches: ["farmacia"], platform: "vtex", host: "www.drogariavenancio.com.br", states: ["RJ"], region: "none", search: "is", simulate: true, osm: ["venancio"], coverage: "Rio de Janeiro" },
  { key: "extrafarma", name: "Extrafarma", niches: ["farmacia"], platform: "vtex", host: "www.extrafarma.com.br", states: ["PA", "AM", "AP", "MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA", "TO"], region: "none", search: "is", simulate: true, osm: ["extrafarma"], coverage: "Norte e Nordeste" },
  { key: "drogal", name: "Drogal", niches: ["farmacia"], platform: "vtex", host: "www.drogal.com.br", states: ["SP"], region: "none", search: "is", simulate: true, osm: ["drogal"], coverage: "Interior de SP" },
  { key: "drogariaglobo", name: "Drogaria Globo", niches: ["farmacia"], platform: "vtex", host: "www.drogariaglobo.com.br", states: ["BA", "PA", "MA", "PI", "CE", "PE", "TO", "SE", "AL", "RN", "PB"], region: "required", search: "is", simulate: true, osm: ["drogaria globo", "farmacia globo"], coverage: "Norte e Nordeste (pelo CEP)" },
  // ---- Pet
  { key: "cobasi", name: "Cobasi", niches: ["pet"], platform: "vtex", host: "www.cobasi.com.br", states: "*", region: "none", search: "is", simulate: true, osm: ["cobasi"], coverage: "Nacional" },
  // ---- Construção
  { key: "obramax", name: "Obramax", niches: ["construcao"], platform: "vtex", host: "www.obramax.com.br", states: "*", region: "required", search: "is", simulate: true, osm: ["obramax"], coverage: "SP, RJ, MG e outras (pelo CEP)" },
  { key: "telhanorte", name: "Telhanorte", niches: ["construcao"], platform: "vtex", host: "www.telhanorte.com.br", states: ["SP"], region: "none", search: "is", simulate: true, osm: ["telhanorte", "telha norte"], coverage: "São Paulo" },
  { key: "tumelero", name: "Tumelero", niches: ["construcao"], platform: "vtex", host: "www.tumelero.com.br", states: ["RS"], region: "none", search: "is", simulate: true, osm: ["tumelero"], coverage: "Rio Grande do Sul" },
  { key: "joli", name: "Joli", niches: ["construcao"], platform: "vtex", host: "www.joli.com.br", states: ["PR", "SC"], region: "none", search: "is", simulate: true, osm: ["joli"], coverage: "PR e SC" },
  // ---- Autopeças
  { key: "autoz", name: "Autoz", niches: ["autopecas"], platform: "vtex", host: "www.autoz.com.br", states: "*", region: "none", search: "is", simulate: true, osm: ["autoz"], coverage: "Loja online (todo o Brasil)" },
  { key: "dpaschoal", name: "DPaschoal", niches: ["autopecas"], platform: "vtex", host: "www.dpaschoal.com.br", states: "*", region: "none", search: "is", simulate: true, osm: ["dpaschoal", "d paschoal"], coverage: "Nacional (pneus e peças)" },
  // ---- Geral (eletrônicos e qualquer produto fora de mercado)
  { key: "americanas", name: "Americanas", niches: ["eletronicos", "outros", "pet", "construcao", "autopecas", "farmacia", "padaria"], platform: "vtex", host: "www.americanas.com.br", states: "*", region: "none", search: "catalog", simulate: false, osm: ["americanas", "lojas americanas"], coverage: "Nacional (loja online + lojas físicas)", note: "Inclui vendedores parceiros do marketplace." },
];
