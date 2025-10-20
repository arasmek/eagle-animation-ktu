import { access, copyFile, readdir, writeFile } from 'node:fs/promises';

import { app, shell } from 'electron';
import { mkdirp } from 'mkdirp';
import fetch from 'node-fetch';
import { homedir } from 'node:os';
import { join } from 'path-browserify';

import { getEncodingProfile } from '../common/ffmpeg';
import { CONTRIBUTE_REPOSITORY } from '../config';
import { flushCamera, getCamera, getCameras } from './cameras';
import { PROJECTS_PATH } from './config';
import { uploadFile } from './core/api';
import { exportProjectScene, exportSaveTemporaryBuffer, getSyncList, saveSyncList } from './core/export';
import { createProject, deleteProject, getProjectData, getProjectsList, projectSave, savePicture } from './core/projects';
import { getSettings, saveSettings } from './core/settings';
import { selectFile, selectFolder } from './core/utils';

console.log(`💾 Eagle Animation files will be saved in the following folder: ${PROJECTS_PATH}`);

const getPictureLink = (projectId, sceneIndex, filename) => `ea-data://${projectId}/${sceneIndex}/${filename}`;

const computeProject = (data) => {
  const copiedData = structuredClone(data);
  const scenes = copiedData.project.scenes.map((scene, i) => ({
    ...scene,
    pictures: scene.pictures.map((picture) => ({
      ...picture,
      link: getPictureLink(copiedData._id, i, picture.filename),
    })),
  }));

  let output = {
    ...copiedData,
    id: copiedData._id,
    project: {
      ...copiedData.project,
      scenes,
    },
    _path: undefined,
    _file: undefined,
  };

  delete output._path;
  delete output._file;

  return output;
};

const resolveQrSaveDirectory = async () => {
  const customPath = process.env.EA_QR_SAVE_DIR?.trim();
  if (customPath) {
    try {
      await mkdirp(customPath);
      return customPath;
    } catch (err) {
      console.warn('[SAVE_QR_IMAGE] Failed to use EA_QR_SAVE_DIR', { customPath, error: err?.message });
    }
  }

  const homeDir = process.env.USERPROFILE || homedir();
  const baseCandidates = new Set();

  const envOneDriveVars = [process.env.OneDriveCommercial, process.env.OneDriveConsumer, process.env.OneDrive];
  envOneDriveVars.filter(Boolean).forEach((value) => baseCandidates.add(value));
  baseCandidates.add(join(homeDir, 'OneDrive - Kaunas University of Technology'));
  baseCandidates.add(join(homeDir, 'OneDrive - Personal'));
  baseCandidates.add(join(homeDir, 'OneDrive'));

  try {
    const entries = await readdir(homeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.toLowerCase().startsWith('onedrive')) {
        baseCandidates.add(join(homeDir, entry.name));
      }
    }
  } catch (err) {
    console.warn('[SAVE_QR_IMAGE] Unable to scan home directory for OneDrive folders', err?.message);
  }

  for (const base of baseCandidates) {
    if (!base) continue;
    try {
      await access(base);
      const target = join(base, 'stopmotion');
      await mkdirp(target);
      return target;
    } catch (err) {
      // ignore and try the next candidate
    }
  }

  const fallback = join(homeDir, 'Desktop', 'stopmotion');
  await mkdirp(fallback);
  return fallback;
};

