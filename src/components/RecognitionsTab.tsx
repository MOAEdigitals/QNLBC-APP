import { isBirthdayRecognitionWeek } from '../utils/dateUtils';
import { isAnnualDatePast, orderAnnualBirthdays } from '../utils/recognitionOrder';
import { useBackLayer } from '../hooks/useBackLayer';
import { monthList } from './MonthSeparators';
import { BIRTHDAY_MONTH_COLORS } from '../utils/birthdayMonthColors';
import { useHeaderSearch } from './HeaderSearch';
import React, { useState, useEffect } from 'react';
import {
  RecognitionsSubTab,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialRecognitionType,
} from '../types';
import {
  formatDateStr,
  getCurrentRecognitionWindow,
  categorizeAnnualCelebrants,
  getTodayStr,
  getNextAnnualOccurrence,
  parseDate,
} from '../utils/dateUtils';
import { generateUUID } from '../services/supabaseData';
import {
  Cake,
  Heart,
  Award,
  Plus,
  Calendar,
  Sparkles,
  Trash2,
  Copy,
  MoreHorizontal,
  Pencil,
  X,
  Search,
  GraduationCap,
  Baby,
  BookmarkCheck,
} from 'lucide-react';



interface RecognitionsTabProps {
  birthdays: BirthdayCelebrant[];
  anniversaries: AnniversaryCelebrant[];
  visitors: Visitor[];
  specialRecognitions: SpecialRecognition[];
  onSaveBirthday: (item: BirthdayCelebrant) => Promise<boolean>;
  onDeleteBirthday: (id: string) => void;
  onSaveAnniversary: (item: AnniversaryCelebrant) => void;
  onDeleteAnniversary: (id: string) => void;
  onSaveVisitor: (item: Visitor) => void;
  onDeleteVisitor: (id: string) => void;
  onSaveSpecialRecognition: (item: SpecialRecognition) => void;
  onDeleteSpecialRecognition: (id: string) => void;
  collapseSignal?: number;
}

