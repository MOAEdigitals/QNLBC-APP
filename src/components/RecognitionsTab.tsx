import { annualRecognitionYear, anniversaryStartingYear, anniversaryYears, isSpecialRecognitionWeek, partitionSpecialRecognitions } from '../utils/recognitionDetails';
import { BirthdayDatePicker } from './BirthdayDatePicker';
import { SheetDateField } from './SheetDateField';
import { confirmAction, showAppMessage } from '../services/appDialogs';
import { SheetSelect } from './SheetSelect';
import { celebrationConfetti } from '../utils/celebrationConfetti';
import { useSwipeSubtabs } from './SwipeNavigation';
import { CardDate } from './CardDate';
import { isBirthdayRecognitionWeek, isAnniversaryRecognitionWeek } from '../utils/dateUtils';
import { isAnnualDatePast, orderBirthdayRecognitionMonths, groupBirthdayRecognitionMonths } from '../utils/recognitionOrder';
import { useBackLayer } from '../hooks/useBackLayer';
import { monthList } from './MonthSeparators';
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
  getTodayStr,
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
  onSaveAnniversary: (item: AnniversaryCelebrant) => Promise<boolean>;
  onDeleteAnniversary: (id: string) => void;
  onSaveVisitor: (item: Visitor) => void;
  onDeleteVisitor: (id: string) => void;
  onSaveSpecialRecognition: (item: SpecialRecognition) => Promise<boolean>;
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
  const [subTab, setSubTab] = useSwipeSubtabs<RecognitionsSubTab>('recognitions', 'birthdays');

  const [editingAnniversary, setEditingAnniversary] = useState<AnniversaryCelebrant | null>(null);
  const [editingSpecial, setEditingSpecial] = useState<SpecialRecognition | null>(null);
  const [savingRecognition, setSavingRecognition] = useState(false);
  const recognitionSaveLock = React.useRef(false);
  const [recognitionSaveError, setRecognitionSaveError] = useState('');

  useEffect(() => {
    const open = (event: Event) => { const tab=(event as CustomEvent).detail; if (['birthdays','anniversaries','special'].includes(tab)) setSubTab(tab); };
    const requested=window.history.state?.recognitionSubtab;
    if (['birthdays','anniversaries','special'].includes(requested)) setSubTab(requested);
    window.addEventListener('qnlbc-open-recognition',open);
    return () => window.removeEventListener('qnlbc-open-recognition',open);
  }, [setSubTab]);

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
    startingYear: string;
    notes: string;
  }>({
    title: '',
    anniversaryDate: getTodayStr(),
    type: 'Wedding',
    startingYear: '',
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
    const outside = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-birthday-actions]')?.getAttribute('data-birthday-actions') !== birthdayMenuId) setBirthdayMenuId(null);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('click', outside, true);
    window.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('click', outside, true); window.removeEventListener('keydown', close); };
  }, [birthdayMenuId]);

  const [birthdaySearchQuery, setBirthdaySearchQuery] = useState('');
  useHeaderSearch({ value: birthdaySearchQuery, onChange: setBirthdaySearchQuery, placeholder: `Search ${subTab}`, label: `Search ${subTab}` });
  const [isSavingBirthday, setIsSavingBirthday] = useState(false);
  const [birthdaySaveError, setBirthdaySaveError] = useState('');


  const birthdayToday = getTodayStr();
  const filteredBirthdays = orderBirthdayRecognitionMonths(birthdays.filter(b => b.birthDate), b => b.birthDate, birthdayToday).filter((b: BirthdayCelebrant) => {
    if (!birthdaySearchQuery.trim()) return true;
    const q = birthdaySearchQuery.trim().toLowerCase();
    return b.name.toLowerCase().includes(q);
  });

  const birthdayMonths = groupBirthdayRecognitionMonths(filteredBirthdays, b => b.birthDate, birthdayToday);

  const recognitionQuery = birthdaySearchQuery.trim().toLowerCase();
  const filteredAnniversaries = orderBirthdayRecognitionMonths(anniversaries.filter(a => a.anniversaryDate), a => a.anniversaryDate, birthdayToday).filter(item => !recognitionQuery || `${item.title} ${item.type} ${item.notes || ''}`.toLowerCase().includes(recognitionQuery));
  const anniversaryMonths = groupBirthdayRecognitionMonths(filteredAnniversaries, a => a.anniversaryDate, birthdayToday);
  const specialGroups = partitionSpecialRecognitions(specialRecognitions.filter(item => !recognitionQuery || `${item.name} ${item.recognitionType} ${item.customType || ''} ${item.description || ''}`.toLowerCase().includes(recognitionQuery)), item => item.date);

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

  const handleAddAnniversary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annivForm.title.trim() || recognitionSaveLock.current) return;
    const year = annivForm.startingYear ? Number(annivForm.startingYear) : undefined;
    const date = `${String(year || 2000).padStart(4,'0')}-${annivForm.anniversaryDate.slice(5)}`;
    const parsed = parseDate(date);
    if ((year && (year < 1 || year > new Date().getFullYear())) || parsed.getMonth()+1 !== Number(date.slice(5,7)) || parsed.getDate() !== Number(date.slice(8))) {
      setRecognitionSaveError('Check the starting year and date.'); return;
    }
    recognitionSaveLock.current = true; setSavingRecognition(true); setRecognitionSaveError('');
    try {
      const saved = await onSaveAnniversary({ ...editingAnniversary, id: editingAnniversary?.id || generateUUID(), title: annivForm.title.trim(), anniversaryDate: date, type: annivForm.type, yearsCount: year ? 0 : undefined, years_count: undefined, notes: annivForm.notes.trim() || undefined });
      if (!saved) { setRecognitionSaveError('Unable to save anniversary. Please try again.'); return; }
      setEditingAnniversary(null); setIsAddingAnniversary(false);
    } catch { setRecognitionSaveError('Unable to save anniversary. Please try again.'); }
    finally { recognitionSaveLock.current = false; setSavingRecognition(false); }
  };

  const handleAddSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialForm.name.trim() || (specialForm.recognitionType === 'Custom' && !specialForm.customType.trim()) || recognitionSaveLock.current) return;
    recognitionSaveLock.current = true; setSavingRecognition(true); setRecognitionSaveError('');
    try {
      const saved = await onSaveSpecialRecognition({ ...editingSpecial, id: editingSpecial?.id || generateUUID(), name: specialForm.name.trim(), recognitionType: specialForm.recognitionType, customType: specialForm.customType.trim() || undefined, date: specialForm.date, description: specialForm.description.trim() || undefined });
      if (!saved) { setRecognitionSaveError('Unable to save recognition. Please try again.'); return; }
      setEditingSpecial(null); setIsAddingSpecial(false);
    } catch { setRecognitionSaveError('Unable to save recognition. Please try again.'); }
    finally { recognitionSaveLock.current = false; setSavingRecognition(false); }
  };

  const recognitionActions = (key: string, name: string, copy: string, edit: () => void, remove: () => void) => (
    <div data-birthday-actions={key} className="relative shrink-0">
      <button type="button" aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={birthdayMenuId === key} onClick={() => setBirthdayMenuId(birthdayMenuId === key ? null : key)} className="p-1.5 text-slate-500 hover:text-indigo-600 cursor-pointer"><MoreHorizontal className="w-4 h-4" /></button>
      {birthdayMenuId === key && <div role="menu" aria-label={`${name} actions`} className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg text-sm">
        <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={async () => { setBirthdayMenuId(null); try { await navigator.clipboard.writeText(copy); } catch { void showAppMessage('Unable to copy. Please try again.'); } }}><Copy className="w-4 h-4" />Copy</button>
        <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setBirthdayMenuId(null); setRecognitionSaveError(''); edit(); }}><Pencil className="w-4 h-4" />Edit</button>
        <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950" onClick={async () => { setBirthdayMenuId(null); if (await confirmAction(`Remove ${name}?`)) remove(); }}><Trash2 className="w-4 h-4" />Delete</button>
      </div>}
    </div>
  );

  useBackLayer(isAddingBirthday || isAddingAnniversary || isAddingSpecial || !!birthdayMenuId, () => {
    if (isSavingBirthday || savingRecognition) return;
    if (birthdayMenuId) { setBirthdayMenuId(null); return; }
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
          className={`ui-category-pill relative min-w-0 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${subTab === 'birthdays' ? 'flex-1' : 'w-11 shrink-0'} sm:flex-1 sm:w-auto ${
            subTab === 'birthdays'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Cake className="w-4 h-4" />
          <span className={`${subTab === 'birthdays' ? 'inline' : 'hidden'} sm:inline whitespace-nowrap`}>Birthdays</span>
        </button>

        <button
          type="button"
          aria-label="Special"
          aria-pressed={subTab === 'special'}
          title="Special"
          onClick={() => setSubTab('special')}
          className={`ui-category-pill relative min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${subTab === 'special' ? 'flex-1' : 'w-11 shrink-0'} sm:flex-1 sm:w-auto ${
            subTab === 'special'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span className={`${subTab === 'special' ? 'inline' : 'hidden'} sm:inline whitespace-nowrap`}>Special</span>
        </button>

        <button
          type="button"
          aria-label="Anniversaries"
          aria-pressed={subTab === 'anniversaries'}
          title="Anniversaries"
          onClick={() => setSubTab('anniversaries')}
          className={`ui-category-pill relative min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${subTab === 'anniversaries' ? 'flex-1' : 'w-11 shrink-0'} sm:flex-1 sm:w-auto ${
            subTab === 'anniversaries'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
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
                {birthdayMonths.map(({ key, month, items }) => (
                  <section key={key} aria-labelledby={`birthday-month-${key}`} className="space-y-3">
                    <div className="flex items-center gap-3 px-1">
                      <h3 id={`birthday-month-${key}`} className="shrink-0 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {new Date(2000, month, 1).toLocaleDateString('en-US', { month: 'long' })}
                      </h3>
                      <div aria-hidden="true" className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          style={celebrationConfetti(item.id)}
                          data-birthday-celebrant={isBirthdayRecognitionWeek(item.birthDate) || undefined}
                          data-past={isAnnualDatePast(item.birthDate, birthdayToday) && !isBirthdayRecognitionWeek(item.birthDate) || undefined}
                          className="app-date-card birthday-card p-3 rounded-2xl border shadow-xs flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex min-w-0 flex-1 items-center space-x-3">
                            <CardDate date={`${birthdayToday.slice(0, 4)}-${item.birthDate.slice(5)}`} />
                            <div className="min-w-0 flex-1">
                              <h4 title={[item.name, item.ministryOrGroup].filter(Boolean).join(' · ')} className="app-card-title flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="truncate">
                                {item.name}
                                </span>
                                {isBirthdayRecognitionWeek(item.birthDate) && <span className="sr-only">Greet this coming Sunday</span>}
                              </h4>

                            </div>
                          </div>

                          <div data-birthday-actions={item.id} className="relative shrink-0">
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
                                <div role="menu" aria-label={`${item.name} birthday actions`} className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg text-sm">
                                  <button type="button" role="menuitem" className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={async () => {
                                    setBirthdayMenuId(null);
                                    try { await navigator.clipboard.writeText(`${item.name} — ${parseDate(item.birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`); }
                                    catch { void showAppMessage('Unable to copy. Please try again.'); }
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

      {subTab === 'anniversaries' && <div className="space-y-6">
        {!filteredAnniversaries.length && <p className="p-4 text-center text-xs text-slate-500">No anniversaries found.</p>}
        {anniversaryMonths.map(({key,month,items}) => <section key={key} className="space-y-3">
          <div className="flex items-center gap-3 px-1"><h3 className="shrink-0 text-sm font-bold text-slate-700 dark:text-slate-200">{new Date(2000,month,1).toLocaleDateString('en-US',{month:'long'})}</h3><div aria-hidden="true" className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{items.map(item => {
            const years = anniversaryYears(item, annualRecognitionYear(item.anniversaryDate));
            const detail = [item.type, years != null && years > 0 ? `${years} years` : null].filter(Boolean).join(' · ');
            return <div key={item.id} style={celebrationConfetti(item.id)} data-birthday-celebrant={isAnniversaryRecognitionWeek(item.anniversaryDate) || undefined} data-past={isAnnualDatePast(item.anniversaryDate,birthdayToday) && !isAnniversaryRecognitionWeek(item.anniversaryDate) || undefined} className="app-date-card birthday-card p-3 rounded-2xl border shadow-xs flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex min-w-0 flex-1 items-center gap-3"><CardDate date={`${annualRecognitionYear(item.anniversaryDate)}-${item.anniversaryDate.slice(5)}`} /><div className="min-w-0 flex-1"><h4 className="app-card-title text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4><p className="app-card-secondary text-xs text-slate-500 dark:text-slate-400">{detail}</p>{item.notes && <p className="app-card-secondary text-xs text-slate-500 dark:text-slate-400">{item.notes}</p>}</div></div>
              {recognitionActions(`anniversary:${item.id}`,item.title, [item.title,parseDate(item.anniversaryDate).toLocaleDateString('en-US',{month:'long',day:'numeric'}),detail,item.notes].filter(Boolean).join('\n'), () => {
                setEditingAnniversary(item); setAnnivForm({title:item.title, anniversaryDate:item.anniversaryDate,type:item.type,startingYear:String(anniversaryStartingYear(item) ?? ''),notes:item.notes || ''}); setIsAddingAnniversary(true);
              }, () => onDeleteAnniversary(item.id))}
            </div>;
          })}</div>
        </section>)}
      </div>}

      {subTab === 'special' && <div className="space-y-6">
        {!specialGroups.upcoming.length && !specialGroups.past.length && <p className="p-4 text-center text-xs text-slate-500">No special recognitions found.</p>}
        {[specialGroups.upcoming,specialGroups.past].map((items,index) => <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {monthList(items,item=>item.date,['recognition','recognitions']).render(item => <div key={item.id} style={celebrationConfetti(item.id)} data-birthday-celebrant={isSpecialRecognitionWeek(item.date) || undefined} data-past={index === 1 || undefined} className="app-date-card birthday-card p-3 rounded-2xl border shadow-xs flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex min-w-0 flex-1 items-center gap-3"><CardDate date={item.date} /><div className="min-w-0 flex-1 space-y-1"><h4 className="app-card-title text-sm font-bold text-slate-900 dark:text-white">{item.name}</h4><p className="app-card-secondary text-xs font-semibold text-indigo-600 dark:text-indigo-400">{item.recognitionType === 'Custom' ? item.customType : [item.recognitionType,item.customType].filter(Boolean).join(' · ')}</p>{item.description && <p className="app-card-secondary text-xs text-slate-500 dark:text-slate-400">{item.description}</p>}</div></div>
            {recognitionActions(`special:${item.id}`,item.name,[item.name,item.recognitionType === 'Custom' ? item.customType : item.recognitionType,item.recognitionType !== 'Custom' && item.customType,formatDateStr(item.date),item.description].filter(Boolean).join('\n'),() => {
              setEditingSpecial(item); setSpecialForm({name:item.name,recognitionType:item.recognitionType,customType:item.customType || '',date:item.date,description:item.description || ''}); setIsAddingSpecial(true);
            },()=>onDeleteSpecialRecognition(item.id))}
          </div>)}
        </div>)}
      </div>}

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
                  Birthday *
                </label>
                <BirthdayDatePicker value={bdayForm.birthDate} disabled={isSavingBirthday} onChange={birthDate => setBdayForm({ ...bdayForm, birthDate })} />
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
                <span>{editingAnniversary ? 'Edit Anniversary' : 'Add Anniversary'}</span>
              </h3>
              <button disabled={savingRecognition} aria-label="Close anniversary" onClick={() => setIsAddingAnniversary(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAnniversary} autoComplete="off" data-form-type="other" className="ui-modal-form">
              <fieldset disabled={savingRecognition} className="ui-form-body">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Couple / Event *
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
                  <BirthdayDatePicker label="Anniversary" disabled={savingRecognition} value={annivForm.anniversaryDate} onChange={value => setAnnivForm({...annivForm,anniversaryDate:value})} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <SheetSelect
                    value={annivForm.type}
                    onChange={(e) => setAnnivForm({ ...annivForm, type: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Wedding">Wedding Anniversary</option>
                    <option value="Church">Church Founding</option>
                    <option value="Ministry">Ministry Milestone</option>
                    <option value="Other">Other</option>
                  </SheetSelect>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Starting year (optional)
                </label>
                <input
                  id="anniv-years-count"
                  name="anniv_years_count"
                  type="number"
                  min={1}
                  max={new Date().getFullYear()}
                  value={annivForm.startingYear}
                  onChange={(e) => setAnnivForm({ ...annivForm, startingYear: e.target.value })}
                  placeholder="e.g. 2016"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Details<textarea value={annivForm.notes} onChange={e=>setAnnivForm({...annivForm,notes:e.target.value})} placeholder="Add details" className="mt-1 w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm" /></label>




              </fieldset>
              {recognitionSaveError && <p role="alert" className="px-5 text-sm text-rose-500">{recognitionSaveError}</p>}
              <div className="ui-form-actions flex justify-end gap-3 pt-3">
                <button
                  type="button" disabled={savingRecognition}
                  onClick={() => setIsAddingAnniversary(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={savingRecognition}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                >
                  {savingRecognition ? 'Saving…' : 'Save Anniversary'}
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
                <span>{editingSpecial ? 'Edit Recognition' : 'Add Recognition'}</span>
              </h3>
              <button disabled={savingRecognition} aria-label="Close recognition" onClick={() => setIsAddingSpecial(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSpecial} autoComplete="off" data-form-type="other" className="ui-modal-form">
              <fieldset disabled={savingRecognition} className="ui-form-body">
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
                <SheetSelect
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
                </SheetSelect>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {specialForm.recognitionType === 'Board Passer'
                    ? 'Exam / License'
                    : specialForm.recognitionType === 'Newly Graduated'
                    ? 'Degree / Honors'
                    : 'Title'}
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
                  required={specialForm.recognitionType === 'Custom'}
                  value={specialForm.customType}
                  onChange={(e) => setSpecialForm({ ...specialForm, customType: e.target.value })}
                  placeholder="Enter title"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Recognition Date
                </label>
                <SheetDateField
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
                  Details
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
                  placeholder="Add details"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              </fieldset>
              {recognitionSaveError && <p role="alert" className="px-5 text-sm text-rose-500">{recognitionSaveError}</p>}
              <div className="ui-form-actions flex justify-end gap-3 pt-3">
                <button
                  type="button" disabled={savingRecognition}
                  onClick={() => setIsAddingSpecial(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={savingRecognition}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                >
                  {savingRecognition ? 'Saving…' : 'Save Recognition'}
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
            else if (subTab === 'anniversaries') { setEditingAnniversary(null); setAnnivForm({title:'',anniversaryDate:getTodayStr(),type:'Wedding',startingYear:'',notes:''}); setRecognitionSaveError(''); setIsAddingAnniversary(true); }
            else if (subTab === 'special') { setEditingSpecial(null); setSpecialForm({name:'',recognitionType:'Board Passer',customType:'',date:getTodayStr(),description:''}); setRecognitionSaveError(''); setIsAddingSpecial(true); }
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
