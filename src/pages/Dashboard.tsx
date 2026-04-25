import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Quote } from '../types';
import { cn, formatCurrency, formatDateTime, mapQuote } from '../lib/utils';
import { withRetry } from '../lib/supabase-retry';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, FileText, CheckCircle, Clock, AlertCircle, ArrowUpRight, ArrowDownRight, X, Plus, Package, Settings, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../context/SupabaseContext';

const COLORS = ['#111827', '#B0E0E6', '#6B7280', '#9CA3AF', '#E5E7EB'];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isCustomer, profile, isAdmin, isManager, isSales } = useSupabase();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const { data, error } = await withRetry(async () => 
        await supabase
          .from('quotes')
          .select('*, quote_items(*)')
          .order('created_at', { ascending: false })
          .limit(100)
      ) as { data: any[] | null; error: any };

      if (error) throw error;
      setQuotes((data || []).map(mapQuote));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes(true);
  }, [fetchQuotes]);

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes' },
        () => fetchQuotes(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quote_items' },
        () => fetchQuotes(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQuotes]);

  const stats = React.useMemo(() => {
    const approved = quotes.filter(q => q.status === 'finished' || q.status === 'executing');
    const totalValue = quotes.reduce((acc, q) => acc + (q.grandTotal || 0), 0);
    const avgTicket = quotes.length > 0 ? totalValue / quotes.length : 0;
    const approvalRate = quotes.length > 0 ? (approved.length / quotes.length) * 100 : 0;

    return {
      totalQuotes: quotes.length,
      totalValue,
      avgTicket,
      approvalRate,
    };
  }, [quotes]);

  const statusData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    quotes.forEach(q => {
      counts[q.status] = (counts[q.status] || 0) + 1;
    });

    const statusLabels: Record<string, string> = {
      received: 'Recebidos',
      analyzing: 'Em Análise',
      negotiating: 'Negociando',
      awaiting_approval: 'Aguardando',
      executing: 'Execução',
      finished: 'Finalizados',
    };

    return Object.entries(counts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
    }));
  }, [quotes]);

  const stuckQuotes = React.useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 3);

    return quotes
      .filter(q => 
        q.status !== 'finished' && 
        new Date(q.updatedAt || q.createdAt) < threshold
      )
      .slice(0, 5);
  }, [quotes]);

  const recentQuotes = React.useMemo(() => quotes.slice(0, 5), [quotes]);

  const revenueByType = React.useMemo(() => {
    const totals: Record<string, number> = {};
    
    // Consideramos todos os orçamentos para alinhar com o KPI "Total em Propostas"
    for (const quote of quotes) {
      if (!quote.grandTotal || quote.grandTotal === 0) continue;

      const quoteItems = quote.items ?? [];
      const itemsSubtotalRaw = quoteItems.reduce((acc, item) => acc + (item.total ?? 0), 0);
      
      if (itemsSubtotalRaw === 0) {
        // Se não há itens detalhados, mas o orçamento tem valor, consideramos como 'product' para evitar categorias inexistentes
        totals['product'] = (totals['product'] ?? 0) + quote.grandTotal;
        continue;
      }

      const discountFactor = quote.grandTotal / itemsSubtotalRaw;

      for (const item of quoteItems) {
        // Default to 'product' if type is missing, as most manual items are products
        const itemType = item.type || 'product';
        const itemValue = (item.total ?? 0) * discountFactor;
        totals[itemType] = (totals[itemType] ?? 0) + itemValue;
      }
    }

    const TYPE_LABELS: Record<string, string> = {
      service: 'Serviços',
      product: 'Produtos',
      labor:   'Mão de obra',
      package: 'Pacotes',
      others:  'Não categorizados',
    };

    return Object.entries(totals)
      .map(([type, total]) => ({
        type,
        label: TYPE_LABELS[type] ?? (type === 'others' ? 'Não categorizados' : type),
        total,
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [quotes]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#111827] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Alerts Section */}
      {stuckQuotes.length > 0 && !isCustomer && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-100 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-800">Atenção: Orçamentos sem movimentação</h3>
              <p className="mt-1 text-sm text-red-700">Há {stuckQuotes.length} orçamentos parados há mais de 3 dias que precisam de atenção.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stuckQuotes.map(q => (
                  <button
                    key={q.id}
                    onClick={() => navigate(`/quotes/${q.id}`)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm transition-all hover:bg-red-100 active:scale-95"
                  >
                    {q.quoteNumber} - {q.customerName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total em Propostas"
          value={formatCurrency(stats.totalValue)}
          icon={TrendingUp}
          trend="+12%"
          trendUp={true}
          color="black"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats.avgTicket)}
          icon={FileText}
          trend="+5%"
          trendUp={true}
          color="blue"
        />
        <StatCard
          title="Taxa de Aprovação"
          value={`${Math.round(stats.approvalRate)}%`}
          icon={CheckCircle}
          trend="-2%"
          trendUp={false}
          color="blue"
        />
        <StatCard
          title="Orçamentos Totais"
          value={stats.totalQuotes.toString()}
          icon={FileText}
          trend="+18%"
          trendUp={true}
          color="black"
        />
      </div>

      {!isCustomer && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#111827]">Acesso Rápido</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <QuickActionCard
              title="Novo Orçamento"
              icon={Plus}
              onClick={() => navigate('/quotes/new')}
              color="black"
            />
            <QuickActionCard
              title="Novo Cliente"
              icon={UserPlus}
              onClick={() => navigate('/customers')}
              color="blue"
            />
            <QuickActionCard
              title="Novo Item"
              icon={Package}
              onClick={() => navigate('/items')}
              color="blue"
            />
            {(isAdmin || isManager) && (
              <QuickActionCard
                title="Configurações"
                icon={Settings}
                onClick={() => navigate('/settings')}
                color="black"
              />
            )}
          </div>
        </section>
      )}

      {!isCustomer && revenueByType.length > 0 && (
        <RevenueByTypeCard data={revenueByType} />
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-bold text-[#111827]">Volume de Orçamentos</h2>
            <button className="text-xs font-bold uppercase tracking-wider text-[#6B7280] hover:text-[#111827]">Últimos 30 dias</button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#111827" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="font-bold text-[#111827]">Status dos Orçamentos</h2>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {statusData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs text-[#6B7280]">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-[#111827]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Quotes */}
        <div className="lg:col-span-3 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-6 bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <h2 className="font-bold text-[#111827]">Orçamentos Recentes</h2>
            <button onClick={() => navigate('/quotes')} className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#6B7280] hover:text-[#111827]">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#9CA3AF] border-b border-[#F3F4F6]">
                  <th className="px-6 py-4 font-bold">Número</th>
                  <th className="px-6 py-4 font-bold">Cliente</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Total</th>
                  <th className="px-6 py-4 font-bold text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {recentQuotes.map((quote) => (
                  <tr 
                    key={quote.id} 
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                    className="group cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-bold text-[#111827] group-hover:text-black">{quote.quoteNumber}</td>
                    <td className="px-6 py-4 text-sm text-[#6B7280]">{quote.customerName}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[#111827]">{formatCurrency(quote.grandTotal || 0)}</td>
                    <td className="px-6 py-4 text-right text-xs text-[#6B7280] font-medium">{formatDateTime(quote.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickActionCard: React.FC<{ title: string; icon: any; onClick: () => void; color: 'black' | 'blue' }> = ({ title, icon: Icon, onClick, color }) => {
  const colorClasses = {
    black: "bg-[#111827] text-white hover:bg-black",
    blue: "bg-martins-blue text-[#111827] hover:bg-[#A0D0D6]",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl p-6 shadow-sm transition-all active:scale-95 group",
        colorClasses[color]
      )}
    >
      <div className="rounded-xl bg-white/10 p-2 group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-sm font-bold">{title}</span>
    </button>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: any; trend: string; trendUp: boolean; color: string }> = ({ title, value, icon: Icon, trend, trendUp, color }) => {
  const colorClasses: Record<string, string> = {
    black: "bg-[#111827] text-white",
    blue: "bg-martins-blue text-[#111827]",
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn("rounded-2xl p-6 shadow-sm border border-transparent transition-all", colorClasses[color])}
    >
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-white/20 p-2">
          <Icon className="h-6 w-6" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1",
          trendUp ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
        )}>
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-xs font-medium opacity-80">{title}</h3>
        <p className="mt-1 text-2xl font-black">{value}</p>
      </div>
    </motion.div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    received: 'bg-[#F9FAFB] text-[#6B7280]',
    analyzing: 'bg-[#B0E0E6]/20 text-[#0E7490]',
    negotiating: 'bg-yellow-50 text-yellow-700',
    awaiting_approval: 'bg-orange-50 text-orange-700',
    executing: 'bg-[#111827] text-white',
    finished: 'bg-green-50 text-green-700',
  };

  const labels: Record<string, string> = {
    received: 'Recebido',
    analyzing: 'Em Análise',
    negotiating: 'Negociação',
    awaiting_approval: 'Aguardando',
    executing: 'Execução',
    finished: 'Finalizado',
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
      styles[status] || styles.received
    )}>
      {labels[status] || status}
    </span>
  );
};

const TYPE_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  service: { bar: 'bg-[#D3D1C7]', bg: 'bg-[#F3F2EF]', text: 'text-[#2C2C2A]' },
  product: { bar: 'bg-[#B5D4F4]', bg: 'bg-[#EBF4FE]', text: 'text-[#042C53]' },
  labor:   { bar: 'bg-[#C0DD97]', bg: 'bg-[#EAF3DE]', text: 'text-[#173404]' },
  package: { bar: 'bg-[#FAC775]', bg: 'bg-[#FAEEDA]', text: 'text-[#412402]' },
};

const RevenueByTypeCard: React.FC<{
  data: { type: string; label: string; total: number }[];
}> = ({ data }) => {
  const maxTotal = data[0]?.total ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#111827]">
          Receita projetada por tipo de item
        </h2>
        <span className="rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#6B7280]">
          {data.length} {data.length === 1 ? 'tipo em uso' : 'tipos em uso'}
        </span>
      </div>

      {/* Mini KPIs por tipo */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.map(({ type, label, total }) => {
          const colors = TYPE_COLORS[type] ?? { bg: 'bg-[#F9FAFB]', text: 'text-[#111827]', bar: 'bg-[#E5E7EB]' };
          return (
            <div key={type} className={cn('rounded-xl p-3', colors.bg)}>
              <p className={cn('text-xs', colors.text)}>{label}</p>
              <p className={cn('mt-1 text-sm font-semibold', colors.text)}>
                {formatCurrency(total)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Barras horizontais proporcionais */}
      <div className="space-y-3">
        {data.map(({ type, label, total }) => {
          const pct = Math.max(4, Math.round((total / maxTotal) * 100));
          const colors = TYPE_COLORS[type] ?? { bar: 'bg-[#E5E7EB]', bg: 'bg-[#F9FAFB]', text: 'text-[#111827]' };
          return (
            <div key={type} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right text-xs text-[#6B7280]">
                {label}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-[#F3F4F6]">
                <div
                  className={cn(
                    'flex h-full items-center justify-end rounded-md pr-2 transition-all duration-500',
                    colors.bar
                  )}
                  style={{ width: `${pct}%` }}
                >
                  <span className="text-[11px] font-medium">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
