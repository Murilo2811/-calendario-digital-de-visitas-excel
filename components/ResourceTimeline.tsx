import React, { useState, useEffect } from 'react';
import { Service, ServiceStatus, Technician, TechType } from '../types';
import { getDaysInRange } from '../utils';
import { addDays } from 'date-fns/addDays';
import { areIntervalsOverlapping } from 'date-fns/areIntervalsOverlapping';
import { differenceInDays } from 'date-fns/differenceInDays';
import { eachMonthOfInterval } from 'date-fns/eachMonthOfInterval';
import { endOfMonth } from 'date-fns/endOfMonth';
import { format } from 'date-fns/format';
import { getDate } from 'date-fns/getDate';
import { getDaysInMonth } from 'date-fns/getDaysInMonth';
import { getISOWeek } from 'date-fns/getISOWeek';
import { max } from 'date-fns/max';
import { min } from 'date-fns/min';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { ptBR } from 'date-fns/locale/pt-BR';


interface ResourceTimelineProps {
    services: Service[];
    technicians: Technician[];
    rangeStart: Date;
    rangeEnd: Date;
    onServiceMove: (id: string, newStartDate: string, newTechId: string, oldTechId: string) => void;
    onServiceResize: (id: string, newStartDate: string, newEndDate: string) => void;
    onServiceClick: (service: Service) => void;
    canEdit?: boolean;
}

interface DragState {
    service: Service;
    techId: string | null; // The current hover target tech
    sourceTechId: string;  // The tech ID where drag started
    date: Date | null;
    duration: number; // days
}

