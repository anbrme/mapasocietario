import { describe, expect, it } from 'vitest';
import { buildInvestigationContext } from './aiInvestigationClient';

const authorProvenance = { by: 'author', citation: null, asserted: null, note: '', at: 'T', author: '' };

const registryCompany = { id: 'c1', name: 'ALFA SL', type: 'company' };
const registryOfficer = { id: 'o1', name: 'GARCIA LOPEZ ANA', type: 'officer' };
const authorCompany = { id: 'author-node-c', name: 'HOLDING BV', type: 'company', provenance: authorProvenance };
const authorPerson = { id: 'author-node-p', name: 'JAN DE VRIES', type: 'officer', provenance: authorProvenance };

const registryLink = { source: 'o1', target: 'c1', type: 'officer-company', category: 'nombramientos' };
const authorLink = {
  id: 'author-link-1', source: 'author-node-p', target: 'c1', type: 'author', category: 'author',
  relationship: 'Director', provenance: authorProvenance,
};

const nodes = [registryCompany, registryOfficer, authorCompany, authorPerson];
const links = [registryLink, authorLink];

describe('buildInvestigationContext', () => {
  it('sends the registry entities and edges of the selection', () => {
    const context = buildInvestigationContext(['c1', 'o1'], nodes, links, registryCompany);

    expect(context.entities.map(e => e.id)).toEqual(['c1', 'o1']);
    expect(context.focus.id).toBe('c1');
    expect(context.edges).toEqual([{ source: 'o1', target: 'c1', type: 'officer-company' }]);
  });

  it('never sends an author entity, even when it is selected', () => {
    const context = buildInvestigationContext(
      ['c1', 'author-node-c', 'author-node-p'], nodes, links, registryCompany);

    const names = JSON.stringify(context);
    expect(names).not.toContain('HOLDING BV');
    expect(names).not.toContain('JAN DE VRIES');
    expect(context.entities.map(e => e.id)).toEqual(['c1']);
  });

  it('never sends an author relationship as an edge, even between two registry entities', () => {
    // Both endpoints are registry nodes, so the only thing keeping the hop out
    // of the payload is the link's own provenance.
    const drawnHop = {
      id: 'author-link-2', source: 'o1', target: 'c1', type: 'author', category: 'author',
      relationship: 'Beneficial owner', provenance: authorProvenance,
    };
    const context = buildInvestigationContext(['c1', 'o1'], nodes, [drawnHop], registryCompany);

    expect(context.edges).toEqual([]);
  });

  it('refuses an author node as the focus when nothing is selected', () => {
    const context = buildInvestigationContext([], nodes, links, authorCompany);

    expect(context.focus).toBeNull();
    expect(context.entities).toEqual([]);
  });
});
