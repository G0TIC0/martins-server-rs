import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Quote, QuoteStatus } from '../types';
import { cn, formatCurrency, formatDateTime, mapQuote } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, FileText, CheckCircle, Clock, AlertCircle, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { motion } from 'motion/react';

const COLORS = ['#111827', '#B0E0E6', '#6B7280', '#9CA3AF', '#E5E7EB'];

export const Dashboard: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        console.log('[Dashboard] Fetching quotes...');
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const mappedData = (data || []).map(mapQuote);
        setQuotes(mappedData);
      } catch (error) {
        console.error('[Dashboard] Error fetching quotes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();

    // Safety timeout
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, []);

  const stats = {
    total: quotes.length,
    approved: quotes.filter(q => q.status === 'finished').length,
    pending: quotes.filter(q => ['received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing'].includes(q.status)).length,
    totalValue: quotes.reduce((acc, q) => acc + q.grandTotal, 0),
    avgTicket: quotes.length > 0 ? quotes.reduce((acc, q) => acc + q.grandTotal, 0) / quotes.length : 0,
    approvalRate: quotes.length > 0 ? (quotes.filter(q => q.status === 'finished').length / quotes.length) * 100 : 0,
  };

  const statusData = [
    { name: 'Finalizados', value: stats.approved },
    { name: 'Em Aberto', value: stats.pending },
  ];

  const stuckQuotes = quotes.filter(q => {
    if (q.status !== 'negotiating') return false;
    const lastUpdate = q.updatedAt ? (q.updatedAt as any).toDate?.() || new Date(q.updatedAt) : new Date(q.createdAt);
    const hoursStuck = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursStuck > 24;
  });

  const recentQuotes = quotes.slice(0, 5);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#111827] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Alerts Section */}
      {stuckQuotes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#FEF2F2] bg-[#FEF2F2] p-4 text-[#991B1B]"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-bold">Atenção: {stuckQuotes.length} orçamentos parados em 'Tratativa' por mais de 24h.</p>
              <p className="text-xs opacity-80">Estes orçamentos requerem atenção imediata para não perder a venda.</p>
            </div>
            <button className="rounded-lg bg-white px-3 py-1 text-xs font-bold shadow-sm hover:bg-gray-50">
              Ver Orçamentos
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita Projetada"
          value={formatCurrency(stats.totalValue)}
          icon={TrendingUp}
          trend="+12.5%"
          trendUp={true}
          color="black"
        />
        <StatCard
          title="Orçamentos Totais"
          value={stats.total.toString()}
          icon={FileText}
          trend="+5.2%"
          trendUp={true}
          color="blue"
        />
        <StatCard
          title="Taxa de Aprovação"
          value={`${stats.approvalRate.toFixed(1)}%`}
          icon={CheckCircle}
          trend="-2.1%"
          trendUp={false}
          color="blue"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats.avgTicket)}
          icon={Users}
          trend="+8.4%"
          trendUp={true}
          color="black"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#111827]">Desempenho de Vendas</h2>
            <select className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-sm focus:outline-none">
              <option>Últimos 7 dias</option>
              <option>Últimos 30 dias</option>
              <option>Este ano</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-[#111827]">Distribuição de Status</h2>
          <div className="h-64 w-full">
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
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[#4B5563]">{item.name}</span>
                </div>
                <span className="font-medium text-[#111827]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#111827]">Orçamentos Recentes</h2>
          <button className="text-sm font-medium text-[#111827] hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F3F4F6] text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                <th className="pb-4 pl-2">Número</th>
                <th className="pb-4">Cliente</th>
                <th className="pb-4">Data</th>
                <th className="pb-4">Valor</th>
                <th className="pb-4">Status</th>
                <th className="pb-4 pr-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {recentQuotes.map((quote) => (
                <tr key={quote.id} className="group hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-4 pl-2 font-medium text-[#111827]">{quote.quoteNumber}</td>
                  <td className="py-4 text-[#4B5563]">{quote.customerName}</td>
                  <td className="py-4 text-[#6B7280] text-sm">{formatDateTime(quote.createdAt)}</td>
                  <td className="py-4 font-semibold text-[#111827]">{formatCurrency(quote.grandTotal)}</td>
                  <td className="py-4">
                    <StatusBadge status={quote.status} />
                  </td>
                  <td className="py-4 pr-2 text-right">
                    <button className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {recentQuotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#9CA3AF]">Nenhum orçamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
      className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className={cn("rounded-xl p-3", colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-[#10B981]" : "text-[#EF4444]")}>
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-[#6B7280]">{title}</p>
        <h3 className="mt-1 text-2xl font-bold text-[#111827]">{value}</h3>
      </div>
    </motion.div>
  );
};

const StatusBadge: React.FC<{ status: QuoteStatus }> = ({ status }) => {
  const config: Record<string, { label: string; classes: string; icon: any }> = {
    received: { label: 'Recebido', classes: 'bg-gray-100 text-gray-700', icon: Clock },
    analyzing: { label: 'Em Análise', classes: 'bg-martins-blue text-[#111827]', icon: AlertCircle },
    negotiating: { label: 'Em Tratativa', classes: 'bg-indigo-100 text-indigo-700', icon: FileText },
    awaiting_approval: { label: 'Aguardando Aprovação', classes: 'bg-purple-100 text-purple-700', icon: Users },
    executing: { label: 'Execução', classes: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    finished: { label: 'Finalizado', classes: 'bg-amber-100 text-amber-700', icon: TrendingUp },
    // Fallbacks for old status values
    draft: { label: 'Rascunho', classes: 'bg-gray-100 text-gray-700', icon: Clock },
    review: { label: 'Revisão', classes: 'bg-martins-blue text-[#111827]', icon: AlertCircle },
    sent: { label: 'Enviado', classes: 'bg-indigo-100 text-indigo-700', icon: FileText },
    viewed: { label: 'Visualizado', classes: 'bg-purple-100 text-purple-700', icon: Users },
    approved: { label: 'Aprovado', classes: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    rejected: { label: 'Rejeitado', classes: 'bg-rose-100 text-rose-700', icon: X },
    converted: { label: 'Convertido', classes: 'bg-amber-100 text-amber-700', icon: TrendingUp },
  };

  const badgeConfig = config[status] || { label: status, classes: 'bg-gray-100 text-gray-700', icon: Clock };
  const { label, classes, icon: Icon } = badgeConfig;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", classes)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};
