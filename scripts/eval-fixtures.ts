export interface EvalDocument {
  title: string;
  text: string;
}

export interface EvalFixture {
  question: string;
  /** The title of the document the correct answer should be cited from - undefined means this question should be REFUSED, not answered from any of the seeded documents. */
  expectedDocumentTitle: string | undefined;
}

export const EVAL_DOCUMENTS: EvalDocument[] = [
  {
    title: "Vacation Policy",
    text: `Vacation Policy

Employees accrue fifteen days of paid vacation per year, front-loaded at the start of
each calendar year rather than accumulated month by month. Unused vacation days carry
over into the following year, up to a maximum of five days - anything beyond that is
forfeited on December 31st unless local law requires otherwise.

Vacation requests should be submitted through the HR portal at least two weeks in
advance for anything longer than three consecutive days, so a manager has time to plan
around the absence.`,
  },
  {
    title: "Refund Policy",
    text: `Refund Policy

Refunds are processed within seven business days of approval. Customers must submit a
refund request through the support portal within thirty days of purchase to be
eligible; requests submitted after that window are reviewed on a case-by-case basis but
are not guaranteed.

Digital products are non-refundable once downloaded, except where required by local
consumer protection law. Physical products must be returned in their original packaging
before a refund is issued.`,
  },
  {
    title: "Security Incident Response",
    text: `Security Incident Response

Any suspected security breach - a lost device, a phishing attempt that was clicked, or
unusual account activity - must be reported immediately to the security team at
security@example.com, not held until the next standup or status meeting.

The on-call security engineer triages every report within thirty minutes during
business hours. Confirmed incidents are escalated to the incident commander, who
coordinates containment, a customer-facing statement if needed, and a postmortem within
five business days of resolution.`,
  },
  {
    title: "Expense Reimbursement",
    text: `Expense Reimbursement

Business expenses must be submitted for reimbursement within sixty days of the
purchase date, with an itemized receipt attached to each line - a credit card
statement alone isn't sufficient documentation.

Reimbursements are paid out on the next regular payroll cycle after approval, which
typically happens within five business days of submission. Expenses over five hundred
dollars require manager pre-approval before the purchase is made, not after.`,
  },
  {
    title: "Remote Work Policy",
    text: `Remote Work Policy

Remote employees receive a one-time home office stipend of five hundred dollars for
desk, chair, and monitor equipment, claimed the same way as any other reimbursable
expense.

Core working hours are ten in the morning to three in the afternoon in the employee's
own local time zone, during which they're expected to be reachable on chat - outside
that window, working hours are flexible as long as commitments are met.`,
  },
];

export const EVAL_FIXTURES: EvalFixture[] = [
  { question: "How many vacation days do employees get per year?", expectedDocumentTitle: "Vacation Policy" },
  { question: "How many unused vacation days can carry over to next year?", expectedDocumentTitle: "Vacation Policy" },
  { question: "How long does it take to get a refund after approval?", expectedDocumentTitle: "Refund Policy" },
  { question: "Are digital downloads refundable?", expectedDocumentTitle: "Refund Policy" },
  { question: "Who should I contact if I think my account was compromised?", expectedDocumentTitle: "Security Incident Response" },
  { question: "How quickly does the security team respond to a reported incident?", expectedDocumentTitle: "Security Incident Response" },
  { question: "What is the deadline for submitting an expense for reimbursement?", expectedDocumentTitle: "Expense Reimbursement" },
  { question: "Do large purchases need approval before I buy them?", expectedDocumentTitle: "Expense Reimbursement" },
  { question: "Do remote employees get money for home office equipment?", expectedDocumentTitle: "Remote Work Policy" },
  { question: "What are the core hours remote employees need to be reachable?", expectedDocumentTitle: "Remote Work Policy" },
  { question: "What is the capital of France?", expectedDocumentTitle: undefined },
  { question: "How do I replace the toner cartridge in the office printer?", expectedDocumentTitle: undefined },
  { question: "What's the best recipe for sourdough bread?", expectedDocumentTitle: undefined },
];