export const ResourceTimeline: React.FC<ResourceTimelineProps> = ({
    services,
    technicians,
    rangeStart,
    rangeEnd,
    onServiceMove,
    onServiceResize,
    onServiceClick,
    canEdit = true
}) => {

    const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;
    const isYearView = totalDays > 45;

    const [dragState, setDragState] = useState<DragState | null>(null);

    // --- Resize State ---
    interface ResizeState {
        service: Service;
        edge: 'left' | 'right';
        currentDate: Date | null;
        techId: string;
    }
    const [resizeState, setResizeState] = useState<ResizeState | null>(null);

    const handleResizeStart = (e: React.MouseEvent, service: Service, edge: 'left' | 'right', techId: string) => {
        e.stopPropagation();
        e.preventDefault();
        setResizeState({ service, edge, currentDate: null, techId });
    };

    useEffect(() => {
        if (!resizeState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const element = document.elementFromPoint(e.clientX, e.clientY);
            const dateStr = element?.closest('[data-date]')?.getAttribute('data-date');
            if (dateStr) {
                const date = parseISO(dateStr);
                setResizeState(prev => prev ? { ...prev, currentDate: date } : null);
            }
        };

        const handleMouseUp = () => {
            setResizeState(prev => {
                if (prev && prev.currentDate) {
                    const { service, edge, currentDate } = prev;
                    let newStart = parseISO(service.startDate);
                    let newEnd = parseISO(service.endDate);

                    if (edge === 'left') {
                        newStart = currentDate;
                        if (newStart > newEnd) {
                            newStart = newEnd;
                        }
                    } else {
                        newEnd = currentDate;
                        if (newEnd < newStart) {
                            newEnd = newStart;
                        }
                    }

                    onServiceResize(service.id, format(newStart, 'yyyy-MM-dd'), format(newEnd, 'yyyy-MM-dd'));
                }
                return null;
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizeState, onServiceResize]);

    const calculateLanes = (techServices: Service[]) => {
        const sorted = [...techServices].sort((a, b) => a.startDate.localeCompare(b.startDate));
        const lanes: Service[][] = [];
        const placement = new Map<string, { lane: number }>();

        sorted.forEach(service => {
            let laneIndex = 0;
            while (true) {
                const lane = lanes[laneIndex] || [];
                const hasOverlap = lane.some(existing => {
                    const startA = parseISO(service.startDate);
                    const endA = parseISO(service.endDate);
                    const startB = parseISO(existing.startDate);
                    const endB = parseISO(existing.endDate);
                    return areIntervalsOverlapping({ start: startA, end: endA }, { start: startB, end: endB }, { inclusive: true });
                });

                if (!hasOverlap) {
                    if (!lanes[laneIndex]) lanes[laneIndex] = [];
                    lanes[laneIndex].push(service);
                    placement.set(service.id, { lane: laneIndex });
                    break;
                }
                laneIndex++;
            }
        });

        return { placement, totalLanes: lanes.length || 1 };
    };

    // Helper to cluster services that overlap with each other
    const groupOverlappingServices = (services: Service[]): Service[][] => {
        if (services.length === 0) return [];

        const sortedServices = [...services]
            .map(s => {
                try {
                    return {
                        ...s,
                        _start: parseISO(s.startDate),
                        _end: parseISO(s.endDate),
                    }
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a, b) => a!._start.getTime() - b!._start.getTime());

        const groups: Service[][] = [];
        if (sortedServices.length > 0) {
            let currentGroup = [sortedServices[0]!];
            let groupEnd = sortedServices[0]!._end;

            for (let i = 1; i < sortedServices.length; i++) {
                const service = sortedServices[i]!;
                if (service._start <= groupEnd) {
                    currentGroup.push(service);
                    groupEnd = max([groupEnd, service._end]);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [service];
                    groupEnd = service._end;
                }
            }
            groups.push(currentGroup);
        }
        return groups;
    };

    // Pre-calculate layout for each service based on its local overlaps within a specific technician context
    const getTechServiceLayout = (techId: string, techServices: Service[]) => {
        const serviceGroups = groupOverlappingServices(techServices);
        const layoutMap = new Map<string, { lane: number; totalLanes: number }>();

        serviceGroups.forEach(group => {
            const { placement: groupPlacement, totalLanes: groupTotalLanes } = calculateLanes(group);
            group.forEach(service => {
                const layoutInfo = groupPlacement.get(service.id);
                if (layoutInfo) {
                    layoutMap.set(service.id, {
                        lane: layoutInfo.lane,
                        totalLanes: groupTotalLanes,
                    });
                }
            });
        });
        return layoutMap;
    };


    const handleDragStart = (e: React.DragEvent, service: Service, sourceTechId: string) => {
        if (!canEdit) {
            e.preventDefault();
            return;
        }
        const duration = differenceInDays(parseISO(service.endDate), parseISO(service.startDate)) + 1;

        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);

        setTimeout(() => {
            setDragState({
                service: service,
                techId: null,
                sourceTechId: sourceTechId,
                date: null,
                duration
            });
        }, 0);
        e.dataTransfer.setData("serviceId", service.id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnter = (e: React.DragEvent, techId: string, date: Date) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragState && (dragState.techId !== techId || dragState.date?.getTime() !== date.getTime())) {
            setDragState(prev => prev ? ({ ...prev, techId, date }) : null);
        }
    };

    const handleDrop = (e: React.DragEvent, techId: string, dateContext: Date) => {
        e.preventDefault();
        e.stopPropagation();
        const serviceId = e.dataTransfer.getData("serviceId");

        if (serviceId && dragState) {
            const dateStr = format(dateContext, 'yyyy-MM-dd');
            onServiceMove(serviceId, dateStr, techId, dragState.sourceTechId);
        }
        setDragState(null);
    };

    const handleDragEnd = () => setDragState(null);

    const renderServiceBar = (
        service: Service,
        style: React.CSSProperties,
        totalLanesInGroup: number,
        sourceTechId: string,
        continuesLeft = false,
        continuesRight = false
    ) => {

        let bgColor = 'bg-slate-400';
        let textColor = 'text-white';

        switch (service.status) {
            case ServiceStatus.TRAINING_FIELD: bgColor = 'bg-slate-400'; break;
            case ServiceStatus.PREDICTED: bgColor = 'bg-yellow-400'; textColor = 'text-yellow-900'; break;
            case ServiceStatus.WITH_ORDER: bgColor = 'bg-orange-400'; break;
            case ServiceStatus.CONFIRMED: bgColor = 'bg-green-600'; break;
            case ServiceStatus.TRAINING: bgColor = 'bg-purple-500'; break;
            case ServiceStatus.VACATION: bgColor = 'bg-blue-500'; break;
            case ServiceStatus.NEGOTIATION: bgColor = 'bg-cyan-400'; textColor = 'text-cyan-900'; break;
            case ServiceStatus.HOLIDAY: bgColor = 'bg-slate-800'; break;
        }

        const isDragging = dragState?.service.id === service.id;
        const isAnyDragging = dragState !== null;
        const isResizing = resizeState?.service.id === service.id;
        const isAnyResizing = resizeState !== null;

        const tooltipText = `Cliente: ${service.client}\nOS: ${service.os || 'N/A'}\nDescrição: ${service.description || 'N/A'}\nPeríodo: ${format(parseISO(service.startDate), 'dd/MM/yy')} - ${format(parseISO(service.endDate), 'dd/MM/yy')}`;

        const isCompact = totalLanesInGroup > 1;

        const clientFontSize = isCompact ? 'text-[11px]' : 'text-sm';
        const osFontSize = isCompact ? 'text-[9px]' : 'text-xs';
        const paddingY = isCompact ? 'py-0' : 'py-1';
        const lineLeading = isCompact ? 'leading-tight' : 'leading-snug';


        return (
            <div
                key={`${service.id}-${sourceTechId}-${style.left}`}
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, service, sourceTechId)}
                onDragEnd={handleDragEnd}
                onClick={(e) => { e.stopPropagation(); onServiceClick(service); }}
                className={`absolute rounded-md shadow-sm px-1.5 flex flex-col justify-center cursor-pointer hover:brightness-110 select-none overflow-hidden border border-white/20 z-10 hover:z-20
                ${bgColor} ${textColor} ${paddingY}
                ${continuesLeft ? 'rounded-l-none border-l-0' : ''}
                ${continuesRight ? 'rounded-r-none border-r-0' : ''}
                ${isDragging || isResizing ? 'opacity-30' : ''} 
                ${isAnyDragging || isAnyResizing ? 'pointer-events-none' : ''} 
            `}
                style={style}
                title={tooltipText}
            >
                <div className={`font-bold truncate ${lineLeading} ${clientFontSize}`}>{service.client}</div>
                <div className={`opacity-80 truncate ${lineLeading} ${osFontSize}`}>{service.os || '-'}</div>
                {canEdit && !isAnyDragging && !isAnyResizing && (
                    <>
                        <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-20 hover:bg-white/20 rounded-l-md"
                            onMouseDown={(e) => handleResizeStart(e, service, 'left', sourceTechId)}
                            title="Redimensionar início"
                        />
                        <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-20 hover:bg-white/20 rounded-r-md"
                            onMouseDown={(e) => handleResizeStart(e, service, 'right', sourceTechId)}
                            title="Redimensionar fim"
                        />
                    </>
                )}
            </div>
        );
    };

    const renderGhostBar = (currentTechId: string, currentViewStart: Date, currentViewEnd: Date, totalDaysInView: number) => {
        if (!dragState || !dragState.date || dragState.techId !== currentTechId) return null;

        const ghostStart = dragState.date;
        const ghostEnd = addDays(ghostStart, dragState.duration - 1);

        const effectiveStart = max([ghostStart, currentViewStart]);
        const effectiveEnd = min([ghostEnd, currentViewEnd]);

        if (effectiveStart > effectiveEnd) return null;

        const offsetDays = differenceInDays(effectiveStart, currentViewStart);
        const durationDays = differenceInDays(effectiveEnd, effectiveStart) + 1;

        const leftPercent = (offsetDays / totalDaysInView) * 100;
        const widthPercent = (durationDays / totalDaysInView) * 100;

        const tech = technicians.find(t => t.id === currentTechId);

        return (
            <div
                className="absolute top-1 bottom-1 bg-abb-red/10 border-2 border-dashed border-abb-red z-[60] pointer-events-none rounded-lg shadow-xl flex items-center justify-center overflow-hidden transition-all duration-75"
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
            >
                <div className="flex flex-col items-center justify-center leading-tight px-1">
                    <span className="text-[10px] font-bold text-abb-red/80 truncate whitespace-nowrap">
                        {dragState.service.client}
                    </span>
                    {tech && (
                        <span className="text-[8px] font-bold text-abb-red bg-white/50 px-1.5 py-0.5 rounded-full mt-0.5">
                            {tech.name}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const renderStandardView = () => {
        const days = getDaysInRange(rangeStart, rangeEnd);
        const cellMinWidth = 'min-w-[40px]';

        const weeks: { weekNumber: number; days: Date[] }[] = [];
        if (days.length > 0) {
            let currentWeek = getISOWeek(days[0]);
            let weekDays: Date[] = [];
            days.forEach(day => {
                const isoWeek = getISOWeek(day);
                if (isoWeek !== currentWeek) {
                    weeks.push({ weekNumber: currentWeek, days: weekDays });
                    currentWeek = isoWeek;
                    weekDays = [];
                }
                weekDays.push(day);
            });
            weeks.push({ weekNumber: currentWeek, days: weekDays });
        }

        return (
            <div className="overflow-auto h-full flex flex-col bg-white">
                <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30 min-w-fit shadow-sm">
                    <div className="w-48 flex-shrink-0 font-semibold text-slate-600 text-xs border-r border-slate-200 bg-slate-50 z-40 sticky left-0 flex items-center justify-center uppercase">
                        Técnicos
                    </div>
                    <div className="flex flex-col flex-grow">
                        {/* Week Row */}
                        <div className="flex border-b border-slate-200">
                            {weeks.map(({ weekNumber, days: weekDays }) => (
                                <div
                                    key={weekNumber}
                                    className="flex-grow flex items-center justify-center p-1 text-xs font-bold text-slate-500 bg-slate-100/50 border-r border-slate-200 last:border-r-0"
                                    style={{ flexBasis: 0, flexGrow: weekDays.length }}
                                >
                                    <span>SEM {weekNumber}</span>
                                </div>
                            ))}
                        </div>
                        {/* Day Row */}
                        <div className="flex">
                            {days.map((d) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div key={d.toISOString()} className={`flex-1 ${cellMinWidth} border-r border-slate-200 last:border-r-0 flex flex-col items-center justify-center h-8 ${isWeekend ? 'bg-abb-red text-white' : 'text-slate-500'}`}>
                                        <span className="font-bold text-sm">{getDate(d)}</span>
                                        <span className={`text-[9px] uppercase font-semibold ${isWeekend ? 'text-white/90' : ''}`}>{format(d, 'EEE', { locale: ptBR })}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex-grow min-w-fit bg-white">
                    {technicians.map((tech) => {
                        const isPJ = tech.type === TechType.PJ;
                        const techServices = services.filter(s => s.technicianIds && s.technicianIds.includes(tech.id) && s.startDate && s.endDate);
                        const layoutMap = getTechServiceLayout(tech.id, techServices);

                        // Calculate max lanes needed for this specific tech row
                        let maxLanesForTech = 1;
                        layoutMap.forEach(info => {
                            if (info.totalLanes > maxLanesForTech) maxLanesForTech = info.totalLanes;
                        });

                        const rowHeight = Math.max(64, maxLanesForTech * 36 + 8);

                        return (
                            <div key={tech.id} className={`flex border-b border-slate-200 group ${isPJ ? 'bg-amber-50/20' : 'bg-white'}`} style={{ height: `${rowHeight}px` }}>
                                <div className={`w-48 flex-shrink-0 p-2 border-r border-slate-200 flex flex-col justify-center z-20 sticky left-0 ${isPJ ? 'bg-amber-50/50' : 'bg-white'} group-hover:bg-abb-red/5 transition-colors`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border ${tech.color} border-black/5`}>
                                            {tech.name}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-slate-800 truncate">{tech.fullName}</div>
                                            <div className="text-xs text-slate-500">{tech.type === TechType.INTERNAL ? 'Interno' : 'PJ / Terceiro'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-grow relative group-hover:bg-abb-red/5">
                                    <div className="absolute inset-0 flex pointer-events-none z-0">
                                        {days.map((d, idx) => {
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            return (
                                                <div key={idx} className={`flex-1 border-r border-slate-100 h-full ${cellMinWidth} ${isWeekend ? 'bg-red-50/80' : ''}`} />
                                            );
                                        })}
                                    </div>

                                    <div className="absolute inset-0 flex">
                                        {days.map((d, idx) => (
                                            <div
                                                key={idx}
                                                data-date={format(d, 'yyyy-MM-dd')}
                                                className={`flex-1 h-full ${dragState ? 'z-40' : 'z-0'} ${cellMinWidth}`}
                                                onDragOver={handleDragOver}
                                                onDragEnter={(e) => handleDragEnter(e, tech.id, d)}
                                                onDrop={(e) => handleDrop(e, tech.id, d)}
                                                onClick={(e) => e.stopPropagation()}
                                                title={format(d, 'dd/MM/yyyy')}
                                            />
                                        ))}
                                    </div>

                                    {renderGhostBar(tech.id, rangeStart, rangeEnd, totalDays)}

                                    {/* Resize Ghost */}
                                    {resizeState && resizeState.techId === tech.id && resizeState.currentDate && (() => {
                                        const service = resizeState.service;
                                        const sStart = parseISO(service.startDate);
                                        const sEnd = parseISO(service.endDate);
                                        let newStart = sStart;
                                        let newEnd = sEnd;

                                        if (resizeState.edge === 'left') {
                                            newStart = resizeState.currentDate;
                                            if (newStart > newEnd) newStart = newEnd;
                                        } else {
                                            newEnd = resizeState.currentDate;
                                            if (newEnd < newStart) newEnd = newStart;
                                        }

                                        const rangeStartDay = startOfDay(rangeStart);
                                        const effectiveStart = max([newStart, rangeStartDay]);
                                        const effectiveEnd = min([newEnd, startOfDay(rangeEnd)]);
                                        if (effectiveStart > effectiveEnd) return null;

                                        const offsetDays = differenceInDays(effectiveStart, rangeStartDay);
                                        const durationDays = differenceInDays(effectiveEnd, effectiveStart) + 1;
                                        const leftPercent = (offsetDays / totalDays) * 100;
                                        const widthPercent = (durationDays / totalDays) * 100;

                                        return (
                                            <div
                                                key={`${service.id}-resize-ghost`}
                                                className="absolute top-1 bottom-1 bg-abb-red/10 border-2 border-dashed border-abb-red z-[60] pointer-events-none rounded-lg shadow-xl flex items-center justify-center overflow-hidden transition-all duration-75"
                                                style={{ left: `calc(${leftPercent}% + 2px)`, width: `calc(${widthPercent}% - 4px)` }}
                                            >
                                                <span className="text-[10px] font-bold text-abb-red/80 truncate whitespace-nowrap px-1">
                                                    {service.client}
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {techServices.map(service => {
                                        try {
                                            const start = startOfDay(parseISO(service.startDate));
                                            const end = startOfDay(parseISO(service.endDate));
                                            const rangeStartDay = startOfDay(rangeStart);
                                            const offsetDays = differenceInDays(start, rangeStartDay);
                                            const duration = differenceInDays(end, start) + 1;

                                            if (offsetDays + duration < 0 || offsetDays > totalDays) return null;

                                            const leftPercent = (offsetDays / totalDays) * 100;
                                            const widthPercent = (duration / totalDays) * 100;

                                            const localLayout = layoutMap.get(service.id) || { lane: 0, totalLanes: 1 };

                                            let styleProps: { top: string; height: string; };

                                            if (localLayout.totalLanes === 1) {
                                                styleProps = {
                                                    top: '4px',
                                                    height: 'calc(100% - 8px)'
                                                };
                                            } else {
                                                const laneHeight = 32;
                                                const laneGap = 4;
                                                const top = localLayout.lane * (laneHeight + laneGap) + (laneGap / 2);
                                                styleProps = {
                                                    top: `${top}px`,
                                                    height: `${laneHeight}px`
                                                };
                                            }

                                            return renderServiceBar(service, {
                                                left: `calc(${leftPercent}% + 2px)`,
                                                width: `calc(${widthPercent}% - 4px)`,
                                                ...styleProps
                                            }, localLayout.totalLanes, tech.id);
                                        } catch (e) {
                                            return null;
                                        }
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
        return (
            <div className="h-full overflow-y-auto bg-slate-100 p-4 space-y-6">
                {months.map(monthStart => {
                    const monthEnd = endOfMonth(monthStart);
                    const daysInMonth = getDaysInMonth(monthStart);
                    const days = getDaysInRange(monthStart, monthEnd);

                    const weeksInMonth: { weekNumber: number; days: Date[] }[] = [];
                    if (days.length > 0) {
                        let currentWeek = getISOWeek(days[0]);
                        let weekDays: Date[] = [];
                        days.forEach(day => {
                            const isoWeek = getISOWeek(day);
                            if (isoWeek !== currentWeek) {
                                weeksInMonth.push({ weekNumber: currentWeek, days: weekDays });
                                currentWeek = isoWeek;
                                weekDays = [];
                            }
                            weekDays.push(day);
                        });
                        weeksInMonth.push({ weekNumber: currentWeek, days: weekDays });
                    }

                    return (
                        <div key={monthStart.toISOString()} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="flex border-b border-slate-200">
                                <div className="w-32 flex-shrink-0 bg-slate-100 flex flex-col items-center justify-center border-r border-slate-200 p-2">
                                    <span className="text-xl font-bold text-slate-700 uppercase">
                                        {format(monthStart, 'MMM', { locale: ptBR })}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-500">
                                        {format(monthStart, 'yyyy')}
                                    </span>
                                </div>

                                <div className="flex-grow flex flex-col bg-white">
                                    <div className="flex border-b border-slate-200">
                                        {weeksInMonth.map(({ weekNumber, days: weekDays }) => (
                                            <div
                                                key={`${weekNumber}-${weekDays[0].toISOString()}`}
                                                className="flex-grow flex items-center justify-center p-1 text-[9px] font-bold text-slate-500 bg-slate-100/50 border-r border-slate-200 last:border-r-0"
                                                style={{ flexBasis: 0, flexGrow: weekDays.length }}
                                            >
                                                <span>SEM {weekNumber}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex">
                                        {days.map((d) => {
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            return (
                                                <div key={d.getDate()} className={`flex-1 border-r border-slate-200 last:border-r-0 flex flex-col items-center justify-center h-10 min-w-[24px] ${isWeekend ? 'bg-abb-red text-white' : ''}`}>
                                                    <span className={`text-[8px] font-bold uppercase leading-none mb-0.5 ${isWeekend ? 'text-white/90' : 'text-slate-500'}`}>
                                                        {format(d, 'EEE', { locale: ptBR }).slice(0, 1)}
                                                    </span>
                                                    <span className={`text-sm font-bold leading-none ${isWeekend ? 'text-white' : 'text-slate-800'}`}>
                                                        {getDate(d)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div>
                                {technicians.map((tech) => {
                                    const isPJ = tech.type === TechType.PJ;
                                    const techServices = services.filter(s => {
                                        if (!s.technicianIds || !s.technicianIds.includes(tech.id)) return false;
                                        if (!s.startDate || !s.endDate) return false;
                                        try {
                                            const sStart = parseISO(s.startDate);
                                            const sEnd = parseISO(s.endDate);
                                            return sStart <= monthEnd && sEnd >= monthStart;
                                        } catch { return false; }
                                    });

                                    const layoutMap = getTechServiceLayout(tech.id, techServices);
                                    let maxLanesForMonth = 1;
                                    layoutMap.forEach(info => {
                                        if (info.totalLanes > maxLanesForMonth) maxLanesForMonth = info.totalLanes;
                                    });

                                    const rowHeight = Math.max(48, maxLanesForMonth * 30 + 4);

                                    return (
                                        <div key={tech.id} className={`flex border-b border-slate-200 last:border-b-0 ${isPJ ? 'bg-amber-50/20' : 'bg-white'}`} style={{ height: `${rowHeight}px` }}>
                                            <div className={`w-32 flex-shrink-0 border-r border-slate-200 flex items-center px-2 gap-2 ${isPJ ? 'bg-amber-50/50' : 'bg-slate-50/70'}`}>
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border ${tech.color} border-black/5`}>
                                                    {tech.name}
                                                </div>
                                                {isPJ && <span className="text-[9px] font-bold text-amber-600 uppercase">PJ</span>}
                                            </div>

                                            <div className="flex-grow relative group hover:bg-abb-red/5">
                                                <div className="absolute inset-0 flex pointer-events-none z-0">
                                                    {days.map((d, i) => {
                                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                        return (
                                                            <div key={i} className={`flex-1 border-r border-slate-100 h-full ${isWeekend ? 'bg-red-50/80' : ''}`} />
                                                        );
                                                    })}
                                                </div>

                                                <div className="absolute inset-0 flex">
                                                    {days.map((d, i) => (
                                                        <div
                                                            key={i}
                                                            data-date={format(d, 'yyyy-MM-dd')}
                                                            className={`flex-1 h-full ${dragState ? 'z-40' : ''}`}
                                                            onDragOver={handleDragOver}
                                                            onDragEnter={(e) => handleDragEnter(e, tech.id, d)}
                                                            onDrop={(e) => handleDrop(e, tech.id, d)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    ))}
                                                </div>

                                                {renderGhostBar(tech.id, monthStart, monthEnd, daysInMonth)}

                                                {/* Resize Ghost */}
                                                {resizeState && resizeState.techId === tech.id && resizeState.currentDate && (() => {
                                                    const service = resizeState.service;
                                                    const sStart = parseISO(service.startDate);
                                                    const sEnd = parseISO(service.endDate);
                                                    let newStart = sStart;
                                                    let newEnd = sEnd;

                                                    if (resizeState.edge === 'left') {
                                                        newStart = resizeState.currentDate;
                                                        if (newStart > newEnd) newStart = newEnd;
                                                    } else {
                                                        newEnd = resizeState.currentDate;
                                                        if (newEnd < newStart) newEnd = newStart;
                                                    }

                                                    const effectiveStart = max([newStart, monthStart]);
                                                    const effectiveEnd = min([newEnd, monthEnd]);
                                                    if (effectiveStart > effectiveEnd) return null;

                                                    const startDay = getDate(effectiveStart);
                                                    const duration = differenceInDays(effectiveEnd, effectiveStart) + 1;
                                                    const leftPercent = ((startDay - 1) / daysInMonth) * 100;
                                                    const widthPercent = (duration / daysInMonth) * 100;

                                                    return (
                                                        <div
                                                            key={`${service.id}-resize-ghost`}
                                                            className="absolute top-1 bottom-1 bg-abb-red/10 border-2 border-dashed border-abb-red z-[60] pointer-events-none rounded-lg shadow-xl flex items-center justify-center overflow-hidden transition-all duration-75"
                                                            style={{ left: `calc(${leftPercent}% + 1px)`, width: `calc(${widthPercent}% - 2px)` }}
                                                        >
                                                            <span className="text-[10px] font-bold text-abb-red/80 truncate whitespace-nowrap px-1">
                                                                {service.client}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}

                                                {techServices.map(service => {
                                                    try {
                                                        const sStart = parseISO(service.startDate);
                                                        const sEnd = parseISO(service.endDate);
                                                        const effectiveStart = max([sStart, monthStart]);
                                                        const effectiveEnd = min([sEnd, monthEnd]);
                                                        const startDay = getDate(effectiveStart);
                                                        const duration = differenceInDays(effectiveEnd, effectiveStart) + 1;
                                                        const leftPercent = ((startDay - 1) / daysInMonth) * 100;
                                                        const widthPercent = (duration / daysInMonth) * 100;
                                                        const continuesLeft = sStart < monthStart;
                                                        const continuesRight = sEnd > monthEnd;

                                                        const localLayout = layoutMap.get(service.id) || { lane: 0, totalLanes: 1 };

                                                        let styleProps: { top: string; height: string; };

                                                        if (localLayout.totalLanes === 1) {
                                                            styleProps = {
                                                                top: '2px',
                                                                height: 'calc(100% - 4px)'
                                                            };
                                                        } else {
                                                            const laneHeight = 26;
                                                            const laneGap = 4;
                                                            const top = localLayout.lane * (laneHeight + laneGap) + (laneGap / 2);
                                                            styleProps = {
                                                                top: `${top}px`,
                                                                height: `${laneHeight}px`
                                                            };
                                                        }

                                                        return renderServiceBar(service, {
                                                            left: `calc(${leftPercent}% + 1px)`,
                                                            width: `calc(${widthPercent}% - 2px)`,
                                                            ...styleProps
                                                        }, localLayout.totalLanes, tech.id, continuesLeft, continuesRight);
                                                    } catch (e) {
                                                        return null;
                                                    }
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="h-full w-full bg-white">
            {isYearView ? renderYearView() : renderStandardView()}
        </div>
    );
};