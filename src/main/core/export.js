import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { format, join } from 'node:path';

import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import { v4 as uuidv4 } from 'uuid';

import { getFFmpegArgs, parseFFmpegLogs } from '../../common/ffmpeg';
import { uploadToDrive } from './driveUpload';
import { createEndingFrame } from './endingFrame';
import { ffmpeg } from './ffmpeg';
import { getProjectData } from './projects';

export const exportSaveTemporaryBuffer = async (projectPath, bufferId, buffer) => {
  const directoryPath = join(projectPath, `/.tmp/`);
  await mkdirp(directoryPath);
  await writeFile(join(directoryPath, bufferId), buffer);
};

export const exportProjectScene = async (projectPath, scene, frames, filePath, format, opts = {}, onProgress = () => {}) => {
  const project = await getProjectData(projectPath);
  console.log('[EXPORT] Starting exportProjectScene', { filePath, opts });
  const directoryPath = join(projectPath, `/.tmp-${uuidv4()}/`);
  const bufferDirectoryPath = join(projectPath, `/.tmp/`);
  await mkdirp(directoryPath);
  for (const frame of frames) {
    await copyFile(join(bufferDirectoryPath, frame.buffer_id), join(directoryPath, `frame-${frame.index.toString().padStart(6, '0')}.${frame.extension}`));
  }

  const fps = opts?.framerate || project.project.scenes[scene].framerate;
  // If ending text is requested, generate and add ending frame(s)
  if (opts.add_ending_text && opts.ending_text) {
    const width = frames[0]?.width || 1920;
    const height = frames[0]?.height || 1080;
    const endingFrameCount = Math.round(fps * 1); // 1 second
    const endingBuffer = await createEndingFrame({
      text: opts.ending_text,
      width,
      height,
      font: 'bold 48px Open Sans',
      color: '#fff',
      bgColor: '#222',
    });
    console.log(`[DEBUG] Generating ${endingFrameCount} ending frames at ${width}x${height}`);
    for (let i = 0; i < endingFrameCount; i++) {
      const endingFramePath = join(directoryPath, `frame-${(frames.length + i).toString().padStart(6, '0')}.jpg`);
      await writeFile(endingFramePath, endingBuffer);
      console.log(`[DEBUG] Ending frame written: ${endingFramePath}`);
    }
  }
  const args = getFFmpegArgs(format, filePath, fps, opts);

  const handleData = (data) => {
    parseFFmpegLogs(data, frames.length || 0, opts.customOutputFramerate ? opts.customOutputFramerateNumber : undefined, onProgress);
  };
  await ffmpeg(args, directoryPath, handleData);
  await rimraf(directoryPath);
  await rimraf(bufferDirectoryPath);

  const sanitize = (email) => email.replace(/[^a-z0-9]/gi, '_');
  console.log('[EXPORT] opts:', { uploadToDrive: opts.uploadToDrive, userEmail: opts.userEmail });
  // Upload to Google Drive if requested, then send email if userEmail is provided
  if (opts.uploadToDrive) {
    console.log('[EXPORT] Entered uploadToDrive block');
    const fs = require('fs');
    console.log(`[DRIVE] Checking file for upload: ${filePath}`);
    if (fs.existsSync(filePath)) {
      console.log('[DRIVE] File exists, starting upload');
      try {
        const safeName = opts.userEmail ? sanitize(opts.userEmail) : project.project.title || 'video';
        const driveFileName = `${safeName}.mp4`;

        const driveLink = await uploadToDrive(filePath, driveFileName, '1ZiZGdbV4nZWQb1v_rGbC2Hq0I_ErZHGJ');
        console.log(`[DRIVE] Uploaded to Google Drive: ${driveLink}`);

        if (driveLink && opts.userEmail) {
          console.log('[DRIVE] About to send email:', opts.userEmail, driveLink);
          const { sendExportEmail } = require('./core/emailSender');
          await sendExportEmail({ to: opts.userEmail, link: driveLink });
        }
      } catch (err) {
        console.error('[DRIVE/EMAIL] Upload or email failed:', err);
      }
    } else {
      console.error(`[DRIVE] Exported video file does not exist: ${filePath}`);
    }
  }
};

// Sync list
export const getSyncList = async (path) => {
  try {
    const file = format({ dir: path, base: 'sync.json' });
    const data = await readFile(file, 'utf8');
    const sync = JSON.parse(data);
    return [...sync];
  } catch (e) {
    return [];
  }
};

// Save sync list
export const saveSyncList = async (path, data) => {
  try {
    const file = format({ dir: path, base: 'sync.json' });
    await writeFile(file, JSON.stringify([...data]));
    return [...data];
  } catch (e) {
    return [];
  }
};
