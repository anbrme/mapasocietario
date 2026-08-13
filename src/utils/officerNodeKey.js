// Officer graph-node identity. One corporate entity must map to ONE node key
// regardless of how the source spelled its trailing legal form: autocomplete
// serves the raw BORME spelling ("... SOCIEDAD LIMITADA") while the v3
// directory serves the canonical dotless form ("... SL"). Extracted from
// SpanishCompanyNetworkGraph.jsx so the identity rule is testable and shared.
import { canonLegalForm } from './companyName';

export const officerNodeKey = name =>
  canonLegalForm((name || '').trim())
    .toLowerCase()
    .replace(/[\s-]+/g, '-');

export const officerIdFor = name => `officer-${officerNodeKey(name)}`;
