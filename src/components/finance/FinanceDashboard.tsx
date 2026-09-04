'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle } from '@/lib/chart-theme';
import { isInternalTransfer, transactionFlow } from '@/lib/financial/internal-transfers';
import { isoDateLocal, lastNDates } from '@/lib/garmin/dates';

type Account = {
  id: number;
  bank: string;
  currencyCode: string;
  balance: number;
  iban: string;
};

type Tx = {
  id: number;
  bank: string;
  amount: number;
  currencyCode: string;
  creditorName: string;
  debtorName: string;
  type: string;
  description: string;
  date: string;
  categoryName: string | null;
  categoryKind?: string | null;
  tags?: string | null;
  code?: string;
};

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDateLocal(d);
}

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function currencyCode(value?: string) {
  const code = (value || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return code.length === 3 ? code : 'RON';
}

function addAmount(map: Record<string, number>, currency: string, amount: number) {
  const key = currencyCode(currency);
  map[key] = (map[key] ?? 0) + amount;
}

function money(n: number, currency = 'RON') {
  return `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatByCurrency(map: Record<string, number>) {
  const keys = Object.keys(map).sort((a, b) => {
    if (a === 'RON') return -1;
    if (b === 'RON') return 1;
    return a.localeCompare(b);
  });
  if (keys.length === 0) return money(0, 'RON');
  return keys.map((key) => money(map[key], key)).join(' · ');
}

function merchant(tx: Tx) {
  if (transactionFlow(tx.type, tx.amount) === 'debit') return tx.creditorName || tx.description || 'Cheltuială';
  return tx.debtorName || tx.description || 'Încasare';
}

export default function FinanceDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const autoSynced = useRef(false);

  async function loadTxs() {
    const from = daysAgoIso(30);
    const res = await fetch(
      `/api/financial/transactions?limit=100&date_from=${encodeURIComponent(from)}&sort=bookingDate&order=DESC`
    );
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.items) ? (data.items as Tx[]) : [];
  }

  async function loadAccounts() {
    const res = await fetch('/api/financial/accounts');
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? (data as Account[]) : [];
  }

  async function refresh(opts?: { syncIfEmpty?: boolean }) {
    setLoading(true);
    const [nextAccounts, nextTxs] = await Promise.all([loadAccounts(), loadTxs()]);
    setAccounts(nextAccounts);
    setTxs(nextTxs);
    setLoading(false);

    if (opts?.syncIfEmpty && !autoSynced.current && nextAccounts.length > 0 && nextTxs.length === 0) {
      autoSynced.current = true;
      await sync(true);
    }
  }

  async function sync(silent = false) {
    setSyncing(true);
    if (!silent) setMsg(null);
    const [balRes, txRes] = await Promise.all([
      fetch('/api/financial/accounts/sync-balances', { method: 'POST' }),
      fetch('/api/financial/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_from: daysAgoIso(30), date_to: isoDateLocal() }),
      }),
    ]);
    const bal = await balRes.json().catch(() => ({}));
    const tx = await txRes.json().catch(() => ({}));
    setSyncing(false);
    if (!balRes.ok || !txRes.ok) {
      setMsg(bal.error ?? tx.error ?? 'Sincronizarea a eșuat.');
      return;
    }
    if (!silent) {
      setMsg(
        `${bal.synced ?? 0} solduri · ${tx.synced ?? 0} conturi cu tranzacții${
          (bal.failed || tx.failed) ? ' · unele au eșuat' : ''
        }.`
      );
    }
    const [nextAccounts, nextTxs] = await Promise.all([loadAccounts(), loadTxs()]);
    setAccounts(nextAccounts);
    setTxs(nextTxs);
  }

  async function enrich() {
    setEnriching(true);
    setMsg(null);
    let ruleHits = 0;
    let llmCalls = 0;
    let remaining = 0;
    let failed: string | null = null;

    // Chains a few calls automatically since each one is capped — stops
    // once nothing is left or after a handful of rounds, whichever first.
    for (let round = 0; round < 5; round++) {
      const res = await fetch('/api/financial/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failed = data.error ?? 'Categorizarea a eșuat.';
        break;
      }
      ruleHits += (data.ruleHits ?? 0) + (data.transferHits ?? 0) + (data.incomeHits ?? 0);
      llmCalls += data.llmCalls ?? 0;
      remaining = data.remainingGroups ?? 0;
      if (remaining === 0 || (data.processedGroups ?? 0) === 0) break;
    }

    setEnriching(false);
    setMsg(
      failed ?? `${ruleHits} după reguli · ${llmCalls} prin AI${remaining > 0 ? ` · ${remaining} rămase, apasă din nou` : ''}.`
    );
    const [nextAccounts, nextTxs] = await Promise.all([loadAccounts(), loadTxs()]);
    setAccounts(nextAccounts);
    setTxs(nextTxs);
  }

  useEffect(() => {
    refresh({ syncIfEmpty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const month = monthStartIso();
  const internalIds = new Set(
    txs.filter((t) => isInternalTransfer(t, accounts, txs)).map((t) => t.id)
  );
  const spendingTxs = txs.filter((t) => !internalIds.has(t.id));
  const monthTxs = spendingTxs.filter((t) => t.date >= month);

  const balanceByCcy: Record<string, number> = {};
  for (const account of accounts) {
    addAmount(balanceByCcy, account.currencyCode, Number.isFinite(account.balance) ? account.balance : 0);
  }
  const spentByCcy: Record<string, number> = {};
  const incomeByCcy: Record<string, number> = {};
  for (const tx of monthTxs) {
    const flow = transactionFlow(tx.type, tx.amount);
    if (flow === 'debit') addAmount(spentByCcy, tx.currencyCode, Math.abs(tx.amount));
    if (flow === 'credit') addAmount(incomeByCcy, tx.currencyCode, Math.abs(tx.amount));
  }

  const chartCcy =
    spentByCcy.RON != null
      ? 'RON'
      : Object.keys(spentByCcy).sort((a, b) => spentByCcy[b] - spentByCcy[a])[0] ||
        currencyCode(accounts[0]?.currencyCode);

  const byDay = lastNDates(14)
    .slice()
    .reverse()
    .map((date) => {
      const daySpend = spendingTxs
        .filter(
          (t) =>
            t.date === date &&
            transactionFlow(t.type, t.amount) === 'debit' &&
            currencyCode(t.currencyCode) === chartCcy
        )
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { date: date.slice(5), spend: Math.round(daySpend * 100) / 100 };
    });
  const hasChart = byDay.some((d) => d.spend > 0);

  if (loading && accounts.length === 0 && txs.length === 0) {
    return <p className="text-sm text-muted-foreground">Încarc cheltuielile…</p>;
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Niciun cont încă. Conectează banca mai jos, apoi apar soldurile și cheltuielile aici.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Cheltuieli</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={syncing} onClick={() => sync()}>
            <RefreshCw className="h-4 w-4" />
            {syncing ? 'Sincronizez…' : 'Sincronizează'}
          </Button>
          <Button type="button" variant="outline" disabled={enriching} onClick={() => enrich()}>
            <Sparkles className="h-4 w-4" />
            {enriching ? 'Categorizez…' : 'Categorizează'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Sold"
          value={formatByCurrency(balanceByCcy)}
          sub={`${accounts.length} cont${accounts.length === 1 ? '' : 'uri'} · pe monedă`}
          accent="teal"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Cheltuit luna"
          value={formatByCurrency(spentByCcy)}
          sub="doar debituri, fără transferuri interne"
          accent="red"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Încasări luna"
          value={formatByCurrency(incomeByCcy)}
          sub="doar creditări, fără transferuri interne"
          accent="green"
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
        <StatCard
          label="Tranzacții"
          value={String(txs.length)}
          sub="ultimele 30 zile"
          accent="default"
          icon={<Landmark className="h-4 w-4" />}
        />
      </div>

      {hasChart && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-heading text-base font-semibold">Cheltuieli · 14 zile · {chartCcy}</h3>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={CHART_MARGIN}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [money(Number(value), chartCcy), 'Cheltuit']}
                />
                <Bar dataKey="spend" name="Cheltuit" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-heading text-base font-semibold">Tranzacții</h3>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {syncing ? 'Sincronizez tranzacțiile…' : 'Nicio tranzacție în ultimele 30 de zile.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dată</TableHead>
                  <TableHead>Detalii</TableHead>
                  <TableHead className="hidden sm:table-cell">Categorie</TableHead>
                  <TableHead className="text-right">Sumă</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((tx) => {
                  const flow = transactionFlow(tx.type, tx.amount);
                  const internal = internalIds.has(tx.id);
                  const debit = flow === 'debit';
                  const ccy = currencyCode(tx.currencyCode);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {tx.date}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{internal ? 'Transfer intern' : merchant(tx)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tx.bank}
                          {tx.description && tx.description !== merchant(tx) ? ` · ${tx.description}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {internal ? 'Transfer intern' : (tx.categoryName ?? '—')}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          internal ? 'text-muted-foreground' : debit ? 'text-destructive' : 'text-primary'
                        }`}
                      >
                        {debit ? '−' : '+'}
                        {money(Math.abs(tx.amount), ccy)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {msg && (
        <p className="text-sm text-muted-foreground" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