export const RecognitionsTab: React.FC<RecognitionsTabProps> = ({
  birthdays,
  anniversaries,
  specialRecognitions,
  onSaveBirthday,
  onDeleteBirthday,
  onSaveAnniversary,
  onDeleteAnniversary,
  onSaveSpecialRecognition,
  onDeleteSpecialRecognition,
  collapseSignal,
}) => {
  const lastProcessedSignalRef = React.useRef<number | undefined>(collapseSignal);
  const [subTab, setSubTab] = useState<RecognitionsSubTab>('birthdays');

  // Modal States
  const [isAddingBirthday, setIsAddingBirthday] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState<BirthdayCelebrant | null>(null);
  const [isAddingAnniversary, setIsAddingAnniversary] = useState(false);
  const [isAddingSpecial, setIsAddingSpecial] = useState(false);
  const [birthdayMenuId, setBirthdayMenuId] = useState<string | null>(null);

  // Collapse/dismiss modals on bottom-nav tap
  useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0 && collapseSignal !== lastProcessedSignalRef.current) {
      lastProcessedSignalRef.current = collapseSignal;
      const hasOpenLayer = !!birthdayMenuId || isAddingBirthday || isAddingAnniversary || isAddingSpecial;
      setBirthdayMenuId(null);
      setIsAddingBirthday(false);
      setIsAddingAnniversary(false);
      setIsAddingSpecial(false);
      if (!hasOpenLayer) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [collapseSignal, birthdayMenuId, isAddingBirthday, isAddingAnniversary, isAddingSpecial]);

  // Form states
  const [bdayForm, setBdayForm] = useState({
    name: '',
    birthDate: getTodayStr(),
    notes: '',
  });

  const [annivForm, setAnnivForm] = useState<{
    title: string;
    anniversaryDate: string;
    type: 'Wedding' | 'Church' | 'Ministry' | 'Other';
    yearsCount: string;
    notes: string;
  }>({
    title: '',
    anniversaryDate: getTodayStr(),
    type: 'Wedding',
    yearsCount: '',
    notes: '',
  });

  const [specialForm, setSpecialForm] = useState<{
    name: string;
    recognitionType: SpecialRecognitionType;
    customType: string;
    date: string;
    description: string;
  }>({
    name: '',
    recognitionType: 'Board Passer',
    customType: '',
    date: getTodayStr(),
    description: '',
  });

  useEffect(() => {
    if (!birthdayMenuId) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setBirthdayMenuId(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [birthdayMenuId]);

  const [birthdaySearchQuery, setBirthdaySearchQuery] = useState('');
  useHeaderSearch({ value: birthdaySearchQuery, onChange: setBirthdaySearchQuery, placeholder: `Search ${subTab}`, label: `Search ${subTab}` });
  const [isSavingBirthday, setIsSavingBirthday] = useState(false);
  const [birthdaySaveError, setBirthdaySaveError] = useState('');

  const { mondayStr, sundayStr } = getCurrentRecognitionWindow();

  // Categorize Birthdays & Anniversaries (Current Window: Last Monday through This Sunday, Upcoming below)
  const { currentWindow: currentBirthdays, upcoming: upcomingBirthdays } =
    categorizeAnnualCelebrants<BirthdayCelebrant>(birthdays, (b: BirthdayCelebrant) => b.birthDate);

  const visibleBirthdays = [...currentBirthdays, ...upcomingBirthdays];
  const birthdayToday = getTodayStr();
  const filteredBirthdays = orderAnnualBirthdays(visibleBirthdays, b => b.birthDate, birthdayToday).filter((b: BirthdayCelebrant) => {
    if (!birthdaySearchQuery.trim()) return true;
    const q = birthdaySearchQuery.trim().toLowerCase();
    return b.name.toLowerCase().includes(q);
  });

  const birthdayMonths = new Map<number, BirthdayCelebrant[]>();
  for (const item of filteredBirthdays) {
    const month = parseDate(item.birthDate).getMonth();
    const group = birthdayMonths.get(month) || [];
    group.push(item);
    birthdayMonths.set(month, group);
  }

  const { currentWindow: currentAnniversaries, upcoming: upcomingAnniversaries } =
    categorizeAnnualCelebrants<AnniversaryCelebrant>(anniversaries, (a: AnniversaryCelebrant) => a.anniversaryDate);
  const recognitionQuery = birthdaySearchQuery.trim().toLowerCase();
  const filteredAnniversaries = [...currentAnniversaries, ...upcomingAnniversaries].filter(item => !recognitionQuery || `${item.title} ${item.type}`.toLowerCase().includes(recognitionQuery));

  // Group Special Recognitions by Type
  const groupedSpecial: Record<string, SpecialRecognition[]> = {};
  for (const item of specialRecognitions.filter(item => !recognitionQuery || `${item.name} ${item.recognitionType} ${item.customType || ''} ${item.description || ''}`.toLowerCase().includes(recognitionQuery))) {
    const key = item.recognitionType === 'Custom' && item.customType ? item.customType : item.recognitionType;
    if (!groupedSpecial[key]) {
      groupedSpecial[key] = [];
    }
    groupedSpecial[key].push(item);
  }

  const handleAddBirthday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bdayForm.name.trim() || !bdayForm.birthDate || isSavingBirthday) return;
    setIsSavingBirthday(true);
    setBirthdaySaveError('');
    try {
      const saved = await onSaveBirthday({
        ...editingBirthday,
        id: editingBirthday?.id || generateUUID(),
        name: bdayForm.name.trim(),
        birthDate: `2000-${bdayForm.birthDate.slice(5)}`,
        notes: bdayForm.notes.trim() || undefined,
      });
      if (!saved) {
        setBirthdaySaveError('Birthday could not be saved. Please check your access and try again.');
        return;
      }
      setEditingBirthday(null);
      setBdayForm({ name: '', birthDate: getTodayStr(), notes: '' });
      setIsAddingBirthday(false);
    } catch (error) {
      setBirthdaySaveError(error instanceof Error ? error.message : 'Birthday could not be saved. Please try again.');
    } finally {
      setIsSavingBirthday(false);
    }
  };

  const handleAddAnniversary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annivForm.title.trim()) return;
    onSaveAnniversary({
      id: generateUUID(),
      title: annivForm.title.trim(),
      anniversaryDate: annivForm.anniversaryDate,
      type: annivForm.type,
      yearsCount: annivForm.yearsCount ? parseInt(annivForm.yearsCount, 10) : undefined,
      notes: annivForm.notes.trim() || undefined,
    });
    setAnnivForm({ title: '', anniversaryDate: getTodayStr(), type: 'Wedding', yearsCount: '', notes: '' });
    setIsAddingAnniversary(false);
  };

  const handleAddSpecial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialForm.name.trim()) return;
    onSaveSpecialRecognition({
      id: generateUUID(),
      name: specialForm.name.trim(),
      recognitionType: specialForm.recognitionType,
      customType: specialForm.customType.trim() || undefined,
      date: specialForm.date,
      description: specialForm.description.trim() || undefined,
    });
    setSpecialForm({ name: '', recognitionType: 'Board Passer', customType: '', date: getTodayStr(), description: '' });
    setIsAddingSpecial(false);
  };

  useBackLayer(isAddingBirthday || isAddingAnniversary || isAddingSpecial || !!birthdayMenuId, () => {
    if (isSavingBirthday) return;
    setBirthdayMenuId(null);
    setIsAddingBirthday(false); setIsAddingAnniversary(false); setIsAddingSpecial(false);
  });
  const isAnyModalOpen = isAddingBirthday || isAddingAnniversary || isAddingSpecial;

  return (
    <div className="ui-revamp ui-screen recognitions-screen space-y-5">
      {/* The selected section expands to show its label; the others remain one-tap icons. */}
      <div className="recognition-tabs flex gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
        {/* Birthdays */}
        <button
          type="button"
          aria-label="Birthdays"
          aria-pressed={subTab === 'birthdays'}
          title="Birthdays"
          onClick={() => setSubTab('birthdays')}
          className={`relative min-w-0 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${subTab === 'birthdays' ? 'flex-1' : 'w-11 shrink-0'} sm:flex-1 sm:w-auto ${
            subTab === 'birthdays'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Cake className="w-4 h-4 text-indigo-500" />
          <span className={`${subTab === 'birthdays' ? 'inline' : 'hidden'} sm:inline whitespace-nowrap`}>Birthdays</span>
        </button>

        <button
          type="button"
          aria-label="Special"
          aria-pressed={subTab === 'special'}
          title="Special"
          onClick={() => setSubTab('special')}
          className={`relative min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${subTab === 'special' ? 'flex-1' : 'w-11 shrink-0'} sm:flex-1 sm:w-auto ${
            subTab === 'special'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-4 h-4 text-sky-500" />
          <span className={`${subTab === 'special' ? 'inline' : 'hidden'} sm:inline whitespace-nowrap`}>Special</span>
        </button>

        <button
          type="button"
          aria-label="Anniversaries"
          aria-pressed={subTab === 'anniversaries'}
          title="Anniversaries"
          onClick={() => setSubTab('anniversaries')}
          className={`relative min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${subTab === 'anniversaries' ? 'flex-1' : 'w-11 shrink-0'} sm:flex-1 sm:w-auto ${
            subTab === 'anniversaries'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          <span className={`${subTab === 'anniversaries' ? 'inline' : 'hidden'} sm:inline whitespace-nowrap`}>Anniversaries</span>
        </button>

</div>

      {/* SUBTAB 1: BIRTHDAYS */}
      {subTab === 'birthdays' && (
        <div className="space-y-6">
          {/* Celebrants Section - Directly below search bar */}
          <div className="space-y-3">
            {filteredBirthdays.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                {birthdaySearchQuery
                  ? `No celebrants matching "${birthdaySearchQuery}".`
                  : 'No birthday celebrants recorded.'}
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(birthdayMonths, ([month, items]) => (
                  <section key={month} aria-labelledby={`birthday-month-${month}`} className="space-y-3">
                    <div className="flex items-center gap-3 px-1">
                      <h3 id={`birthday-month-${month}`} className={`shrink-0 text-sm font-bold ${BIRTHDAY_MONTH_COLORS[month].text}`}>
                        {new Date(2000, month, 1).toLocaleDateString('en-US', { month: 'long' })}
                      </h3>
                      <div aria-hidden="true" className={`h-px flex-1 ${BIRTHDAY_MONTH_COLORS[month].line}`} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          data-upcoming-card={isBirthdayRecognitionWeek(item.birthDate) ? 'recognition' : undefined}
                          data-past={isAnnualDatePast(item.birthDate, birthdayToday) && !isBirthdayRecognitionWeek(item.birthDate) || undefined}
                          className={`birthday-card p-3 rounded-2xl border shadow-xs flex items-center justify-between gap-2 ${BIRTHDAY_MONTH_COLORS[month].card}`}
                        >
                          <div className="flex min-w-0 flex-1 items-center space-x-3">
                            <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold text-sm shrink-0 shadow-xs ${BIRTHDAY_MONTH_COLORS[month].badge}`}>
                              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                                {parseDate(`${birthdayToday.slice(0, 4)}-${item.birthDate.slice(5)}`).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                              </span>
                              <span className="text-base font-black leading-none mt-0.5">{Number(item.birthDate.split('-')[2])}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 title={[item.name, item.ministryOrGroup].filter(Boolean).join(' · ')} className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="truncate">
                                {item.name}
                                </span>
                                {isBirthdayRecognitionWeek(item.birthDate) && <span className="birthday-sunday-dot" role="img" aria-label="Greet this coming Sunday" title="Greet this coming Sunday" />}
                              </h4>

                            </div>
                          </div>

                          <div className="relative shrink-0">
                            <button
                              type="button"
                              aria-label={`Actions for ${item.name}`}
                              aria-haspopup="menu"
                              aria-expanded={birthdayMenuId === item.id}
                              onClick={() => setBirthdayMenuId(birthdayMenuId === item.id ? null : item.id)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 cursor-pointer"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {birthdayMenuId === item.id && (
                              <>
                                <button type="button" aria-label="Close birthday actions" className="fixed inset-0 z-40 cursor-default" onClick={() => setBirthdayMenuId(null)} />
                                <div role="menu" aria-label={`${item.name} birthday actions`} className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg text-sm">
                                  <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={async () => {
                                    setBirthdayMenuId(null);
                                    try { await navigator.clipboard.writeText(`${item.name} — ${parseDate(item.birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`); }
                                    catch { window.alert('Unable to copy. Please try again.'); }
                                  }}><Copy className="w-4 h-4" />Copy</button>
                                  <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => {
                                    setBirthdayMenuId(null);
                                    setEditingBirthday(item);
                                    setBdayForm({ name: item.name, birthDate: `2000-${item.birthDate.slice(5)}`, notes: item.notes || '' });
                                    setBirthdaySaveError('');
                                    setIsAddingBirthday(true);
                                  }}><Pencil className="w-4 h-4" />Edit</button>
                                  <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => {
                                    setBirthdayMenuId(null);
                                    onDeleteBirthday(item.id);
                                  }}><Trash2 className="w-4 h-4" />Delete</button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: ANNIVERSARIES */}
      {subTab === 'anniversaries' && (
        <div className="space-y-6">
          {/* Upcoming Anniversaries Section */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Upcoming Anniversaries ({filteredAnniversaries.length})
            </span>

            {filteredAnniversaries.length === 0 ? (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                No upcoming anniversaries recorded.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {monthList(filteredAnniversaries, item => item.anniversaryDate, ['anniversary', 'anniversaries'], { annual: true }).render((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center font-bold shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{getNextAnnualOccurrence(item.anniversaryDate).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                        <span className="text-base font-black leading-none mt-0.5">{Number(item.anniversaryDate.split('-')[2])}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.type} {item.yearsCount ? `(${item.yearsCount} yrs)` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Remove ${item.title}?`)) onDeleteAnniversary(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: SPECIAL RECOGNITIONS */}
      {subTab === 'special' && (
        <div className="space-y-6">
          {Object.keys(groupedSpecial).length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No special recognitions added yet.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSpecial).map(([category, items]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <Award className="w-4 h-4 text-sky-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {category} ({items.length})
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {monthList(items, item => item.date, ['recognition', 'recognitions']).render((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-start justify-between"
                      >
                        <div className="space-y-1">
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</h5>
                          {item.customType && item.recognitionType !== 'Custom' && (
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 block">
                              {item.customType}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Date: {formatDateStr(item.date, { shortMonth: true })}
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (confirm(`Remove recognition for ${item.name}?`))
                              onDeleteSpecialRecognition(item.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD BIRTHDAY */}
      {isAddingBirthday && (
        <div role="dialog" aria-modal="true" className="ui-form-screen fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cake className="w-4 h-4 text-indigo-500" />
                <span>{editingBirthday ? 'Edit Birthday Celebrant' : 'Add Birthday Celebrant'}</span>
              </h3>
              <button onClick={() => setIsAddingBirthday(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBirthday} autoComplete="off" data-form-type="other" className="ui-modal-form">
              <div className="ui-form-body">
              {birthdaySaveError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {birthdaySaveError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  id="bday-celebrant-name"
                  name="bday_celebrant_name"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  required
                  value={bdayForm.name}
                  onChange={(e) => setBdayForm({ ...bdayForm, name: e.target.value })}
                  placeholder="Enter celebrant's name"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Birthday (Month and Day) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select aria-label="Birthday month" required value={bdayForm.birthDate.slice(5,7)} onChange={e => {
                    const month = e.target.value;
                    const day = Math.min(Number(bdayForm.birthDate.slice(8)), new Date(2000, Number(month), 0).getDate());
                    setBdayForm({ ...bdayForm, birthDate: `2000-${month}-${String(day).padStart(2, '0')}` });
                  }} className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-sm">
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{new Date(2000,i,1).toLocaleDateString('en-US',{month:'long'})}</option>)}
                  </select>
                  <select aria-label="Birthday day" required value={bdayForm.birthDate.slice(8)} onChange={e => setBdayForm({ ...bdayForm, birthDate: `2000-${bdayForm.birthDate.slice(5,7)}-${e.target.value}` })} className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-sm">
                    {Array.from({ length: new Date(2000, Number(bdayForm.birthDate.slice(5,7)), 0).getDate() }, (_, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{i+1}</option>)}
                  </select>
                </div>
              </div>

              </div>
              <div className="ui-form-actions flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setBirthdaySaveError('');
                    setIsAddingBirthday(false);
                  }}
                  disabled={isSavingBirthday}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBirthday}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingBirthday ? 'Saving...' : 'Save Celebrant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ANNIVERSARY */}
      {isAddingAnniversary && (
        <div role="dialog" aria-modal="true" className="ui-form-screen fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Add Anniversary Entry</span>
              </h3>
              <button onClick={() => setIsAddingAnniversary(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAnniversary} autoComplete="off" data-form-type="other" className="ui-modal-form">
              <div className="ui-form-body">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Couple / Event / Ministry Title *
                </label>
                <input
                  id="anniv-entry-title"
                  name="anniv_entry_title"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  required
                  value={annivForm.title}
                  onChange={(e) => setAnnivForm({ ...annivForm, title: e.target.value })}
                  placeholder="Enter couple or ministry name"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    id="anniv-event-date"
                    name="anniv_event_date"
                    type="date"
                    required
                    value={annivForm.anniversaryDate}
                    onChange={(e) => setAnnivForm({ ...annivForm, anniversaryDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={annivForm.type}
                    onChange={(e) => setAnnivForm({ ...annivForm, type: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Wedding">Wedding Anniversary</option>
                    <option value="Church">Church Founding</option>
                    <option value="Ministry">Ministry Milestone</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Years Count (Optional)
                </label>
                <input
                  id="anniv-years-count"
                  name="anniv_years_count"
                  type="number"
                  min={1}
                  max={150}
                  value={annivForm.yearsCount}
                  onChange={(e) => setAnnivForm({ ...annivForm, yearsCount: e.target.value })}
                  placeholder="Enter years"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>



              </div>
              <div className="ui-form-actions flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingAnniversary(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD SPECIAL RECOGNITION */}
      {isAddingSpecial && (
        <div role="dialog" aria-modal="true" className="ui-form-screen fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-500" />
                <span>Add Special Recognition</span>
              </h3>
              <button onClick={() => setIsAddingSpecial(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSpecial} autoComplete="off" data-form-type="other" className="ui-modal-form">
              <div className="ui-form-body">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Name / Honoree *
                </label>
                <input
                  id="special-honoree-name"
                  name="special_honoree_name"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  required
                  value={specialForm.name}
                  onChange={(e) => setSpecialForm({ ...specialForm, name: e.target.value })}
                  placeholder="Enter recipient's name"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Recognition Type *
                </label>
                <select
                  value={specialForm.recognitionType}
                  onChange={(e) =>
                    setSpecialForm({ ...specialForm, recognitionType: e.target.value as SpecialRecognitionType })
                  }
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="Board Passer">Board Passer</option>
                  <option value="Newly Graduated">Newly Graduated</option>
                  <option value="Newly Baptized">Newly Baptized</option>
                  <option value="Newlywed">Newlywed</option>
                  <option value="Baby Dedication">Baby Dedication</option>
                  <option value="Custom">Custom Recognition Type</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {specialForm.recognitionType === 'Board Passer'
                    ? 'Exam / License Name'
                    : specialForm.recognitionType === 'Newly Graduated'
                    ? 'Degree / Course & Honors'
                    : 'Specific Title / Subtitle'}
                </label>
                <input
                  id="special-custom-title"
                  name="special_custom_title"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  value={specialForm.customType}
                  onChange={(e) => setSpecialForm({ ...specialForm, customType: e.target.value })}
                  placeholder="Enter title, degree, or license details"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Recognition Date
                </label>
                <input
                  id="special-event-date"
                  name="special_event_date"
                  type="date"
                  required
                  value={specialForm.date}
                  onChange={(e) => setSpecialForm({ ...specialForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Description / Details (Optional)
                </label>
                <textarea
                  id="special-recognition-details"
                  name="special_recognition_details"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  rows={2}
                  value={specialForm.description}
                  onChange={(e) => setSpecialForm({ ...specialForm, description: e.target.value })}
                  placeholder="Enter recognition details and remarks"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              </div>
              <div className="ui-form-actions flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingSpecial(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                >
                  Save Recognition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) for Add Celebrant / Anniversary / Special */}
      {!isAnyModalOpen && (
        <button
          type="button"
          onClick={() => {
            if (subTab === 'birthdays') {
              setEditingBirthday(null);
              setBdayForm({ name: '', birthDate: getTodayStr(), notes: '' });
              setBirthdaySaveError('');
              setIsAddingBirthday(true);
            }
            else if (subTab === 'anniversaries') setIsAddingAnniversary(true);
            else if (subTab === 'special') setIsAddingSpecial(true);
          }}
          aria-label={
            subTab === 'birthdays'
              ? 'Add Celebrant'
              : subTab === 'anniversaries'
              ? 'Add Anniversary'
              : 'Add Recognition'
          }
          title={
            subTab === 'birthdays'
              ? 'Add Celebrant'
              : subTab === 'anniversaries'
              ? 'Add Anniversary'
              : 'Add Recognition'
          }
          className="app-fab fixed bottom-20 sm:bottom-22 right-4 sm:right-6 md:right-8 z-30 w-14 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/30 dark:shadow-black/50 border border-slate-700/20 dark:border-slate-200/30 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:ring-offset-2"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}
    </div>
  );
};
