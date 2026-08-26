import React, { useState } from 'react';
import {
  RecognitionsSubTab,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  VisitorTier,
  SpecialRecognitionType,
} from '../types';
import {
  formatDateStr,
  formatShortDate,
  getCurrentRecognitionWindow,
  categorizeAnnualCelebrants,
  getTodayStr,
  parseDate,
} from '../utils/dateUtils';
import {
  Cake,
  Heart,
  Users,
  Award,
  Plus,
  Calendar,
  MapPin,
  Sparkles,
  Trash2,
  X,
  Search,
  CheckCircle2,
  GraduationCap,
  Baby,
  BookmarkCheck,
} from 'lucide-react';

interface RecognitionsTabProps {
  birthdays: BirthdayCelebrant[];
  anniversaries: AnniversaryCelebrant[];
  visitors: Visitor[];
  specialRecognitions: SpecialRecognition[];
  onSaveBirthday: (item: BirthdayCelebrant) => void;
  onDeleteBirthday: (id: string) => void;
  onSaveAnniversary: (item: AnniversaryCelebrant) => void;
  onDeleteAnniversary: (id: string) => void;
  onSaveVisitor: (item: Visitor) => void;
  onDeleteVisitor: (id: string) => void;
  onSaveSpecialRecognition: (item: SpecialRecognition) => void;
  onDeleteSpecialRecognition: (id: string) => void;
}

