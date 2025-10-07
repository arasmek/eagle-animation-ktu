const profiles = {
  h264: {
    codec: 'libx264',
    extension: 'mp4',
    pix_fmt: 'yuv420p',
    preset: 'faster',
  },
  hevc: {
    codec: 'libx265',
    extension: 'mp4',
    pix_fmt: 'yuv420p',
    preset: 'faster',
  },
  prores: {
    codec: 'prores_ks',
    extension: 'mov',
    pix_fmt: 'yuva444p10le',
  },
  vp8: {
    codec: 'libvpx',
    extension: 'webm',
    pix_fmt: 'yuv420p',
  },
  vp9: {
    codec: 'libvpx-vp9',
    extension: 'webm',
    pix_fmt: 'yuv420p',
  },
};

export const getEncodingProfile = (format) => {
  return profiles[format] || null;
};

export const parseFFmpegLogs = (logPart, nbFrames = 0, outputFramerate = null, onProgress = () => {}) => {
  (logPart || '').split('\n').forEach((line) => {
    const currentFrame = line?.split('fps=')?.[0]?.split('frame=')?.[1]?.replaceAll(' ', '')?.replaceAll('\t', '') || null;
    if (currentFrame) {
      let divider = outputFramerate === null ? nbFrames : nbFrames * outputFramerate;
      divider = divider <= 0 ? 1 : divider;
      const value = Number(currentFrame) / divider;
      if (value) {
        onProgress(value);
      }
    }
  });
};

export const getFFmpegArgs = (encodingProfile = false, outputFile = false, fps = 24, opts = {}) => {
  if (typeof profiles[encodingProfile] === 'undefined') {
    throw new Error('UNKNOWN_PROFILE');
  }

  const profile = profiles[encodingProfile];
  if (!outputFile) throw new Error('UNDEFINED_OUTPUT');

  const args = ['-y', '-stats_period', '0.1'];

  // INPUT 0: image sequence — set input framerate with -framerate (not -r)
  const inputFps = Number(fps) > 0 && Number(fps) <= 240 ? Number(fps) : 12;
  args.push('-framerate', `${inputFps}`);
  args.push('-i', 'frame-%06d.jpg');

  // INPUT 1: optional background audio
  const hasAudio = !!opts.backgroundSoundPath;
  if (hasAudio) {
    // Loop audio; final duration will be capped below to match video
    args.push('-stream_loop', '-1', '-i', opts.backgroundSoundPath);
  }

  // Video codec + preset
  args.push('-c:v', profile.codec);
  if (profile.preset) args.push('-preset', profile.preset);

  // Pixel mode
  args.push('-pix_fmt', profile.pix_fmt);

  // MP4 faststart
  if (profile.extension === 'mp4') {
    args.push('-movflags', '+faststart');
  }

  // Custom output framerate (output side)
  if (opts.customOutputFramerate && opts.customOutputFramerateNumber) {
    args.push('-r', `${Number(opts.customOutputFramerateNumber)}`);
  }

  // ProRes specifics
  if (encodingProfile === 'prores') {
    args.push('-profile:v', '3', '-vendor', 'apl0', '-bits_per_mb', '4000', '-f', 'mov');
  }

  // If audio provided: duration, codec, mapping
  if (hasAudio) {
    // Exact duration = totalFrames / outputFps
    const outputFps = opts.customOutputFramerate && opts.customOutputFramerateNumber ? Number(opts.customOutputFramerateNumber) : inputFps;
    const totalFrames = Number(opts.totalFrames || 0);
    if (outputFps > 0 && totalFrames > 0) {
      const duration = (totalFrames / outputFps).toFixed(3);
      args.push('-t', `${duration}`);
    }

    // Container-appropriate audio codec
    if (profile.extension === 'webm') {
      args.push('-c:a', 'libopus', '-b:a', '128k');
    } else {
      args.push('-c:a', 'aac', '-b:a', '192k');
    }

    // Explicit mapping: 0 = images(video), 1 = audio
    args.push('-map', '0:v:0', '-map', '1:a:0');
    args.push('-shortest');
  }

  // Output file
  const hasExtension = outputFile.toLowerCase().endsWith(`.${profile.extension}`);
  args.push(`${outputFile}${hasExtension ? '' : `.${profile.extension}`}`);

  return args;
};
