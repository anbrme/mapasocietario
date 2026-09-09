/**
 * The copy for the public verification request page, /verificacion.
 *
 * It lives here rather than inside the Pages Function for one reason: this is
 * the page an institution pastes into its own supplier email, so its claims are
 * the product's exposed surface. Held as data, the invariants are testable —
 * see verificacion.test.js, which pins the ones that must never drift:
 *
 *   - it says what the verification is NOT before it says what it is;
 *   - it excludes administradores mancomunados BEFORE the form, not after;
 *   - it never calls a requester's company "verificada";
 *   - it promises no date for the stronger methods, because there isn't one;
 *   - the corporate-domain rule always ships with its way through.
 *
 * The rendering order is the page's, not this object's: the Function draws
 * `notWhat` before `what` deliberately. A reader who has just been told by a
 * bank to "get verified" arrives with an inflated idea of what this is, and
 * the honest thing is to deflate it in the first screenful rather than in a
 * footnote below a form they have already filled in.
 *
 * One persuasive line is allowed on this page, `once`, and it appears once.
 * Deliberately free of Node imports so vitest and the Function both read it.
 */

// Public by design - a Turnstile sitekey is meant to be in the page. Shared
// with the existing widgets; the matching secret is a Pages project secret.
export const TURNSTILE_SITEKEY = '0x4AAAAAADp3WnZGNiZai_32';

export const CONTACT_EMAIL = 'mapasocietario@ncdata.eu';

export const PRIVACY_PATH = '/verificacion/privacidad';

