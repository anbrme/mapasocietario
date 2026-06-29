# Reviewer checklist — accepting a confirmation (pilot)

Run all four checks on each reply. Ship only if ALL pass.

1. **Tied address** — the reply came from the company's own domain, or an
   address you can tie to the named registered officer (e.g. the contact
   published on the company site / sourced officially). A generic free-mail
   address with no tie is NOT acceptable on its own — request a tied-address
   reply or decline.
2. **Authority** — the named person is a CURRENT officer in BORME. (The build
   gate re-checks this mechanically; eyeball it here too.)
3. **Content** — they affirmed the SPECIFIC facts you listed, not just "ok."
4. **Consent** — the "willing to be asked again" line is present.

## On acceptance
1. Add a row to `confirmation-evidence.local.csv` (copy from the `.template.csv`):
   pick the next `evidenceRef` (`CONF-YYYY-NNNN`), record sender email, date,
   a one-line summary of what they affirmed, and a link/copy of the email.
2. Add the entry to `functions/empresa/_confirmations.js`:
   ```js
   'company-slug': {
     confirmedAt: 'YYYY-MM-DD',            // date of their email
     representative: 'Full Name',
     role: 'Administrador único',
     verification: 'email-from-tied-address',
     reviewer: 'AN',
     evidenceRef: 'CONF-YYYY-NNNN',
     affirms: [
       { label: 'Administrador único: Full Name', status: 'current' },
       { label: 'Domicilio social: …', status: 'current' },
       { label: 'Situación concursal', status: 'none' },
       { label: 'Sociedad activa y operativa', status: 'current' },
     ],
   },
   ```
3. Run `node scripts/check-confirmations.mjs` — must pass (officer match +
   audit-trail guard).
4. Build & deploy. The badge decays on its own (fresh ≤90d → aging ≤365d →
   stale); re-ask using this same checklist when convenient.
