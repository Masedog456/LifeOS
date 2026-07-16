/**
 * Decision safety boundaries (LIFEOS-016, Phase 14).
 *
 * For medical, legal, financial-trading, self-harm, or dangerous decisions we
 * show an appropriate caution and never pretend LifeOS replaces a qualified
 * professional — while preserving the user's autonomy (nothing is blocked).
 * Ordinary life decisions get no banner at all: calm and non-paternalistic.
 */

const MEDICAL = /\b(surgery|medication|medicine|dosage|diagnos\w*|chemotherapy|treatment plan|symptom|therapy|psychiatri\w*|antidepress\w*)\b/i;
const LEGAL = /\b(lawsuit|sue|custody|divorce settlement|criminal charge|plea|attorney|legal action|contract dispute|immigration status)\b/i;
const FINANCIAL = /\b(invest\w* in (stocks?|crypto)|day.?trad\w*|options trading|leverage|margin call|all my savings|retirement fund|portfolio allocation)\b/i;
const SELF_HARM = /\b(self.?harm|suicid\w*|end (my|it all)|hurting myself|kill myself)\b/i;
const DANGEROUS = /\b(weapon|explosive|revenge|stalk\w*|violent)\b/i;

/**
 * Returns a caution string for sensitive decisions, or undefined for ordinary
 * ones. Never blocks; never generates action plans for dangerous topics.
 */
export function decisionCaution(text: string): string | undefined {
  if (SELF_HARM.test(text)) {
    return "This touches on your safety and wellbeing. LifeOS can help you organize your thoughts, but it is not a substitute for real support — please consider talking with someone you trust or a mental-health professional. In the US you can call or text 988 anytime.";
  }
  if (MEDICAL.test(text)) {
    return "This looks like a medical decision. LifeOS can help you clarify your own values and questions, but it cannot diagnose or weigh clinical evidence — a qualified clinician should be part of this decision.";
  }
  if (LEGAL.test(text)) {
    return "This looks like a legal decision. LifeOS can help you think through what matters to you, but it does not provide legal conclusions — a qualified lawyer should review the specifics.";
  }
  if (FINANCIAL.test(text)) {
    return "This involves significant financial risk. LifeOS can help you examine your assumptions, but it does not give trading or investment advice — treat any analysis here as reflection, not financial guidance.";
  }
  if (DANGEROUS.test(text)) {
    return "This decision touches on potential harm. LifeOS will help you reflect on values and consequences only — it will not plan harmful actions.";
  }
  return undefined;
}
