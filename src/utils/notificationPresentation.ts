import type { AssignmentNotification } from '../services/assignmentNotifications';
import { philippineDate, serviceEnd } from './serviceCompletion.ts';

const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });

export function notificationDone(item: AssignmentNotification, now = Date.now()) {
  if (item.completed_at) return true;
  if (item.expires_at) return Date.parse(item.expires_at) <= now;
  if (item.kind === 'announcement') return Date.parse(item.created_at) + 7 * 86400000 <= now;
  if (!item.service_date || item.kind === 'missing_lyrics') return false;
  return serviceEnd(item.service_date, item.source_title || item.title) <= now;
}

export function notificationCopy(item: AssignmentNotification, now: Date): { title: string; body: string; emphasis?: string } {
  const eventDate = item.service_date;
  const today = eventDate === philippineDate(now);
  const tomorrow = eventDate === philippineDate(now.getTime() + 86400000);
  const parsed = eventDate ? new Date(eventDate + 'T12:00:00+08:00') : null;
  const date = parsed && Number.isFinite(parsed.getTime()) ? dateLabel.format(parsed) : '';
  const when = today ? 'today' : tomorrow ? 'tomorrow' : date ? 'on ' + date : '';
  const body = item.body.replace(/(?:^|(?<=[.!?\n]))\s*(?:tap|touch|click)(?: here)? to (?:view|see|open|check)(?: (?:the|your|this))? set\s*list[.!]?\s*$/i, '').trim();
  const role = /^(?:New assignment|Assignment updated|Assignment removed|Assignment reminder):\s*(.+)$/i.exec(item.title)?.[1]
    ?? /(?:assigned as|setlist as)\s+(.+?)(?:\s+(?:on|for)\s+|[.!]?$)/i.exec(body)?.[1]?.trim();
  if (item.kind === 'announcement') return { title: item.title, body };
  if (item.kind === 'assigned' || item.kind === 'practice') return {
    title: today ? 'You’re on today’s setlist!' : tomorrow ? 'You’re on tomorrow’s setlist!' : 'You’re on the setlist!',
    body: [role, today || tomorrow ? '' : date, item.kind === 'assigned' && /song leader/i.test(role || '') ? 'Listen and rehearse.' : ''].filter(Boolean).join(' · '),
  };
  if (item.kind === 'updated') return { title: 'Your service date changed', body: [role, when].filter(Boolean).join(' · ') };
  if (item.kind === 'removed') return { title: 'Your assignment was removed', body: when ? 'Setlist ' + when : '' };
  if (item.kind === 'backup_setlist') return { title: 'Setlist ready for practice', body: [when, 'Listen and rehearse'].filter(Boolean).join(' · ') };
  if (item.kind === 'missing_lyrics') return { title: 'Lyrics needed', body: `${item.source_title || 'The singer/group'}’s song number lyrics needed.${date ? ' ' + date + '.' : ''}` };

  const legacy = /^(?:Service reminder|Event reminder|Birthday reminder|Birthday today|Anniversary reminder|Recognition reminder):\s*(.+)$/i.exec(item.title)?.[1];
  const cleanTitle = item.title.replace(/ is (?:today|tomorrow)!?$/i, '').replace(/^It[’']s\s+/i, '').replace(/ today!?$/i, '');
  const name = item.source_title || legacy || cleanTitle;
  if (item.kind === 'event') {
    const time = /\bat (\d{1,2}(?::\d{2})?\s*[AP]M)[.!]?$/i.exec(body)?.[1];
    return {
      title: today || tomorrow ? name + ' is ' + (today ? 'today!' : 'tomorrow!') : name,
      body: [today || tomorrow ? '' : date, time].filter(Boolean).join(' · '),
    };
  }
  if (item.kind === 'birthday') {
    const birthdayName = name.replace(/[’']s birthday!?$/i, '');
    const birthdayWhen = today ? ' today' : tomorrow ? ' tomorrow' : date ? ' on ' + date : '';
    return { title: 'It’s ' + birthdayName + '’s birthday' + birthdayWhen + '! Let’s greet them a blessed birthday!', body: '', emphasis: birthdayName };
  }
  if (item.kind === 'anniversary') {
    const wedding = /Wedding anniversary/i.test(body);
    const title = wedding && !/wedding anniversary/i.test(name) ? name + '’s wedding anniversary' : name;
    const anniversaryWhen = today ? ' today' : tomorrow ? ' tomorrow' : date ? ' on ' + date : '';
    return { title: (wedding ? 'It’s ' : '') + title + (wedding ? anniversaryWhen : ' is' + anniversaryWhen) + '! ' + (wedding ? 'Let’s greet them a blessed wedding anniversary!' : 'Let’s give thanks together!'), body: '', emphasis: name };
  }
  if (item.kind === 'recognition') {
    const achievement = /\s—\s(.+) on .+\.$/.exec(body)?.[1] || /Let[’']s celebrate (.+)!$/i.exec(body)?.[1];
    return { title: /^Congratulations/i.test(name) ? name : 'Congratulations, ' + name + '!', body: achievement || '' };
  }
  return { title: item.title, body };
}

export function notificationPreview(copy: { title: string; body: string }) {
  let body = copy.body.replace(/\s+/g, ' ').trim();
  const title = copy.title.replace(/[.!]+$/, '').trim();
  if (body.toLowerCase().startsWith(title.toLowerCase())) body = body.slice(title.length).replace(/^[\s:—–.!-]+/, '');
  if (!body) return '';
  const chars = Array.from(body);
  if (chars.length <= 110) return body;
  const excerpt = chars.slice(0, 110).join('');
  const boundary = excerpt.lastIndexOf(' ');
  return (boundary > 80 ? excerpt.slice(0, boundary) : excerpt) + '…';
}
