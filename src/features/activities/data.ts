import { supabase } from '../../supabase';
import type { ChurchActivity } from '../../types';

type ActivityRow = {
  id: string;
  title: string;
  activity_date: string;
  activity_time: string | null;
  description: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

function fromRow(row: ActivityRow): ChurchActivity {
  return {
    id: row.id,
    title: row.title,
    activityDate: row.activity_date,
    activityTime: row.activity_time,
    description: row.description,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchActivities(): Promise<ChurchActivity[]> {
  const { data, error } = await supabase
    .from('church_activities')
    .select('*')
    .order('activity_date')
    .order('activity_time', { nullsFirst: true });
  if (error) throw error;
  return ((data || []) as ActivityRow[]).map(fromRow);
}

export async function saveActivity(activity: ChurchActivity, isNew: boolean): Promise<ChurchActivity> {
  const payload = {
    id: activity.id,
    title: activity.title.trim(),
    activity_date: activity.activityDate,
    activity_time: activity.activityTime || null,
    description: activity.description?.trim() || null,
  };
  const query = isNew
    ? supabase.from('church_activities').insert(payload)
    : supabase
        .from('church_activities')
        .update(payload)
        .eq('id', activity.id)
        .eq('revision', activity.revision || 1);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return fromRow(data as ActivityRow);
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('church_activities').delete().eq('id', id);
  if (error) throw error;
}
