export interface DocumentRequestTicket { scope: string; generation: number; request: number }

/** Invalidates late responses before they can expose another document in this route. */
export class DocumentRequestGate {
  private scope = '';
  private generation = 0;
  private request = 0;

  setScope(patientId: string, docId: string) {
    const scope = `${patientId}/${docId}`;
    if (scope !== this.scope) { this.scope = scope; this.invalidate(); }
  }

  invalidate() { this.generation += 1; }

  begin(): DocumentRequestTicket {
    return { scope: this.scope, generation: this.generation, request: ++this.request };
  }

  current(ticket: DocumentRequestTicket) {
    return ticket.scope === this.scope && ticket.generation === this.generation && ticket.request === this.request;
  }

  accepts(ticket: DocumentRequestTicket, document: { id: string; patientId: string; version: number }, minimumVersion = 0) {
    return this.current(ticket) && `${document.patientId}/${document.id}` === ticket.scope && document.version >= minimumVersion;
  }
}
