// Ported from transaction-manager's packages/signals/src/registry.ts.
// Adding a new signal type is one entry here, not a change to the
// evaluator's control flow. `policy.ts`'s email-timing/quiet-hours logic is
// dropped entirely (in-app only) — only `priority` survives, for badge
// sort/color in SignalsPanel.
export type SignalType =
  | 'fraud_anomaly'
  | 'subscription_renewal'
  | 'subscription_still_using'
  | 'low_balance_forecast'
  | 'refund_pending'
  | 'trial_ending'
  | 'income_missing'
  | 'income_changed';

export type SignalPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SignalRecord {
  type: SignalType;
  expectedValue: unknown;
  expectedByDate: string | null;
}

export const SIGNAL_REGISTRY: Record<
  SignalType,
  {
    label: string;
    priority: SignalPriority;
    buildNotification: (signal: SignalRecord) => { title: string; body: string };
  }
> = {
  fraud_anomaly: {
    label: 'Posibilă fraudă',
    priority: 'critical',
    buildNotification: (signal) => {
      const v = signal.expectedValue as { description?: string; amount?: string; currency?: string } | null;
      return {
        title: 'Tranzacție neobișnuită detectată',
        body: v
          ? `${v.description ?? 'O tranzacție'} de ${v.currency ?? ''} ${v.amount ?? ''} pare neobișnuită față de cheltuielile tale tipice. Nu ai fost tu? Verifică-ți contul.`
          : 'A fost detectată o tranzacție neobișnuită pe contul tău.',
      };
    },
  },
  subscription_renewal: {
    label: 'Reînnoire abonament',
    priority: 'medium',
    buildNotification: (signal) => {
      const v = signal.expectedValue as { payee?: string; amount?: string; currency?: string } | null;
      const payee = v?.payee ?? 'Un abonament';
      return {
        title: `${payee} se reînnoiește curând`,
        body: signal.expectedByDate
          ? `${payee} (${v?.currency ?? ''} ${v?.amount ?? ''}) se așteaptă să se reînnoiască în jurul datei de ${signal.expectedByDate}.`
          : `${payee} se așteaptă să se reînnoiască curând.`,
      };
    },
  },
  subscription_still_using: {
    label: 'Încă îl folosești?',
    priority: 'low',
    buildNotification: (signal) => {
      const v = signal.expectedValue as { payee?: string; occurrenceCount?: number } | null;
      const payee = v?.payee ?? 'Acest abonament';
      return {
        title: `Încă folosești ${payee}?`,
        body: `${payee} s-a reînnoit de ${v?.occurrenceCount ?? 'mai multe'} ori. O verificare rapidă — încă îl folosești?`,
      };
    },
  },
  low_balance_forecast: {
    label: 'Prognoză sold scăzut',
    priority: 'high',
    buildNotification: (signal) => {
      const v = signal.expectedValue as {
        accountName?: string;
        balance?: string;
        currency?: string;
        upcomingTotal?: string;
      } | null;
      return {
        title: 'Plățile viitoare pot depăși soldul',
        body: v
          ? `${v.accountName ?? 'Contul tău'} are un sold de ${v.currency ?? ''} ${v.balance ?? ''}, dar ${v.currency ?? ''} ${v.upcomingTotal ?? ''} în plăți cunoscute sunt scadente până pe ${signal.expectedByDate ?? 'curând'}.`
          : 'Plățile cunoscute viitoare pot depăși soldul contului.',
      };
    },
  },
  refund_pending: {
    label: 'Rambursare în așteptare',
    priority: 'medium',
    buildNotification: (signal) => {
      const v = signal.expectedValue as { merchant?: string; amount?: string; currency?: string } | null;
      const merchant = v?.merchant ?? 'Un comerciant';
      return {
        title: `${merchant} ți-a promis o rambursare`,
        body: v?.amount
          ? `${merchant} a spus că vei primi o rambursare de ${v.currency ?? ''} ${v.amount}${signal.expectedByDate ? ` până pe ${signal.expectedByDate}` : ''}. Te anunțăm când apare în cont.`
          : `${merchant} ți-a promis o rambursare. Te anunțăm când apare în cont.`,
      };
    },
  },
  trial_ending: {
    label: 'Perioadă de probă expiră',
    priority: 'high',
    buildNotification: (signal) => {
      const v = signal.expectedValue as { merchant?: string } | null;
      const merchant = v?.merchant ?? 'O perioadă de probă gratuită';
      return {
        title: `Perioada de probă ${merchant} expiră curând`,
        body: signal.expectedByDate
          ? `Perioada ta de probă ${merchant} se termină în jurul datei de ${signal.expectedByDate} — anuleaz-o înainte dacă nu vrei să fii taxat.`
          : `Perioada ta de probă ${merchant} se termină curând.`,
      };
    },
  },
  income_missing: {
    label: 'Venit așteptat lipsă',
    priority: 'high',
    buildNotification: (signal) => {
      const v = signal.expectedValue as {
        payer?: string;
        amount?: string;
        currency?: string;
        lastReceivedOn?: string;
      } | null;
      const payer = v?.payer ?? 'Venitul tău obișnuit';
      return {
        title: `${payer} nu a sosit`,
        body: v?.lastReceivedOn
          ? `${payer} sosește de obicei până acum — ultima dată a fost pe ${v.lastReceivedOn}${v.amount ? ` de ${v.currency ?? ''} ${v.amount}` : ''}. Merită verificat dacă e doar o întârziere.`
          : `${payer} sosește de obicei până acum și nu a sosit. Merită verificat dacă e doar o întârziere.`,
      };
    },
  },
  income_changed: {
    label: 'Venit cu sumă schimbată',
    priority: 'medium',
    buildNotification: (signal) => {
      const v = signal.expectedValue as {
        payer?: string;
        amount?: string;
        previousAmount?: string;
        currency?: string;
      } | null;
      const payer = v?.payer ?? 'Venitul tău';
      const currency = v?.currency ?? '';
      return {
        title: `${payer} a schimbat suma`,
        body:
          v?.amount && v?.previousAmount
            ? `${payer} a sosit cu ${currency} ${v.amount}, față de ${currency} ${v.previousAmount} anterior.`
            : `${payer} a sosit cu o sumă diferită față de obicei.`,
      };
    },
  },
};
