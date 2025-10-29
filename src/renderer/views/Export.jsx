import { floorResolution, getBestResolution } from '@common/resolution';
import ExportOverlay from '@components/ExportOverlay';
import FormGroup from '@components/FormGroup';
import FormLayout from '@components/FormLayout';
import HeaderBar from '@components/HeaderBar';
import LoadingPage from '@components/LoadingPage';
import PageContent from '@components/PageContent';
import PageLayout from '@components/PageLayout';
import Select from '@components/Select';
import { ExportFrames } from '@core/Export';
import { parseRatio } from '@core/ratio';
import { GetFrameResolutions } from '@core/ResolutionsCache';
import useProject from '@hooks/useProject';
import useSettings from '@hooks/useSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { withTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

const Export = ({ t }) => {
  const { id, track } = useParams();
  const navigate = useNavigate();
  const { project } = useProject({ id });
  const { settings } = useSettings();

  const [isInfosOpened, setIsInfosOpened] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [frameRenderingProgress, setFrameRenderingProgress] = useState(0);
  const [videoRenderingProgress, setVideoRenderingProgress] = useState(0);
  const [resolutions, setResolutions] = useState(null);
  const [bestResolution, setBestResolution] = useState(null);
  const [driveLink, setDriveLink] = useState(null);
  const [exportBaseName, setExportBaseName] = useState(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const audioPreviewRef = useRef(null);
  const audioPreviewTimerRef = useRef(null);
  const audioPreviewVolumeRef = useRef(0.7);

  const { register, handleSubmit, watch } = useForm({
    mode: 'all',
    defaultValues: { backgroundSound: 'none' },
  });

  const projectRatio = parseRatio(project?.scenes?.[Number(track)]?.ratio)?.value || null;
  const framesKey = JSON.stringify(project?.scenes?.[Number(track)]?.pictures);
  const selectedBackgroundSound = watch('backgroundSound');

  useEffect(() => {
    GetFrameResolutions(id, Number(track), project?.scenes?.[Number(track)]?.pictures)
      .then(setResolutions)
      .catch(() => setResolutions(null));
  }, [framesKey, id, track]);

  useEffect(() => {
    if (resolutions) setBestResolution(getBestResolution(project?.scenes?.[Number(track)]?.pictures, resolutions, projectRatio));
  }, [resolutions, projectRatio, framesKey, project]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const tracks = (await window.EA('LIST_AUDIO_TRACKS')) || [];
        if (disposed) {
          return;
        }
        const options = tracks.map((n) => ({ value: n, label: n.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }));
        setAudioTracks(options);
      } catch (_) {
        if (!disposed) {
          setAudioTracks([]);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const stopPreview = () => {
      if (audioPreviewTimerRef.current) {
        clearTimeout(audioPreviewTimerRef.current);
        audioPreviewTimerRef.current = null;
      }
      if (audioPreviewRef.current) {
        const audio = audioPreviewRef.current;
        audioPreviewRef.current = null;
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.src = '';
          audio.load();
        } catch (_) {}
        audio.volume = audioPreviewVolumeRef.current ?? 0.7;
      }
    };

    stopPreview();

    if (!selectedBackgroundSound || selectedBackgroundSound === 'none' || typeof window === 'undefined' || typeof window.EA !== 'function') {
      return stopPreview;
    }

    let disposed = false;

    (async () => {
      try {
        const response = await window.EA('GET_AUDIO_TRACK', { name: selectedBackgroundSound });
        if (disposed || !response?.path) {
          return;
        }

        const audio = new Audio();
        audio.src = response.path;
        audio.preload = 'auto';
        audio.volume = 0.7;
        audioPreviewVolumeRef.current = audio.volume;
        audioPreviewRef.current = audio;

        const attemptPlay = () => {
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(() => {});
          }
        };

        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          attemptPlay();
        } else {
          audio.addEventListener('canplay', attemptPlay, { once: true });
          audio.load();
        }

        audio.addEventListener(
          'error',
          () => {
            if (audioPreviewRef.current === audio) {
              audioPreviewRef.current = null;
            }
          },
          { once: true },
        );

        audioPreviewTimerRef.current = setTimeout(() => {
          if (audioPreviewRef.current === audio) {
            const fadeDuration = 600;
            const fadeSteps = 12;
            const initialVolume = audio.volume;
            let currentStep = 0;

            const fadeInterval = setInterval(() => {
              currentStep += 1;
              const ratio = Math.max(0, 1 - currentStep / fadeSteps);
              audio.volume = initialVolume * ratio;
              if (currentStep >= fadeSteps || audioPreviewRef.current !== audio) {
                clearInterval(fadeInterval);
                try {
                  audio.pause();
                  audio.currentTime = 0;
                  audio.volume = initialVolume;
                } catch (_) {}
                try {
                  audio.src = '';
                  audio.load();
                } catch (_) {}
                if (audioPreviewRef.current === audio) {
                  audioPreviewRef.current = null;
                }
              }
            }, fadeDuration / fadeSteps);
          }
          audioPreviewTimerRef.current = null;
        }, 3500);
      } catch (err) {
        console.warn('[Export] Failed to preview audio track', err);
        stopPreview();
      }
    })();

    return () => {
      disposed = true;
      stopPreview();
    };
  }, [selectedBackgroundSound]);

  const handleBack = () => navigate(-1);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault();
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleBack]);

  useEffect(() => {
    let cancelled = false;

    const handler = (evt, args = {}) => {
      if (cancelled) {
        return;
      }
      console.log('[Export view] EXPORT_COMPLETED', args);
      setDriveLink(args.driveLink || null);
      setExportBaseName(args.exportBaseName || null);
    };

    window.EAEvents('EXPORT_COMPLETED', handler);

    return () => {
      cancelled = true;
    };
  }, []);
  const progress = Math.min(frameRenderingProgress / 2, 0.5) + Math.min(videoRenderingProgress / 2, 0.5);

  const handleExport = async (data) => {
    const exportResolution = 1080;
    const exportFormat = 'h264';
    const exportMode = 'video';
    const files = project.scenes[Number(track)].pictures;
    let resolution = projectRatio
      ? { width: exportResolution * projectRatio, height: exportResolution }
      : (() => {
          const maxResolution = getBestResolution(files, resolutions);
          return { width: (exportResolution * maxResolution.width) / maxResolution.height, height: exportResolution };
        })();

    resolution = floorResolution(resolution);

    setIsInfosOpened(true);
    setIsExporting(true);
    setDriveLink(null);
    setExportBaseName(null);
    setFrameRenderingProgress(0);
    setVideoRenderingProgress(0);

    const outputPath = null;

    const createBuffer = async (bufferId, buffer) => await window.EA('EXPORT_BUFFER', { project_id: id, buffer_id: bufferId, buffer });

    const exportSettings = {
      duplicateFramesCopy: true,
      duplicateFramesAuto: true,
      duplicateFramesAutoNumber: 2,
      forceFileExtension: 'jpg',
      resolution,
    };

    window.track('project_exported', { projectId: project.id, mode: exportMode, format: exportFormat, ...exportSettings, backgroundSound: data.backgroundSound });

    const frames = await ExportFrames(id, Number(track), files, exportSettings, (p) => setFrameRenderingProgress(p), createBuffer);

    await window.EA('EXPORT', {
      frames: frames.map(({ mimeType, bufferId, ...e }) => ({ ...e, buffer_id: bufferId, mime_type: mimeType })),
      output_path: outputPath,
      mode: exportMode,
      format: exportFormat,
      framerate: project?.scenes?.[Number(track)]?.framerate,
      project_id: id,
      track_id: track,
      event_key: settings.EVENT_KEY,
      add_ending_text: true,
      ending_text: project?.title ? `${project.title}` : '',
      uploadToDrive: true,
      userEmail: '',
      background_sound: data.backgroundSound && data.backgroundSound !== 'none' ? data.backgroundSound : undefined,
    });

    setIsExporting(false);
  };

  const backgroundSoundOptions = useMemo(() => [{ value: 'none', label: t('None') }, ...audioTracks], [audioTracks, t]);

  return (
    <>
      <LoadingPage show={!settings || !bestResolution} />
      <PageLayout>
        <HeaderBar leftActions={['BACK']} onAction={handleBack} title={t('Export')} withBorder />
        <PageContent>
          {settings && (
            <form onSubmit={handleSubmit(handleExport)}>
              <FormLayout>
                <FormGroup label={t('Background sound')} description={t('Select background audio for the exported video')}>
                  <Select options={backgroundSoundOptions} register={register('backgroundSound')} />
                </FormGroup>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                  <button
                    type="submit"
                    disabled={isInfosOpened}
                    style={{ padding: '12px 32px', fontSize: '1.1em', borderRadius: '8px', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    {t('Export')}
                  </button>
                </div>
              </FormLayout>
            </form>
          )}
        </PageContent>
      </PageLayout>
      {isInfosOpened && (
        <ExportOverlay
          publicCode={null}
          isExporting={isExporting}
          progress={progress}
          driveLink={driveLink}
          exportBaseName={exportBaseName}
          onCancel={() => {
            setIsInfosOpened(false);
            setIsExporting(false);
            setDriveLink(null);
            setExportBaseName(null);
          }}
        />
      )}
    </>
  );
};

export default withTranslation()(Export);
