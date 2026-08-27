import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { Service, Technician, Client } from '../types';
import { getCalibrationStatus, CalibrationAlertLevel } from '../utils';
import {
  X,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Search,
  ExternalLink,
  Edit3,
  Building2,
  UserCheck
} from 'lucide-react';
import { parseISO } from 'date-fns/parseISO';
import { isValid } from 'date-fns/isValid';

interface CalibrationAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  technicians: Technician[];
  clients: Client[];
  onSelectService: (service: Service) => void;
  onNavigateToDate: (date: Date) => void;
}

export const CalibrationAlertsModal: React.FC<CalibrationAlertsModalProps> = ({
  isOpen,
  onClose,
  services,
  technicians,
  clients,
  onSelectService,
  onNavigateToDate,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'OK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Process all services with calibration status
  const analyzedServices = useMemo(() => {
    return services
      .map(service => {
        const calStatus = getCalibrationStatus(service);
        return {
          service,
          calStatus
        };
      })
      .filter(item => item.calStatus.level !== 'NONE');
  }, [services]);

  // Counts
  const counts = useMemo(() => {
    let expired = 0;
    let expiringSoon = 0;
    let ok = 0;

    analyzedServices.forEach(item => {
      if (item.calStatus.level === 'EXPIRED') expired++;
      else if (item.calStatus.level === 'EXPIRING_SOON') expiringSoon++;
      else if (item.calStatus.level === 'OK') ok++;
    });

    return {
      all: analyzedServices.length,
      expired,
      expiringSoon,
      ok
    };
  }, [analyzedServices]);

  // Filtered services
  const filteredList = useMemo(() => {
    return analyzedServices
      .filter(item => {
        if (activeTab !== 'ALL' && item.calStatus.level !== activeTab) {
          return false;
        }

        if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          const clientMatch = item.service.client.toLowerCase().includes(lower);
          const osMatch = item.service.os?.toLowerCase().includes(lower);
          const descMatch = item.service.description?.toLowerCase().includes(lower);
          return clientMatch || osMatch || descMatch;
        }

        return true;
      })
      .sort((a, b) => {
        // Expired first, then expiring soon, then OK
        const order: Record<CalibrationAlertLevel, number> = {
          EXPIRED: 0,
          EXPIRING_SOON: 1,
          OK: 2,
          NONE: 3
        };
        const levelDiff = order[a.calStatus.level] - order[b.calStatus.level];
        if (levelDiff !== 0) return levelDiff;

        // Sort by remaining days ascending (most urgent first)
        return (a.calStatus.daysRemaining ?? 9999) - (b.calStatus.daysRemaining ?? 9999);
      });
  }, [analyzedServices, activeTab, searchTerm]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Central de Alertas de Calibração</h2>
              <p className="text-xs text-slate-300">
                Monitore prazos de vencimento, calibrações expiradas e previsões futuras
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters and Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{counts.all}</span>
            </button>
            <button
              onClick={() => setActiveTab('EXPIRED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'EXPIRED'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-red-700 hover:bg-red-100/50'
              }`}
            >
              🔴 Vencidas <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{counts.expired}</span>
            </button>
            <button
              onClick={() => setActiveTab('EXPIRING_SOON')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'EXPIRING_SOON'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-800 hover:bg-amber-100/50'
              }`}
            >
              🟡 A Vencer (30d) <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">{counts.expiringSoon}</span>
            </button>
            <button
              onClick={() => setActiveTab('OK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'OK'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 hover:bg-emerald-100/50'
              }`}
            >
              🟢 Em Dia <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{counts.ok}</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente, OS..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-sm font-medium">Nenhuma calibração encontrada neste filtro.</p>
              <p className="text-xs text-slate-400">Todas as calibrações estão em dia ou os critérios não correspondem.</p>
            </div>
          ) : (
            filteredList.map(({ service, calStatus }) => {
              const techNames = service.technicianIds
                ?.map(id => technicians.find(t => t.id === id)?.name)
                .filter(Boolean)
                .join(', ') || 'Nenhum';

              const isExpired = calStatus.level === 'EXPIRED';
              const isExpiringSoon = calStatus.level === 'EXPIRING_SOON';

              return (
                <div
                  key={service.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                    isExpired
                      ? 'bg-red-50/70 border-red-200 hover:border-red-300'
                      : isExpiringSoon
                      ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Info Left */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2 rounded-xl mt-0.5 ${
                        isExpired
                          ? 'bg-red-100 text-red-600'
                          : isExpiringSoon
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      {isExpired ? (
                        <AlertTriangle size={18} />
                      ) : isExpiringSoon ? (
                        <Clock size={18} />
                      ) : (
                        <Calendar size={18} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                          <Building2 size={14} className="text-slate-400" />
                          {service.client}
                        </span>
                        {service.os && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                            OS: {service.os}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider bg-slate-200 text-slate-700">
                          {service.status}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span>
                          <strong>Periodicidade:</strong> {service.period} meses
                        </span>
                        {service.lastCalibration && (
                          <span>
                            <strong>Última Calibração:</strong> {service.lastCalibration}
                          </span>
                        )}
                        <span>
                          <strong>Técnico(s):</strong> {techNames}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Deadline & Actions Right */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                    <div className="text-left md:text-right">
                      <div className="text-xs text-slate-500">Vencimento Previsto</div>
                      <div
                        className={`text-sm font-bold ${
                          isExpired
                            ? 'text-red-700'
                            : isExpiringSoon
                            ? 'text-amber-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {calStatus.targetDateText}
                      </div>
                      <div className="text-[10px] font-semibold">
                        {isExpired ? (
                          <span className="text-red-600">
                            Atrasado há {Math.abs(calStatus.daysRemaining || 0)} dias
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="text-amber-600">
                            Vence em {calStatus.daysRemaining} dias
                          </span>
                        ) : (
                          <span className="text-emerald-600">
                            Vence em {calStatus.daysRemaining} dias
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {calStatus.targetDate && isValid(calStatus.targetDate) && (
                        <button
                          onClick={() => {
                            if (calStatus.targetDate) {
                              onNavigateToDate(calStatus.targetDate);
                              onClose();
                            }
                          }}
                          title="Ver no Calendário"
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1 text-xs"
                        >
                          <Calendar size={14} />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onSelectService(service);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Edit3 size={13} />
                        <span>Agendar / Editar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Total: <strong>{analyzedServices.length}</strong> calibrações monitoradas
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