export const RecognitionsTab: React.FC<RecognitionsTabProps> = ({
  birthdays,
  anniversaries,
  visitors,
  specialRecognitions,
  onSaveBirthday,
  onDeleteBirthday,
  onSaveAnniversary,
  onDeleteAnniversary,
  onSaveVisitor,
  onDeleteVisitor,
  onSaveSpecialRecognition,
  onDeleteSpecialRecognition,
}) => {
  const [subTab, setSubTab] = useState<RecognitionsSubTab>('birthdays');

  // Modal States
  const [isAddingBirthday, setIsAddingBirthday] = useState(false);
  const [isAddingAnniversary, setIsAddingAnniversary] = useState(false);
  const [isAddingVisitor, setIsAddingVisitor] = useState(false);
  const [isAddingSpecial, setIsAddingSpecial] = useState(false);

  // Form states
  const [bdayForm, setBdayForm] = useState({
    name: '',
    birthDate: getTodayStr(),
    ministryOrGroup: '',
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

  const [visitorForm, setVisitorForm] = useState<{
    name: string;
    barangay: string;
    tier: VisitorTier;
    dateVisited: string;
    notes: string;
  }>({
    name: '',
    barangay: '',
    tier: '1st timer',
    dateVisited: getTodayStr(),
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

  const [searchQuery, setSearchQuery] = useState('');

  const { mondayStr, sundayStr } = getCurrentRecognitionWindow();

  // Categorize Birthdays & Anniversaries (Current Window: Last Monday through This Sunday, Upcoming below)
  const { currentWindow: currentBirthdays, upcoming: upcomingBirthdays } =
    categorizeAnnualCelebrants<BirthdayCelebrant>(birthdays, (b: BirthdayCelebrant) => b.birthDate);

  const { currentWindow: currentAnniversaries, upcoming: upcomingAnniversaries } =
    categorizeAnnualCelebrants<AnniversaryCelebrant>(anniversaries, (a: AnniversaryCelebrant) => a.anniversaryDate);

  // Filter visitors
  const filteredVisitors = visitors.filter((v: Visitor) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.barangay.toLowerCase().includes(q) || v.tier.toLowerCase().includes(q);
  });

  // Group Special Recognitions by Type
  const groupedSpecial: Record<string, SpecialRecognition[]> = {};
  for (const item of specialRecognitions) {
    const key = item.recognitionType === 'Custom' && item.customType ? item.customType : item.recognitionType;
    if (!groupedSpecial[key]) {
      groupedSpecial[key] = [];
    }
    groupedSpecial[key].push(item);
  }

  // Tier style helper
  const getTierBadge = (tier: VisitorTier) => {
    switch (tier) {
      case '1st timer':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
            ★ 1st Timer
          </span>
        );
      case '2nd timer':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            2nd Timer
          </span>
        );
      case '3rd timer':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
            3rd Timer
          </span>
        );
      case 'Regular attender':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            Regular Attender
          </span>
        );
    }
  };

  const handleAddBirthday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bdayForm.name.trim()) return;
    onSaveBirthday({
      id: `bday-${Date.now()}`,
      name: bdayForm.name.trim(),
      birthDate: bdayForm.birthDate,
      ministryOrGroup: bdayForm.ministryOrGroup.trim() || undefined,
      notes: bdayForm.notes.trim() || undefined,
    });
    setBdayForm({ name: '', birthDate: getTodayStr(), ministryOrGroup: '', notes: '' });
    setIsAddingBirthday(false);
  };

  const handleAddAnniversary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annivForm.title.trim()) return;
    onSaveAnniversary({
      id: `anniv-${Date.now()}`,
      title: annivForm.title.trim(),
      anniversaryDate: annivForm.anniversaryDate,
      type: annivForm.type,
      yearsCount: annivForm.yearsCount ? parseInt(annivForm.yearsCount, 10) : undefined,
      notes: annivForm.notes.trim() || undefined,
    });
    setAnnivForm({ title: '', anniversaryDate: getTodayStr(), type: 'Wedding', yearsCount: '', notes: '' });
    setIsAddingAnniversary(false);
  };

  const handleAddVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorForm.name.trim()) return;
    onSaveVisitor({
      id: `vis-${Date.now()}`,
      name: visitorForm.name.trim(),
      barangay: visitorForm.barangay.trim() || 'Quezon, Nueva Ecija',
      tier: visitorForm.tier,
      dateVisited: visitorForm.dateVisited,
      notes: visitorForm.notes.trim() || undefined,
    });
    setVisitorForm({ name: '', barangay: '', tier: '1st timer', dateVisited: getTodayStr(), notes: '' });
    setIsAddingVisitor(false);
  };

  const handleAddSpecial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialForm.name.trim()) return;
    onSaveSpecialRecognition({
      id: `spec-${Date.now()}`,
      name: specialForm.name.trim(),
      recognitionType: specialForm.recognitionType,
      customType: specialForm.customType.trim() || undefined,
      date: specialForm.date,
      description: specialForm.description.trim() || undefined,
    });
    setSpecialForm({ name: '', recognitionType: 'Board Passer', customType: '', date: getTodayStr(), description: '' });
    setIsAddingSpecial(false);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setSubTab('birthdays')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            subTab === 'birthdays'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Cake className="w-4 h-4" />
          <span>Birthdays</span>
          {currentBirthdays.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
              {currentBirthdays.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('anniversaries')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            subTab === 'anniversaries'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Anniversaries</span>
          {currentAnniversaries.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
              {currentAnniversaries.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('visitors')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            subTab === 'visitors'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Visitors</span>
        </button>

        <button
          onClick={() => setSubTab('special')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            subTab === 'special'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Special</span>
        </button>
      </div>

      {/* SUBTAB 1: BIRTHDAYS */}
      {subTab === 'birthdays' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Birthday Celebrants</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current recognition window (Last Mon {formatShortDate(mondayStr)} – This Sun {formatShortDate(sundayStr)})
              </p>
            </div>
            <button
              onClick={() => setIsAddingBirthday(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Celebrant</span>
            </button>
          </div>

          {/* Current Recognition Window Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                This Week's Celebrants ({currentBirthdays.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Mon {formatShortDate(mondayStr)} – Sun {formatShortDate(sundayStr)}
              </span>
            </div>

            {currentBirthdays.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                No birthday celebrants for this week's recognition window.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentBirthdays.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 shadow-xs flex items-start justify-between"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        <Cake className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </h4>
                        <div className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold mt-0.5">
                          {formatDateStr(item.birthDate, { showDayOfWeek: true })}
                        </div>
                        {item.ministryOrGroup && (
                          <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 font-medium">
                            {item.ministryOrGroup}
                          </span>
                        )}
                        {item.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Remove ${item.name}?`)) onDeleteBirthday(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Weeks Section */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Upcoming Celebrants ({upcomingBirthdays.length})
            </span>

            {upcomingBirthdays.length === 0 ? (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                No upcoming birthdays recorded.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingBirthdays.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {formatShortDate(item.birthDate)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          {item.ministryOrGroup || 'NLBC Member'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Remove ${item.name}?`)) onDeleteBirthday(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
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

      {/* SUBTAB 2: ANNIVERSARIES */}
      {subTab === 'anniversaries' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Anniversaries</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Wedding anniversaries, church milestones, & ministry milestones
              </p>
            </div>
            <button
              onClick={() => setIsAddingAnniversary(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Anniversary</span>
            </button>
          </div>

          {/* Current Window */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5 px-1">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              This Week's Anniversaries ({currentAnniversaries.length})
            </span>

            {currentAnniversaries.length === 0 ? (
              <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 text-center text-xs text-slate-500">
                No anniversaries this week.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentAnniversaries.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 shadow-sm flex items-start justify-between"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        <Heart className="w-5 h-5 fill-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold mt-0.5">
                          {formatDateStr(item.anniversaryDate, { showDayOfWeek: true })}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 font-medium">
                            {item.type}
                          </span>
                          {item.yearsCount && (
                            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                              {item.yearsCount} Years
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Remove ${item.title}?`)) onDeleteAnniversary(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Anniversaries */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Upcoming Anniversaries ({upcomingAnniversaries.length})
            </span>

            {upcomingAnniversaries.length === 0 ? (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                No upcoming anniversaries recorded.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingAnniversaries.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {formatShortDate(item.anniversaryDate)}
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
                      className="p-1.5 text-slate-400 hover:text-rose-600"
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

      {/* SUBTAB 3: VISITORS */}
      {subTab === 'visitors' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Church Visitors Log</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1st Timer, 2nd Timer, 3rd Timer, and Regular Attender records
              </p>
            </div>
            <button
              onClick={() => setIsAddingVisitor(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Visitor</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor by name, barangay, or tier..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {filteredVisitors.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No visitors recorded yet. Click "Add Visitor" to log first-time attendees!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredVisitors.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</h4>
                      {getTierBadge(item.tier)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {item.barangay}
                      </span>
                      <span>•</span>
                      <span>Visited: {formatDateStr(item.dateVisited, { shortMonth: true })}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Remove visitor entry for ${item.name}?`)) onDeleteVisitor(item.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: SPECIAL RECOGNITIONS */}
      {subTab === 'special' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Special Recognitions</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Board Passers, Graduates, Baptisms, Newlyweds, and Milestone recognitions
              </p>
            </div>
            <button
              onClick={() => setIsAddingSpecial(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recognition</span>
            </button>
          </div>

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
                    {items.map((item) => (
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cake className="w-4 h-4 text-indigo-500" />
                <span>Add Birthday Celebrant</span>
              </h3>
              <button onClick={() => setIsAddingBirthday(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBirthday} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={bdayForm.name}
                  onChange={(e) => setBdayForm({ ...bdayForm, name: e.target.value })}
                  placeholder="Enter celebrant's name"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Birthdate (Calendar Picker) *
                </label>
                <input
                  type="date"
                  required
                  value={bdayForm.birthDate}
                  onChange={(e) => setBdayForm({ ...bdayForm, birthDate: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Ministry / Group (Optional)
                </label>
                <input
                  type="text"
                  value={bdayForm.ministryOrGroup}
                  onChange={(e) => setBdayForm({ ...bdayForm, ministryOrGroup: e.target.value })}
                  placeholder="Enter ministry or group"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Greeting (Optional)
                </label>
                <textarea
                  rows={2}
                  value={bdayForm.notes}
                  onChange={(e) => setBdayForm({ ...bdayForm, notes: e.target.value })}
                  placeholder="Birthday greeting or notes..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingBirthday(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                >
                  Save Celebrant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ANNIVERSARY */}
      {isAddingAnniversary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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

            <form onSubmit={handleAddAnniversary} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Couple / Event / Ministry Title *
                </label>
                <input
                  type="text"
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
                  type="number"
                  min={1}
                  max={150}
                  value={annivForm.yearsCount}
                  onChange={(e) => setAnnivForm({ ...annivForm, yearsCount: e.target.value })}
                  placeholder="Enter years"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={annivForm.notes}
                  onChange={(e) => setAnnivForm({ ...annivForm, notes: e.target.value })}
                  placeholder="Anniversary description or notes"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
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

      {/* MODAL 3: ADD VISITOR */}
      {isAddingVisitor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Log Church Visitor</span>
              </h3>
              <button onClick={() => setIsAddingVisitor(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVisitor} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Visitor Name *
                </label>
                <input
                  type="text"
                  required
                  value={visitorForm.name}
                  onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })}
                  placeholder="Enter visitor's full name"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Barangay / Place of Origin *
                </label>
                <input
                  type="text"
                  required
                  value={visitorForm.barangay}
                  onChange={(e) => setVisitorForm({ ...visitorForm, barangay: e.target.value })}
                  placeholder="Barangay, town, or city of origin"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Visitor Tier (Tappable Option) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['1st timer', '2nd timer', '3rd timer', 'Regular attender'] as VisitorTier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setVisitorForm({ ...visitorForm, tier: t })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                        visitorForm.tier === t
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span>{t}</span>
                      {visitorForm.tier === t && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Date Visited
                </label>
                <input
                  type="date"
                  required
                  value={visitorForm.dateVisited}
                  onChange={(e) => setVisitorForm({ ...visitorForm, dateVisited: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Invited By (Optional)
                </label>
                <input
                  type="text"
                  value={visitorForm.notes}
                  onChange={(e) => setVisitorForm({ ...visitorForm, notes: e.target.value })}
                  placeholder="Visitor notes and follow-up details"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingVisitor(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                >
                  Save Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD SPECIAL RECOGNITION */}
      {isAddingSpecial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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

            <form onSubmit={handleAddSpecial} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Name / Honoree *
                </label>
                <input
                  type="text"
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
                  type="text"
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
                  rows={2}
                  value={specialForm.description}
                  onChange={(e) => setSpecialForm({ ...specialForm, description: e.target.value })}
                  placeholder="Enter recognition details and remarks"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
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
    </div>
  );
};
