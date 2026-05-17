/**
 * Cloud project sync for FrameStudio
 *
 * Uploads/downloads project data (metadata + clips JSON) to the server.
 * Requires authentication via lib/auth.ts.
 */

import Constants from 'expo-constants';
import { getAuthState } from './auth';
import { getProjects, getClips, Project, Clip } from './database';
import { useToastStore } from './toast';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  error?: string;
}

interface CloudProject {
  id: string;
  project: Project;
  clips: Clip[];
  updatedAt: number;
}

/** Upload a single project to cloud */
async function uploadProject(project: Project, clips: Clip[]): Promise<boolean> {
  const { user, isAuthenticated } = getAuthState();
  if (!isAuthenticated || !user) return false;

  try {
    const payload: CloudProject = {
      id: project.id,
      project,
      clips,
      updatedAt: Date.now(),
    };

    const res = await fetch(`${API_URL}/api/sync/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/** Download all projects from cloud */
async function downloadProjects(): Promise<CloudProject[]> {
  const { user, isAuthenticated } = getAuthState();
  if (!isAuthenticated || !user) return [];

  try {
    const res = await fetch(`${API_URL}/api/sync/projects`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.projects || [];
  } catch {
    return [];
  }
}

/** Full sync: upload local projects, download cloud projects */
export async function syncProjects(): Promise<SyncResult> {
  const { isAuthenticated } = getAuthState();
  if (!isAuthenticated) {
    return { success: false, uploaded: 0, downloaded: 0, error: 'Not authenticated' };
  }

  const toast = useToastStore.getState();
  toast.show('Syncing...', 'info', 3000);

  try {
    // Upload all local projects
    const localProjects = await getProjects();
    let uploaded = 0;

    for (const proj of localProjects) {
      const clips = await getClips(proj.id);
      const ok = await uploadProject(proj, clips);
      if (ok) uploaded++;
    }

    // Download cloud projects
    const cloudProjects = await downloadProjects();
    const downloaded = cloudProjects.length;

    toast.show(
      `Synced: ${uploaded} up, ${downloaded} down`,
      'success',
      2500
    );

    return { success: true, uploaded, downloaded };
  } catch (e: any) {
    toast.show('Sync failed', 'error', 2500);
    return { success: false, uploaded: 0, downloaded: 0, error: e?.message };
  }
}

/** Check sync status */
export function canSync(): boolean {
  const { isAuthenticated } = getAuthState();
  return isAuthenticated;
}
