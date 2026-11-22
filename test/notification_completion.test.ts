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
  assert.equal(notificationDone(item({kind:'announcement',service_date:null}),Date.parse('2026-11-22T01:00:00Z')),false);
  assert.equal(notificationDone(item({completed_at:'2026-11-22T01:00:00Z'})),true);
});

test('announcements expire after exactly seven days unless completed earlier', () => {
  const announcement=item({kind:'announcement',service_date:null,created_at:'2026-11-22T00:00:00Z'});
  assert.equal(notificationDone(announcement,Date.parse('2026-11-28T23:59:59Z')),false);
  assert.equal(notificationDone(announcement,Date.parse('2026-11-29T00:00:00Z')),true);
  assert.equal(notificationDone({...announcement,completed_at:'2026-11-22T01:00:00Z'},Date.parse('2026-11-22T01:00:00Z')),true);
});

test('first song leader assignment invites rehearsal; presiders and reminders do not', () => {
  const now = new Date('2026-11-22T09:00:00+08:00');
  const copy = notificationCopy(item({kind:'assigned', title:'You’re on today’s setlist!',body:'You’re assigned as Worship Song Leader.'}),now);
  assert.equal(copy.body,'Worship Song Leader · Listen and rehearse.');
  assert.doesNotMatch(notificationCopy(item({kind:'practice',title:'Assignment reminder: Song Leader'}),now).body,/rehearse/);
  assert.doesNotMatch(notificationCopy(item({kind:'assigned',title:'New assignment: Presider'}),now).body,/rehearse/);
});

test('missing lyrics identifies the performer instead of requiring a song title', () => {
  const copy = notificationCopy(item({kind:'missing_lyrics',source_title:'Youth Choir'}),new Date('2026-11-22T09:00:00+08:00'));
  assert.deepEqual(copy,{title:'Lyrics needed',body:'Youth Choir’s song number lyrics needed. Nov 22, 2026.'});
});

test('birthday is one continuous greeting with the name marked for emphasis', () => {
  const copy=notificationCopy(item({kind:'birthday',source_title:'Sis Joy'}),new Date('2026-11-22T09:00:00+08:00'));
  assert.deepEqual(copy,{title:'It’s Sis Joy’s birthday today! Let’s greet them a blessed birthday!',body:'',emphasis:'Sis Joy'});
  const old=notificationCopy(item({kind:'birthday',source_title:'Sis Joy'}),new Date('2026-11-23T09:00:00+08:00'));
  assert.doesNotMatch(old.title,/today/,'an older birthday card never calls its past event today');
});