export const COPY = {
  es: {
    title: 'Verificación de datos registrales | Mapa Societario',
    description:
      'Un representante con cargo vigente en el registro puede dejar constancia, con fecha y con nombre, sobre los datos registrales de su propia empresa. Piloto con plazas limitadas.',
    kicker: 'Piloto · plazas limitadas',
    h1: 'Verificación de datos registrales',
    lead:
      'Si un banco, un cliente o un socio le ha pedido que verifique los datos registrales de su empresa, esta es la página. Un representante con cargo vigente en el registro hace una declaración fechada y atribuible sobre los datos de su propia empresa, nosotros la contrastamos con el BORME, y la revisa una persona con nombre y apellidos.',

    // The one persuasive line on the page, and it appears exactly once.
    once: 'Hágalo una vez, no una vez por cada cliente.',

    notWhat: {
      heading: 'Lo que esto no es',
      summary:
        'No comprobamos su identidad y no certificamos que lo que usted declara sea cierto.',
      points: [
        'Comprobamos que quien declara ocupa el cargo que dice ocupar según el registro, y revisamos su autoridad para hacerlo. Eso no es lo mismo que identificar a una persona, y no lo presentamos como tal.',
        'Dejamos constancia de quién declaró y cuándo. La veracidad de lo declarado sigue siendo de quien lo declara, no nuestra.',
        'No es un documento oficial del Registro Mercantil, ni lo sustituye. Si le piden una certificación registral, acuda al registro.',
        'No emitimos sellos ni etiquetas de confianza. Lo que se publica es una declaración fechada y atribuible que cualquiera puede leer entera y juzgar por sí mismo.',
      ],
    },

    what: {
      heading: 'Lo que sí es',
      points: [
        'Una declaración fechada y atribuible: un representante de su empresa afirma, en una fecha concreta, qué datos son correctos y cuáles no.',
        'Contrastada con el BORME: comparamos lo que usted declara con lo que consta publicado y le enseñamos las diferencias antes de que acepte nada.',
        'Revisada por una persona, cuyo nombre se publica junto a la declaración. Si no la aceptamos, se lo decimos.',
        'Portátil: una misma declaración, con su enlace público, sirve ante cualquiera que se la pida, sin rellenar otra vez el mismo cuestionario.',
      ],
    },

    who: {
      heading: 'Quién puede solicitarlo',
      points: [
        'Solo la propia empresa, sobre sus propios datos. No aceptamos solicitudes para comprobar los datos de un tercero: si usted es el banco o el cliente que lo pide, mande esta página a su contraparte y que la solicite ella.',
        'Quien declara debe tener un cargo vigente inscrito con poder de representación: administrador único, administradores solidarios, consejero delegado, o apoderado dentro del alcance de su poder.',
        'Los administradores mancomunados quedan fuera del piloto. Deben actuar conjuntamente, de modo que una declaración honesta necesitaría dos firmantes sobre un mismo texto, y ese flujo todavía no existe. Se lo decimos aquí, antes del formulario, y no después de que lo haya rellenado.',
        'Quien envía esta solicitud no tiene por qué ser quien declare. Puede escribirnos alguien de cumplimiento, de finanzas o de la asesoría; la declaración la aceptará después el representante.',
      ],
    },

    cost: {
      heading: 'Qué cuesta y cuánto tarda',
      points: [
        'Durante el piloto es gratuito.',
        'Al representante le llevará unos 20 minutos: revisar los datos, corregir lo que proceda y aceptar.',
        'De principio a fin, varios días. Cada solicitud la mira una persona, y eso tarda lo que tarda.',
        'Las plazas son limitadas y no aceptamos todas las solicitudes.',
      ],
    },

    // §7.1 of the design spec, verbatim. It is the answer to "why should I sign
    // the weak version now", and it is a statement about the system's present
    // shape - never a roadmap promise with a date.
    pilot: {
      heading: 'En qué se apoya hoy, y en qué no',
      paragraphs: [
        'Esto es un piloto. Hoy la verificación se apoya en tres cosas: un correo confirmado en el dominio de la empresa, la coincidencia con un cargo vigente en el registro, y una revisión manual firmada por una persona con nombre y apellidos. No comprobamos su identidad y no certificamos que lo que usted declara sea cierto.',
        'Están diseñados, y todavía no implementados, la firma con certificado electrónico cualificado del representante y el sellado de tiempo cualificado del registro. Cada declaración guarda con qué método se hizo, así que cuando lleguen los métodos más fuertes las declaraciones de hoy no quedan invalidadas: quedan distinguidas.',
      ],
    },

    domainRule: {
      heading: 'Una regla del piloto sobre el correo, antes de que escriba',
      body:
        'Durante el piloto solo podemos aceptar solicitudes desde un dominio corporativo, no desde Gmail, Hotmail, Outlook, Yahoo y equivalentes. Es una regla del piloto, no un juicio sobre su empresa: sabemos que deja fuera a muchísimas sociedades españolas perfectamente reales. Tampoco demuestra nada por sí sola, porque cualquiera puede comprar un dominio en diez minutos; solo reduce el ruido mientras revisamos a mano.',
      escape:
        `Si ese no es su caso, escríbanos a ${CONTACT_EMAIL} y lo resolvemos por correo. Preferimos leer su mensaje a perderle por una regla provisional.`,
    },

    form: {
      heading: 'Solicitar la verificación',
      intro:
        'Enviar este formulario no publica nada ni activa nada. Es una solicitud: entra en una cola que revisamos a mano, y nadie recibe ningún enlace hasta que una persona la ha mirado.',
      requiredMark: 'obligatorio',
      optionalMark: 'opcional',
      fields: {
        company_query: {
          label: 'Empresa',
          hint: 'Nombre o NIF, tal como lo buscaría usted.',
          placeholder: 'Razón social o NIF',
        },
        nif: {
          label: 'NIF',
          hint: 'Si lo tiene a mano nos ahorra una búsqueda; si no, déjelo en blanco.',
          placeholder: 'B12345678',
        },
        contact_name: {
          label: 'Su nombre',
          hint: 'El de quien escribe, aunque no sea quien vaya a firmar la declaración.',
          placeholder: '',
        },
        contact_role: {
          label: 'Su cargo en la empresa',
          hint: 'Por ejemplo: administrador único, director financiero, responsable de cumplimiento.',
          placeholder: '',
        },
        contact_email: {
          label: 'Correo electrónico',
          hint: 'Del dominio de la empresa, por la regla del piloto que acaba de leer.',
          placeholder: 'nombre@suempresa.es',
        },
        referrer_note: {
          label: '¿Le ha pedido algún banco, cliente o socio que verifique sus datos registrales?',
          hint: 'Díganos quién. Es la pregunta que más nos importa de esta página: nos dice qué instituciones están pidiendo esto de verdad, y eso decide qué construimos después. Si no se lo ha pedido nadie, díganoslo también, que también es una respuesta.',
          placeholder: 'Por ejemplo: nuestro banco, en la revisión anual de KYC',
        },
        note: {
          label: 'Algo más que debamos saber',
          hint: 'Un dato que sepa que está mal en el registro, una urgencia, un plazo que le han dado.',
          placeholder: '',
        },
      },
      submit: 'Enviar la solicitud',
      sending: 'Enviando…',
      success: {
        heading: 'Solicitud recibida.',
        body:
          'La revisará una persona y le responderemos por correo. No hemos publicado nada ni hemos enviado ningún enlace a nadie. Esta respuesta es idéntica para todas las solicitudes y no dice nada sobre su empresa.',
      },
    },

    errors: {
      company_query_required: 'Indíquenos de qué empresa se trata.',
      contact_name_required: 'Necesitamos su nombre.',
      contact_role_required: 'Necesitamos su cargo en la empresa.',
      contact_email_required: 'Necesitamos un correo electrónico donde responderle.',
      contact_email_invalid: 'Esa dirección no parece una dirección de correo. Revísela.',
      contact_email_too_long: 'Esa dirección de correo es demasiado larga. Revísela.',
      contact_email_not_corporate:
        `Durante el piloto solo podemos aceptar solicitudes desde un dominio corporativo. Si ese no es su caso, escríbanos a ${CONTACT_EMAIL}.`,
      turnstile_failed:
        'No hemos podido completar la comprobación antirrobots. Recargue la página e inténtelo de nuevo.',
      store_failed:
        `No hemos podido guardar su solicitud. Inténtelo dentro de unos minutos, o escríbanos a ${CONTACT_EMAIL}.`,
      invalid_json:
        'No hemos podido leer el formulario. Recargue la página e inténtelo de nuevo.',
      network:
        'No hemos podido enviar la solicitud. Compruebe su conexión e inténtelo de nuevo.',
      unknown:
        `Algo ha fallado por nuestra parte. Inténtelo de nuevo, o escríbanos a ${CONTACT_EMAIL}.`,
    },

    noscript: `Este formulario necesita JavaScript. Si lo tiene desactivado, escríbanos a ${CONTACT_EMAIL} y lo tramitamos por correo.`,
    privacyLink: 'Cómo tratamos sus datos en la verificación',
    contactLine: `Cualquier duda, y cualquier caso que no encaje en el piloto: ${CONTACT_EMAIL}`,
    langSwitch: 'English',
  },

  en: {
    title: 'Registry data verification | Mapa Societario',
    description:
      'A representative holding a current registry position can put a dated, attributable statement on the record about their own company’s registry data. Pilot, with limited places.',
    kicker: 'Pilot · limited places',
    h1: 'Registry data verification',
    lead:
      'If a bank, a client or a partner has asked you to verify your company’s registry data, this is the page. A representative holding a current registry position makes a dated, attributable statement about their own company’s data, we check it against BORME, and a named person reviews it.',

    once: 'Do it once, not once per counterparty.',

    notWhat: {
      heading: 'What this is not',
      summary:
        'We do not verify your identity, and we do not certify that what you declare is true.',
      points: [
        'We check that the person declaring holds the registry position they say they hold, and we review their authority to make the statement. That is not the same as identifying a person, and we do not present it as such.',
        'We record who declared what, and when. Whether it is true remains the declarer’s responsibility, not ours.',
        'This is not an official document from the Registro Mercantil, and it does not replace one. If someone asks you for a registry certificate, go to the register.',
        'We issue no seals and no trust badges. What gets published is a dated, attributable statement that anyone can read in full and judge for themselves.',
      ],
    },

    what: {
      heading: 'What it is',
      points: [
        'A dated, attributable statement: a representative of your company states, on a specific date, which data are right and which are not.',
        'Checked against BORME: we compare what you declare with what is published, and show you the differences before you accept anything.',
        'Reviewed by a person, whose name is published alongside the statement. If we do not accept it, we tell you so.',
        'Portable: one statement, with its public link, answers everyone who asks, instead of the same questionnaire filled in again and again.',
      ],
    },

    who: {
      heading: 'Who may ask',
      points: [
        'Only the company itself, about its own data. We do not accept requests to check somebody else’s data: if you are the bank or the client doing the asking, send this page to your counterparty and let them make the request.',
        'The person who declares must hold a current registered position carrying power of representation: sole administrator, joint-and-several administrators, managing director (consejero delegado), or an apoderado within the scope of their power.',
        'Joint administrators (administradores mancomunados) are excluded from the pilot. They must act together, so an honest statement would need two signatories on one text, and that flow does not exist yet. We say so here, before the form, rather than after you have filled it in.',
        'Whoever sends this request need not be the person who declares. Compliance, finance or your external adviser can write to us; the representative accepts the statement afterwards.',
      ],
    },

    cost: {
      heading: 'What it costs, and how long it takes',
      points: [
        'It is free during the pilot.',
        'It will take the representative about 20 minutes: read the data, correct what needs correcting, accept.',
        'End to end, several days. A person looks at every request, and that takes as long as it takes.',
        'Places are limited, and we do not accept every request.',
      ],
    },

    // The English mirror of §7.1. Same claim, same absence of a date.
    pilot: {
      heading: 'What it rests on today, and what it does not',
      paragraphs: [
        'This is a pilot. Today the verification rests on three things: an email address confirmed on the company’s own domain, a match to a current position in the register, and a manual review signed by a named person. We do not verify your identity, and we do not certify that what you declare is true.',
        'Designed, and not yet implemented, are signature with the representative’s qualified electronic certificate and qualified timestamping of the record. Every statement records which method was used, so when the stronger methods arrive today’s statements are not invalidated: they are distinguished.',
      ],
    },

    domainRule: {
      heading: 'A pilot rule about email, before you start typing',
      body:
        'During the pilot we can only accept requests from a corporate domain — not from Gmail, Hotmail, Outlook, Yahoo or their equivalents. It is a pilot rule, not a judgement about your company: we know it shuts out a great many entirely real Spanish companies. Nor does it prove anything on its own, since anyone can buy a domain in ten minutes; it only cuts the noise while we review by hand.',
      escape:
        `If that is your situation, write to us at ${CONTACT_EMAIL} and we will handle it by email. We would rather read your message than lose you to a provisional rule.`,
    },

    form: {
      heading: 'Request a verification',
      intro:
        'Sending this form publishes nothing and starts nothing. It is a request: it joins a queue we review by hand, and nobody receives a link until a person has looked at it.',
      requiredMark: 'required',
      optionalMark: 'optional',
      fields: {
        company_query: {
          label: 'Company',
          hint: 'Name or NIF, as you would search for it.',
          placeholder: 'Registered name or NIF',
        },
        nif: {
          label: 'NIF',
          hint: 'If you have it to hand it saves us a search; otherwise leave it blank.',
          placeholder: 'B12345678',
        },
        contact_name: {
          label: 'Your name',
          hint: 'The person writing, even if you are not the one who will sign the statement.',
          placeholder: '',
        },
        contact_role: {
          label: 'Your position in the company',
          hint: 'For example: sole administrator, finance director, head of compliance.',
          placeholder: '',
        },
        contact_email: {
          label: 'Email address',
          hint: 'On the company’s own domain, per the pilot rule you have just read.',
          placeholder: 'name@yourcompany.es',
        },
        referrer_note: {
          label: 'Has a bank, a client or a partner asked you to verify your registry data?',
          hint: 'Tell us who. It is the question on this page we care most about: it tells us which institutions are actually driving this, and that decides what we build next. If nobody asked, tell us that too — it is also an answer.',
          placeholder: 'For example: our bank, during its annual KYC review',
        },
        note: {
          label: 'Anything else we should know',
          hint: 'Something you know is wrong in the register, an urgency, a deadline you have been given.',
          placeholder: '',
        },
      },
      submit: 'Send the request',
      sending: 'Sending…',
      success: {
        heading: 'Request received.',
        body:
          'A person will review it and we will reply by email. We have published nothing and sent nobody a link. This response is identical for every request and says nothing about your company.',
      },
    },

    errors: {
      company_query_required: 'Tell us which company this is about.',
      contact_name_required: 'We need your name.',
      contact_role_required: 'We need your position in the company.',
      contact_email_required: 'We need an email address to reply to.',
      contact_email_invalid: 'That does not look like an email address. Please check it.',
      contact_email_too_long: 'That email address is too long. Please check it.',
      contact_email_not_corporate:
        `During the pilot we can only accept requests from a corporate domain. If that is your situation, write to us at ${CONTACT_EMAIL}.`,
      turnstile_failed:
        'We could not complete the anti-bot check. Reload the page and try again.',
      store_failed:
        `We could not save your request. Try again in a few minutes, or write to us at ${CONTACT_EMAIL}.`,
      invalid_json:
        'We could not read the form. Reload the page and try again.',
      network:
        'We could not send the request. Check your connection and try again.',
      unknown:
        `Something failed on our side. Try again, or write to us at ${CONTACT_EMAIL}.`,
    },

    noscript: `This form needs JavaScript. If you have it turned off, write to us at ${CONTACT_EMAIL} and we will handle it by email.`,
    privacyLink: 'How we handle your data in the verification',
    contactLine: `Any question, and any case the pilot does not fit: ${CONTACT_EMAIL}`,
    langSwitch: 'Español',
  },
};
