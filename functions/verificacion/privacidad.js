/**
 * GET /verificacion/privacidad  (add ?lang=en for English)
 *
 * The verification privacy policy. It sits under /verificacion/ so it shares the
 * family, and it is deliberately the ONLY page there that is not gated: a policy
 * nobody can read is not a policy. It stays noindex while VERIFY_VISIBILITY is
 * private, alongside the rest of the family.
 *
 * Everything here must match section 9 of the design spec. If a retention term
 * changes there, it changes here in the same commit - a policy that describes a
 * system we do not run is worse than none.
 */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CONTACT = 'mapasocietario@ncdata.eu';

const COPY = {
  es: {
    title: 'Privacidad de la verificación | Mapa Societario',
    h1: 'Privacidad de la verificación',
    intro: 'Esta página explica qué datos personales tratamos cuando un representante confirma los datos registrales de su empresa, por qué, durante cuánto tiempo y cómo puede ejercer sus derechos. Solo cubre el proceso de verificación.',
    sections: [
      ['Antes de que exista una declaración: su solicitud de verificación', [
        'Si nos escribe o rellena el formulario de /verificacion para pedir la verificación de su empresa, tratamos: el nombre y el NIF de la empresa tal como los escribió, su nombre de contacto, su cargo, un correo corporativo, quién le indicó que nos escribiera, y una nota opcional.',
        'Lo usamos únicamente para decidir si invitamos a su empresa al piloto y para contactarle sobre esa decisión.',
        'Base legal: interés legítimo en evaluar y gestionar solicitudes de participación en el piloto (artículo 6.1.f del RGPD).',
        'Si marcamos su solicitud como spam o no elegible, la conservamos hasta 90 días desde su recepción y después se suprime.',
        'Si su solicitud se convierte en una invitación aceptada, pasa a conservarse con los plazos de la declaración descritos más abajo, y esta sección deja de aplicarle.',
        `Puede ejercer los mismos derechos descritos en "Sus derechos" escribiendo a ${CONTACT}.`,
      ]],
      ['Qué recogemos', [
        'Su nombre y el cargo registral que consta en el BORME. Ambos ya son públicos en el registro; lo que añadimos es el hecho de que usted hizo una declaración concreta en una fecha concreta.',
        'Su dirección de correo electrónico, para enviarle el enlace y las solicitudes de reconfirmación.',
        'Una nota interna sobre cómo se comprobó su identidad y cómo se vinculó el dominio de correo con la empresa.',
        'La declaración exacta que usted aceptó, la evidencia registral en ese momento, y la fecha y hora de aceptación.',
        'No recogemos su dirección IP ni la huella de su navegador.',
      ]],
      ['Qué publicamos', [
        'Su nombre, su cargo registral, la fecha de aceptación, los hechos declarados y el estado de la declaración.',
        'El nombre de quien revisó la declaración por nuestra parte.',
        'NO publicamos su correo electrónico, la nota de identificación, las referencias a la evidencia ni los enlaces de acceso.',
      ]],
      ['Durante cuánto tiempo', [
        'La declaración publicada y su historial: mientras el servicio exista, porque el valor del registro es que pueda consultarse después.',
        'La evidencia sellada (declaración, evidencia registral, fechas): hasta 5 años desde el vencimiento de la declaración.',
        'Su correo y la nota de identificación: el mismo plazo, pero se conservan por separado y son suprimibles a petición.',
      ]],
      ['Sus derechos', [
        `Puede solicitar acceso, rectificación, supresión, limitación u oposición escribiendo a ${CONTACT}.`,
        'La evidencia personal (correo, nota de identificación) se suprime a petición. Al hacerlo conservamos únicamente la huella criptográfica original, para que el registro siga demostrando que nada fue sustituido, y dejamos constancia visible de que se suprimió evidencia a petición del interesado.',
        'Sobre el registro público en sí: una supresión total destruiría el propósito del registro, por lo que valoramos cada solicitud de forma individual en lugar de rechazarla por defecto. Si no podemos atenderla, le explicaremos por qué.',
        'Puede reclamar ante la Agencia Española de Protección de Datos.',
      ]],
      ['Lo que NO afirmamos', [
        'No verificamos su identidad. Comprobamos que usted ocupa el cargo registral indicado y revisamos su autoridad para hacer la declaración.',
        'No certificamos que su declaración sea cierta. Dejamos constancia de quién la hizo y cuándo.',
        'El registro de auditoría es a prueba de manipulación evidente, no inmutable: su integridad depende de puntos de control externos diarios.',
      ]],
    ],
    contact: `Responsable del tratamiento y contacto: ${CONTACT}`,
    back: 'Volver',
  },
  en: {
    title: 'Verification privacy | Mapa Societario',
    h1: 'Verification privacy',
    intro: 'This page explains what personal data we process when a representative confirms their company’s registry data, why, for how long, and how to exercise your rights. It covers the verification process only.',
    sections: [
      ['Before a statement exists: your verification request', [
        'If you write to us or fill in the form at /verificacion to request verification for your company, we process: the company name and NIF as you typed them, your contact name, your position, a corporate email address, who told you to write to us, and an optional note.',
        'We use it only to decide whether to invite your company into the pilot and to contact you about that decision.',
        'Legal basis: legitimate interest in assessing and handling requests to join the pilot (GDPR Article 6.1.f).',
        'If we mark your request as spam or ineligible, we keep it for up to 90 days from receipt and then delete it.',
        'If your request becomes an accepted invitation, it is then retained under the terms of the statement record described below, and this section no longer applies to it.',
        `You can exercise the same rights described under "Your rights" by writing to ${CONTACT}.`,
      ]],
      ['What we collect', [
        'Your name and the registry position recorded in BORME. Both are already public in the register; what we add is the fact that you made a specific statement on a specific date.',
        'Your email address, to send you the link and any reconfirmation requests.',
        'An internal note on how your identity was established and how the email domain was tied to the company.',
        'The exact statement you accepted, the registry evidence as at that moment, and the time of acceptance.',
        'We do not collect your IP address or browser fingerprint.',
      ]],
      ['What we publish', [
        'Your name, your registry position, the acceptance date, the declared facts and the status of the statement.',
        'The name of the person who reviewed it on our side.',
        'We do NOT publish your email address, the identification note, evidence references, or access links.',
      ]],
      ['For how long', [
        'The published statement and its history: for the life of the service, because the value of the record is that it can be consulted later.',
        'Sealed evidence (statement, registry evidence, timestamps): up to 5 years after the statement expires.',
        'Your email and the identification note: the same period, but stored separately and erasable on request.',
      ]],
      ['Your rights', [
        `You can request access, rectification, erasure, restriction or object by writing to ${CONTACT}.`,
        'Personal evidence (email, identification note) is erased on request. When we do, we keep only the original cryptographic digest, so the record still shows nothing was substituted, and we note visibly that evidence was erased at the subject’s request.',
        'On the public record itself: complete erasure would destroy the record’s purpose, so we assess each request individually rather than refusing by default. If we cannot comply, we will tell you why.',
        'You may complain to the Spanish data protection authority (AEPD).',
      ]],
      ['What we do NOT claim', [
        'We do not verify your identity. We check that you hold the registry position stated, and we review your authority to make the statement.',
        'We do not certify that your statement is true. We record who made it and when.',
        'The audit log is tamper-evident, not immutable: its integrity rests on daily external checkpoints.',
      ]],
    ],
    contact: `Controller and contact: ${CONTACT}`,
    back: 'Back',
  },
};

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get('lang') || '').toLowerCase();
  const lang = requested === 'en' ? 'en'
    : requested === 'es' ? 'es'
    : (request.headers.get('accept-language') || '').toLowerCase().startsWith('en') ? 'en'
    : 'es';
  const t = COPY[lang];

  const sections = t.sections.map(([heading, points]) => `
    <h2>${esc(heading)}</h2>
    <ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`).join('');

  const html = `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(t.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; margin: 0; padding: 2rem 1rem; }
  main { max-width: 44rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.05rem; margin-top: 2rem; }
  li { margin-bottom: .5rem; }
  .lead { opacity: .85; }
  footer { margin-top: 2.5rem; border-top: 1px solid #8884; padding-top: 1rem; font-size: .9rem; }
</style></head><body><main>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.intro)}</p>
${sections}
<footer><p>${esc(t.contact)}</p></footer>
</main></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