const actions = {
  SAVE_QR_IMAGE: async (evt, { dataUrl, exportBaseName }) => {
    try {
      if (!dataUrl || !exportBaseName) {
        throw new Error('Missing QR data');
      }

      const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl);
      if (!match) {
        throw new Error('Invalid QR data URL');
      }

      const targetDir = await resolveQrSaveDirectory();
      const filePath = join(targetDir, `${exportBaseName}.png`);
      console.log('[SAVE_QR_IMAGE] Writing QR to', filePath);
      const buffer = Buffer.from(match[1], 'base64');
      await writeFile(filePath, buffer);
      console.log('[SAVE_QR_IMAGE] Successfully wrote QR file', filePath);
      return { success: true, path: filePath };
    } catch (error) {
      console.error('SAVE_QR_IMAGE failed', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  },
  GET_LAST_VERSION: async () => {
    if (CONTRIBUTE_REPOSITORY) {
      const res = await fetch(`https://raw.githubusercontent.com/${CONTRIBUTE_REPOSITORY}/master/package.json`).then((res) => res.json());
      return { version: res?.version || null };
    }
    return { version: null };
  },
  GET_PROJECTS: async () => {
    const projects = await getProjectsList(PROJECTS_PATH);
    return projects.map(computeProject);
  },
  LIST_AUDIO_TRACKS: async () => {
    try {
      const { readdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { homedir } = await import('node:os');
      const desktopDir = join(homedir(), 'Desktop', 'audio');
      const resourcesBase = app?.isPackaged ? process.resourcesPath : join(process.cwd(), 'resources');
      const bundledDir = join(resourcesBase, 'audio');
      const dirs = [desktopDir, bundledDir];
      const found = [];
      for (const dir of dirs) {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && /\.(mp3|wav|ogg|m4a)$/i.test(entry.name)) {
              found.push([entry.name, dir]);
            }
          }
        } catch (_) {}
      }
      const seen = new Set();
      return found
        .filter(([name]) => (seen.has(name) ? false : (seen.add(name), true)))
        .map(([name]) => name);
    } catch (e) {
      return [];
    }
  },
  NEW_PROJECT: async (evt, { title }) => {
    const data = await createProject(PROJECTS_PATH, title);
    return computeProject(data);
  },
  GET_PROJECT: async (evt, { project_id }) => {
    const data = await getProjectData(join(PROJECTS_PATH, project_id));
    return computeProject(data);
  },
  DELETE_PROJECT: async (evt, { project_id }) => {
    await deleteProject(join(PROJECTS_PATH, project_id));
    return null;
  },
  SAVE_PROJECT: async (evt, { project_id, data = {} }) => {
    await projectSave(join(PROJECTS_PATH, project_id), data.project, true);
    const updatedData = await getProjectData(join(PROJECTS_PATH, project_id));
    return computeProject(updatedData);
  },
  SAVE_PICTURE: async (evt, { project_id, track_id, buffer, extension = 'jpg' }) => {
    const data = await getProjectData(join(PROJECTS_PATH, project_id));
    const picture = await savePicture(join(PROJECTS_PATH, project_id), track_id, extension, buffer);
    return {
      ...picture,
      link: getPictureLink(data._id, track_id, picture.filename),
    };
  },
  OPEN_LINK: async (evt, { link }) => {
    shell.openExternal(link);
    return null;
  },
  LIST_NATIVE_CAMERAS: () => {
    return getCameras();
  },
  TAKE_PICTURE_NATIVE_CAMERA: async (evt, { camera_id }) => {
    const camera = await getCamera(camera_id);
    if (camera) {
      return camera.takePicture();
    }
    return null;
  },
  GET_CAPABILITIES_NATIVE_CAMERA: async (evt, { camera_id }) => {
    const camera = await getCamera(camera_id);
    if (camera) {
      return camera.getCapabilities();
    }
    return [];
  },
  APPLY_CAPABILITY_NATIVE_CAMERA: async (evt, { camera_id, key, value }) => {
    const camera = await getCamera(camera_id);
    if (camera) {
      camera.applyCapability(key, value);
      return null;
    }
    return null;
  },
  RESET_CAPABILITIES_NATIVE_CAMERA: async (evt, { camera_id }) => {
    const camera = await getCamera(camera_id);
    if (camera) {
      camera.resetCapabilities();
      return camera.getCapabilities();
    }
    return [];
  },
  CONNECT_NATIVE_CAMERA: async (evt, { camera_id }, sendToRenderer) => {
    const camera = await getCamera(camera_id);
    if (camera) {
      camera.connect((data) => {
        sendToRenderer('LIVE_VIEW_DATA', { camera_id, data });
      });
    }
  },
  DISCONNECT_NATIVE_CAMERA: async (evt, { camera_id }) => {
    const camera = await getCamera(camera_id);
    if (camera) {
      flushCamera(camera_id);
      camera.disconnect();
    }
  },
  GET_SETTINGS: async () => {
    return getSettings(PROJECTS_PATH);
  },
  SAVE_SETTINGS: async (evt, { settings }) => {
    return saveSettings(PROJECTS_PATH, settings);
  },
  SYNC: async () => {
    let syncList = await getSyncList(PROJECTS_PATH);
    for (let i = 0; i < syncList.length; i++) {
      const syncElement = syncList[i];
      try {
        if (!syncElement.isUploaded) {
          console.log(`☁️ Sync start ${syncElement.publicCode} (${syncElement.apiKey})`);
          await uploadFile(syncElement.apiKey, syncElement.publicCode, syncElement.fileExtension, join(PROJECTS_PATH, '/.sync/', syncElement.fileName));
          syncList[i].isUploaded = true;
          await saveSyncList(PROJECTS_PATH, syncList);
          console.log(`✅ Sync finished ${syncElement.publicCode} (${syncElement.apiKey})`);
        }
      } catch (err) {
        console.log(`❌ Sync failed ${syncElement.publicCode} (${syncElement.apiKey})`, err);
      }
    }
  },
  APP_CAPABILITIES: async () => {
    const capabilities = [
      'EXPORT_VIDEO',
      'EXPORT_FRAMES',
      'BACKGROUND_SYNC',
      'LOW_FRAMERATE_QUALITY_IMPROVEMENT',
      'EXPORT_VIDEO_H264',
      'EXPORT_VIDEO_HEVC',
      'EXPORT_VIDEO_PRORES',
      'EXPORT_VIDEO_VP8',
      'EXPORT_VIDEO_VP9',
    ];
    return capabilities;
  },
  EXPORT_SELECT_PATH: async (
    evt,
    {
      type = 'FILE',
      format = 'h264',
      translations = {
        EXPORT_FRAMES: '',
        EXPORT_VIDEO: '',
        DEFAULT_FILE_NAME: '',
        EXT_NAME: '',
      },
    }
  ) => {
    if (type === 'FOLDER') {
      return selectFolder(translations.EXPORT_FRAMES);
    }
    if (type === 'FILE') {
      const profile = getEncodingProfile(format);
      return selectFile(translations.DEFAULT_FILE_NAME, profile.extension, translations.EXPORT_VIDEO, translations.EXT_NAME);
    }
    return null;
  },
  EXPORT_BUFFER: async (evt, { project_id, buffer_id, buffer }) => {
    await exportSaveTemporaryBuffer(join(PROJECTS_PATH, project_id), buffer_id, buffer);
  },
  EXPORT: async (
    evt,
    {
      project_id,
      track_id,
      frames = [],
      mode = 'video',
      format = 'h264',
      custom_output_framerate = false,
      custom_output_framerate_number = 10,
      output_path = null,
      public_code = 'default',
      event_key = '',
      framerate = 10,
      add_ending_text,
      ending_text,
      uploadToDrive,
      userEmail,
      background_sound,
    },
    sendToRenderer
  ) => {
    const projectPath = join(PROJECTS_PATH, project_id);
    const projectData = await getProjectData(projectPath);

    const sanitizeForFile = (value) =>
      (value || '')
        .toString()
        .trim()
        .replace(/[^a-z0-9-_]/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const emailSlug = sanitizeForFile(userEmail);
    const projectSlug = sanitizeForFile(
      projectData?.project?.authorsName || projectData?.project?.author || projectData?.project?.title || 'video'
    );
    const exportBaseName = emailSlug ? `${emailSlug}_${ts}` : `${projectSlug || 'video'}_${ts}`;

    // Force output path to a hardcoded file in the project folder
    const hardcodedPath = join(process.env.USERPROFILE, 'Desktop', 'stopmotion', `${exportBaseName}.mp4`);
    output_path = hardcodedPath;

    if (mode === 'frames') {
      if (output_path) {
        const bufferDirectoryPath = join(projectPath, `/.tmp/`);
        for (const frame of frames) {
          await copyFile(join(bufferDirectoryPath, frame.buffer_id), join(output_path, `frame-${frame.index.toString().padStart(6, '0')}.${frame.extension}`));
        }
      }
      return true;
    }

    const profile = getEncodingProfile(format);

    // Create sync folder if needed
    if (mode === 'send') {
      await mkdirp(join(PROJECTS_PATH, '/.sync/'));
    }

    const path = mode === 'send' ? join(PROJECTS_PATH, '/.sync/', `${public_code}.${profile.extension}`) : output_path;

    const result = await exportProjectScene(
      projectPath,
      track_id,
      frames,
      path,
      format,
      {
        customOutputFramerate: custom_output_framerate,
        customOutputFramerateNumber: custom_output_framerate_number,
        framerate: Number(framerate),
        add_ending_text,
        ending_text,
        uploadToDrive,
        userEmail,
        backgroundSound: background_sound,
        exportBaseName,
      },
      (progress) => sendToRenderer('FFMPEG_PROGRESS', { progress })
    );

    if (typeof sendToRenderer === 'function') {
      const payload = { driveLink: result?.driveLink || null, exportBaseName };
      console.log('[EXPORT] Emitting EXPORT_COMPLETED', payload);
      sendToRenderer('EXPORT_COMPLETED', payload);
    }

    if (mode === 'send') {
      const syncList = await getSyncList(PROJECTS_PATH);
      await saveSyncList(PROJECTS_PATH, [
        ...syncList,
        {
          apiKey: event_key,
          publicCode: public_code,
          fileName: `${public_code}.${profile.extension}`,
          fileExtension: profile.extension,
          isUploaded: false,
        },
      ]);

      actions.SYNC();
    }

    return true;
  },
};

export default actions;
