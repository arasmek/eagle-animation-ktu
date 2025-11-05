import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { format, join } from 'node:path';

import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import { v4 as uuidv4 } from 'uuid';

import { app } from 'electron';
import { getFFmpegArgs, parseFFmpegLogs, getEncodingProfile } from '../../common/ffmpeg';
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
  let driveLink = null;
  // If ending text is requested, generate and add ending frame(s)
  if (opts.add_ending_text && opts.ending_text) {
    const width = frames[0]?.width || 1920;
    const height = frames[0]?.height || 1080;
    const endingFrameCount = Math.round(fps * 3); // 1 second
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
  // Compute total frames (including ending frames if any)
  const framesGlob = await (async () => {
    try {
      const fs = require('node:fs');
      const list = fs.readdirSync(directoryPath).filter((n) => n.startsWith('frame-') && n.endsWith('.jpg'));
      return list.length;
    } catch (e) {
      return frames.length;
    }
  })();

  // Prepare audio if requested
  let ffmpegOpts = { ...opts, totalFrames: framesGlob };
  try {
    if (opts?.backgroundSound) {
      const path = require('node:path');
      const fs = require('node:fs');
      const os = require('node:os');
      const audioFileName = opts.backgroundSound; // e.g., mytrack.mp3
      const desktopAudioPath = join(os.homedir(), 'Desktop', 'audio', audioFileName);
      const resourcesBase = app?.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'resources');
      const resourceAudioPath = join(resourcesBase, 'audio', audioFileName);
      const sourcePath = fs.existsSync(desktopAudioPath) ? desktopAudioPath : resourceAudioPath;
      if (fs.existsSync(sourcePath)) {
        const audioExt = path.extname(sourcePath) || '.mp3';
        const localAudioName = `bg-audio${audioExt}`;
        const localAudioPath = join(directoryPath, localAudioName);
        await copyFile(sourcePath, localAudioPath);
        ffmpegOpts.backgroundSoundPath = localAudioName; // relative to cwd
        console.log(`[EXPORT] Attached background audio: ${audioFileName}`);
      } else {
        console.warn(`[EXPORT] Background audio not found: ${desktopAudioPath} or ${resourceAudioPath}`);
      }
    }
  } catch (e) {
    console.warn('[EXPORT] Failed preparing background audio:', e);
  }

  // Decide outputs for one-pass or two-pass (mux audio after video render)
  const hasAudio = !!ffmpegOpts.backgroundSoundPath;
  const profile = getEncodingProfile(format);
  const tempVideoName = `video_no_audio.${profile.extension}`;
  const firstPassOutput = hasAudio ? tempVideoName : filePath;

  const argsPass1 = getFFmpegArgs(format, firstPassOutput, fps, {
    ...ffmpegOpts,
    backgroundSoundPath: undefined, // ensure first pass is video-only
  });

  const handleData = (data) => {
    parseFFmpegLogs(
      data,
      framesGlob || 0,
      ffmpegOpts.customOutputFramerate ? ffmpegOpts.customOutputFramerateNumber : undefined,
      onProgress
    );
  };
  await ffmpeg(argsPass1, directoryPath, handleData);

  if (hasAudio) {
    // Second pass: mux audio with copy of the video stream
    const muxArgs = ['-y'];
    muxArgs.push('-i', tempVideoName);
    muxArgs.push('-i', ffmpegOpts.backgroundSoundPath);
    muxArgs.push('-c:v', 'copy');
    if (profile.extension === 'webm') {
      muxArgs.push('-c:a', 'libopus', '-b:a', '128k');
    } else {
      muxArgs.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
    }
    muxArgs.push('-map', '0:v:0', '-map', '1:a:0', '-shortest');
    muxArgs.push(filePath);
    await ffmpeg(muxArgs, directoryPath, () => {});
    onProgress(1);
  }
  await rimraf(directoryPath);
  await rimraf(bufferDirectoryPath);

  const sanitize = (value) => (value || '').toString().replace(/[^a-z0-9-_]/gi, '_');
  console.log('[EXPORT] opts:', { uploadToDrive: opts.uploadToDrive, userEmail: opts.userEmail });
  // Upload to Google Drive if requested, then send email if userEmail is provided
  if (opts.uploadToDrive) {
    console.log('[EXPORT] Entered uploadToDrive block');
    const fs = require('fs');
    console.log(`[DRIVE] Checking file for upload: ${filePath}`);
    if (fs.existsSync(filePath)) {
      console.log('[DRIVE] File exists, starting upload');
      try {
        const baseForDrive = sanitize(opts.exportBaseName || opts.userEmail || project.project.title || 'video');
        const safeName = baseForDrive || 'video';
        const driveFileName = `${safeName}.mp4`;

        driveLink = await uploadToDrive(filePath, driveFileName, '1ZiZGdbV4nZWQb1v_rGbC2Hq0I_ErZHGJ');
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
  return { driveLink };
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
