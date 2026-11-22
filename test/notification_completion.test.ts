import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceCompleted, philippineDate } from '../src/utils/serviceCompletion.ts';
import { notificationCopy, notificationDone } from '../src/utils/notificationPresentation.ts';
import type { AssignmentNotification } from '../src/services/assignmentNotifications.ts';

test('service completion uses Philippine time at noon, 8 PM and 7 PM, including edited setlist titles', () => {
  for (const [title, type, hour] of [['Sunday Service','sunday',12], ['Custom prayer title','prayer_meeting',20], ['Song Leaders & Choir Practice','',19]] as const) {
    const cutoff = Date.parse(`2026-11-22T${hour}:00:00+08:00`);
    assert.equal(serviceCompleted('2026-11-22',title,cutoff-1,type),false);
    assert.equal(serviceCompleted('2026-11-22',title,cutoff,type),true);
  }
  assert.equal(philippineDate(Date.parse('2026-11-21T18:00:00Z')),'2026-11-22');
});

const item = (override: Partial<AssignmentNotification> = {}): AssignmentNotification => ({
  id:'one',user_id:'user',setlist_id:null,kind:'event',title:'Service reminder: Sunday Service',
  body:'Sunday Service is on November 22 at 10 AM.',service_date:'2026-11-22',read_at:null,
  created_at:'2026-11-21T00:00:00Z',source_title:'Sunday Service',...override,
});
test('relative notification copy removes duplicate event text and keeps the time', () => {
  assert.deepEqual(notificationCopy(item(),new Date('2026-11-22T09:00:00+08:00')), {title:'Sunday Service is today!',body:'10 AM'});
  assert.deepEqual(notificationCopy(item(),new Date('2026-11-21T09:00:00+08:00')), {title:'Sunday Service is tomorrow!',body:'10 AM'});
  assert.deepEqual(notificationCopy(item({kind:'assigned',title:'You’re on today’s setlist!',body:'You’re assigned as Presider.'}),new Date('2026-11-22T09:00:00+08:00')), {title:'You’re on today’s setlist!',body:'Presider'});
});
test('Done is distinct from read and keeps the card available after the event ends', () => {
  const unread=item();
  assert.equal(notificationDone(unread,Date.parse('2026-11-22T11:59:59+08:00')),false);
  assert.equal(notificationDone(unread,Date.parse('2026-11-22T12:00:00+08:00')),true);
  assert.equal(unread.read_at,null);
  assert.equal(notificationDone(item({kind:'announcement',service_date:null})),false);
  assert.equal(notificationDone(item({completed_at:'2026-11-22T01:00:00Z'})),true);
});
