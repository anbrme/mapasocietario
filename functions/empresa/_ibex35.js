/**
 * Curated IBEX 35 seed for the publicly-traded SEO launch.
 *
 * Keyed by a CLEAN, human/SEO-friendly slug (decoupled from the messy BORME
 * doc name) → the exact verified v3 doc to render, plus market data from the
 * owner's Google Sheet (NIF/ISIN/ticker/website) and the registry `hoja`
 * (the stable entity key).
 *
 * The `_` filename prefix means Cloudflare Pages does NOT route this file; it
 * is imported by [slug].js. Each v3Name + hoja was verified live against
 * api.ncdata.eu (v3) and cross-checked with GLEIF (ISIN→LEI→legal name) on
 * 2026-06-02. `note` flags entities that need ongoing attention.
 */

export const SEED = {
  'acs':                          { name: 'ACS', v3Name: 'ACS ACTIVIDADES DE CONSTRUCCION Y SERVICIOS SA', nif: 'A-28004885', isin: 'ES0167050915', ticker: 'BME:ACS', sector: 'Construcción', website: 'https://www.grupoacs.com/', hoja: 'M 30221' },
  'acerinox':                     { name: 'Acerinox', v3Name: 'ACERINOX SA', nif: 'A-28250777', isin: 'ES0132105018', ticker: 'BME:ACX', sector: 'Acero', website: 'https://acerinox.com/', hoja: 'M 68935' },
  'amadeus-it-group':             { name: 'Amadeus IT Group', v3Name: 'AMADEUS IT GROUP SOCIEDAD ANONIMA', nif: 'A-84236934', isin: 'ES0109067019', ticker: 'BME:AMS', sector: 'Turismo', website: 'https://amadeus.com/', hoja: 'M 371900' },
  'acciona':                      { name: 'Acciona', v3Name: 'ACCIONA SA', nif: 'A08001851', isin: 'ES0125220311', ticker: 'BME:ANA', sector: 'Construcción', website: 'https://www.acciona.com/', hoja: 'M 216384' },
  'acciona-energia':              { name: 'Acciona Energía', v3Name: 'CORPORACION ACCIONA ENERGIAS RENOVABLES SA', nif: 'A85483311', isin: 'ES0105563003', ticker: 'BME:ANE', sector: 'Energía', website: 'https://www.acciona.com/', hoja: 'M 465678' },
  'bbva':                         { name: 'BBVA', v3Name: 'BANCO BILBAO VIZCAYA ARGENTARIA SOCIEDAD ANONIMA', nif: 'A48265169', isin: 'ES0113211835', ticker: 'BME:BBVA', sector: 'Banca', website: 'https://www.bbva.com/', hoja: 'BI 17' },
  'bankinter':                    { name: 'Bankinter', v3Name: 'BANKINTER SOCIEDAD ANONIMA', nif: 'A28157360', isin: 'ES0113679I37', ticker: 'BME:BKT', sector: 'Banca', website: 'https://www.bankinter.com/', hoja: 'M 7766' },
  'caixabank':                    { name: 'CaixaBank', v3Name: 'CAIXABANK SA', nif: 'A08663619', isin: 'ES0140609019', ticker: 'BME:CABK', sector: 'Banca', website: 'https://www.caixabank.com/', hoja: 'V 178351' },
  'cellnex':                      { name: 'Cellnex Telecom', v3Name: 'CELLNEX TELECOM SA', nif: 'A64907306', isin: 'ES0105066007', ticker: 'BME:CLNX', sector: 'Telecomunicaciones', website: 'https://www.cellnex.com/', hoja: 'M 656490' },
  'inmobiliaria-colonial':        { name: 'Inmobiliaria Colonial', v3Name: 'COLONIAL SFL SOCIMI SA', nif: 'A-28027399', isin: 'ES0139140174', ticker: 'BME:COL', sector: 'Inmobiliario', website: 'https://www.inmocolonial.com/', hoja: 'M 30822' },
  'aena':                         { name: 'AENA', v3Name: 'AENA S.M.E. SA', nif: 'A86212420', isin: 'ES0105046017', ticker: 'BME:AENA', sector: 'Aeropuertos', website: 'https://www.aena.es/', hoja: 'M 518648' },
  'endesa':                       { name: 'Endesa', v3Name: 'ENDESA SA', nif: 'A-81948077', isin: 'ES0130670112', ticker: 'BME:ELE', sector: 'Energía', website: 'https://www.endesa.com/', hoja: 'M 6405' },
  'enagas':                       { name: 'Enagás', v3Name: 'ENAGAS SA', nif: 'A-28294726', isin: 'ES0130960018', ticker: 'BME:ENG', sector: 'Energía', website: 'https://www.enagas.es/', hoja: 'M 6113' },
  'fluidra':                      { name: 'Fluidra', v3Name: 'FLUIDRA SA', nif: 'A-17728593', isin: 'ES0137650018', ticker: 'BME:FDR', sector: 'Industria', website: 'https://www.fluidra.com/', hoja: 'B 290316' },
  'ferrovial':                    { name: 'Ferrovial', v3Name: 'FERROVIAL SA', nif: 'A-81939209', isin: 'NL0015001FS8', ticker: 'BME:FER', sector: 'Infraestructuras', website: 'https://www.ferrovial.com/', hoja: 'M 204873', country: 'NL', note: 'Redomiciliada a Países Bajos (Ferrovial N.V.) en 2023; esta es la entidad española histórica.' },
  'grifols':                      { name: 'Grifols', v3Name: 'GRIFOLS SA', nif: 'A58389123', isin: 'ES0171996087', ticker: 'BME:GRF', sector: 'Farmacéutica', website: 'https://www.grifols.com/', hoja: 'B 110367' },
  'international-airlines-group':  { name: 'International Airlines Group (IAG)', v3Name: 'INTERNATIONAL CONSOLIDATED AIRLINES GROUP SA', nif: 'A85845535', isin: 'ES0177542018', ticker: 'BME:IAG', sector: 'Aerolíneas', website: 'https://www.iairgroup.com/', hoja: 'M 492129' },
  'iberdrola':                    { name: 'Iberdrola', v3Name: 'IBERDROLA SOCIEDAD ANONIMA', nif: 'A-48010615', isin: 'ES0144580Y14', ticker: 'BME:IBE', sector: 'Energía', website: 'https://www.iberdrola.com/', hoja: 'BI 167' },
  'indra':                        { name: 'Indra', v3Name: 'INDRA SISTEMAS SA', nif: 'A-28599033', isin: 'ES0118594417', ticker: 'BME:IDR', sector: 'Tecnología', website: 'https://www.indracompany.com/', hoja: 'M 11339' },
  'inditex':                      { name: 'Inditex', v3Name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)', nif: 'A-15075062', isin: 'ES0148396007', ticker: 'BME:ITX', sector: 'Textil', website: 'https://www.inditex.com/', hoja: 'C 3342' },
  'logista':                      { name: 'Logista', v3Name: 'LOGISTA INTEGRAL SA', nif: 'A87008579', isin: 'ES0105027009', ticker: 'BME:LOG', sector: 'Logística', website: 'https://www.logista.com/', hoja: 'M 581239', note: 'Verificar vs. la holding cotizada (Logista Holdings SA).' },
  'mapfre':                       { name: 'Mapfre', v3Name: 'MAPFRE SA', nif: 'A08055741', isin: 'ES0124244E34', ticker: 'BME:MAP', sector: 'Seguros', website: 'https://www.mapfre.com/', hoja: 'AV 92' },
  'merlin-properties':            { name: 'Merlin Properties', v3Name: 'MERLIN PROPERTIES SOCIMI SA', nif: 'A86977790', isin: 'ES0105025003', ticker: 'BME:MRL', sector: 'Inmobiliario', website: 'https://www.merlinproperties.com/', hoja: 'M 577086' },
  'arcelormittal':                { name: 'ArcelorMittal', v3Name: 'ARCELORMITTAL ESPAÑA SA', nif: 'A-81046856', isin: 'LU1598757687', ticker: 'BME:MTS', sector: 'Acero', website: 'https://corporate.arcelormittal.com/', hoja: 'AS 17946', country: 'LU', note: 'Matriz cotizada en Luxemburgo (ArcelorMittal SA); esta es la entidad española.' },
  'naturgy':                      { name: 'Naturgy', v3Name: 'NATURGY ENERGY GROUP SA', nif: 'A08015497', isin: 'ES0116870314', ticker: 'BME:NTGY', sector: 'Energía', website: 'https://www.naturgy.com/', hoja: 'M 656514' },
  'puig':                         { name: 'Puig', v3Name: 'PUIG BRANDS S.A.', nif: 'A66674904', isin: 'ES0105777017', ticker: 'BME:PUIG', sector: 'Consumo', website: 'https://www.puig.com/', hoja: 'B 482253' },
  'redeia':                       { name: 'Redeia Corporación', v3Name: 'REDEIA CORPORACION SA', nif: 'A-78003662', isin: 'ES0173093024', ticker: 'BME:RED', sector: 'Energía', website: 'https://www.redeia.com/', hoja: 'M 59083' },
  'repsol':                       { name: 'Repsol', v3Name: 'REPSOL SA', nif: 'A78374725', isin: 'ES0173516115', ticker: 'BME:REP', sector: 'Energía', website: 'https://www.repsol.com/', hoja: 'M 65289' },
  'laboratorios-rovi':            { name: 'Laboratorios Rovi', v3Name: 'LABORATORIOS FARMACEUTICOS ROVI SA', nif: 'A-28041283', isin: 'ES0157261019', ticker: 'BME:ROVI', sector: 'Farmacéutica', website: 'https://www.rovi.es/', hoja: 'M 64245' },
  'banco-sabadell':               { name: 'Banco Sabadell', v3Name: 'BANCO DE SABADELL SA', nif: 'A08000143', isin: 'ES0113860A34', ticker: 'BME:SAB', sector: 'Banca', website: 'https://www.grupbancsabadell.com/', hoja: 'B 1561' },
  'banco-santander':              { name: 'Banco Santander', v3Name: 'BANCO SANTANDER, S.A.', nif: 'A-39000013', isin: 'ES0113900J37', ticker: 'BME:SAN', sector: 'Banca', website: 'https://www.santander.com/', hoja: 'S 1960' },
  'sacyr':                        { name: 'Sacyr', v3Name: 'SACYR SA', nif: 'A-28013811', isin: 'ES0182870214', ticker: 'BME:SCYR', sector: 'Construcción', website: 'https://sacyr.com/', hoja: 'M 33841' },
  'solaria':                      { name: 'Solaria', v3Name: 'SOLARIA ENERGIA Y MEDIO AMBIENTE SA', nif: 'A83511501', isin: 'ES0165386014', ticker: 'BME:SLR', sector: 'Energía solar', website: 'https://solariaenergia.com/', hoja: 'M 319304' },
  'telefonica':                   { name: 'Telefónica', v3Name: 'TELEFONICA SA', nif: 'A28015865', isin: 'ES0178430E18', ticker: 'BME:TEF', sector: 'Telecomunicaciones', website: 'https://www.telefonica.com/', hoja: 'M 6164' },
  'unicaja':                      { name: 'Unicaja', v3Name: 'UNICAJA BANCO SA', nif: 'A93139053', isin: 'ES0180907000', ticker: 'BME:UNI', sector: 'Banca', website: 'https://www.unicajabanco.com/', hoja: 'MA 111580' },
};

// Reverse lookup: exact v3 doc name -> slug (so the app/graph can link back).
export const V3_TO_SLUG = Object.fromEntries(
  Object.entries(SEED).map(([slug, v]) => [v.v3Name, slug]),
);
