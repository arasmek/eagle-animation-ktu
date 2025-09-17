import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { withTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { floorResolution, getBestResolution } from '@common/resolution';
import ExportOverlay from '@components/ExportOverlay';
import FormGroup from '@components/FormGroup';
import FormLayout from '@components/FormLayout';
import HeaderBar from '@components/HeaderBar';
import Input from '@components/Input';
import LoadingPage from '@components/LoadingPage';
import PageContent from '@components/PageContent';
import PageLayout from '@components/PageLayout';
import { ExportFrames } from '@core/Export';
import { parseRatio } from '@core/ratio';
import { GetFrameResolutions } from '@core/ResolutionsCache';
import useProject from '@hooks/useProject';
import useSettings from '@hooks/useSettings';

const Export = ({ t }) => {
  const { id, track } = useParams();
  const navigate = useNavigate();
  const { project } = useProject({ id });

  const [isInfosOpened, setIsInfosOpened] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [frameRenderingProgress, setFrameRenderingProgress] = useState(0);
  const [videoRenderingProgress, setVideoRenderingProgress] = useState(0);
  const [resolutions, setResolutions] = useState(null);
  const [bestResolution, setBestResolution] = useState(null);

  const { settings } = useSettings();

  const { register, handleSubmit, watch } = useForm({
    mode: 'all',
    defaultValues: {
      mode: 'video',
      format: 'h264',
      videoResolution: 1080,
      addEndingText: true,
      uploadToDrive: true,
      userEmail: '',
    },
  });

  const projectRatio = parseRatio(project?.scenes[Number(track)]?.ratio)?.value || null;
  const framesKey = JSON.stringify(project?.scenes?.[Number(track)]?.pictures);

  useEffect(() => {
    GetFrameResolutions(id, Number(track), project?.scenes?.[Number(track)]?.pictures)
      .then((d) => {
        setResolutions(d);
      })
      .catch((err) => {
        console.error(err);
        setResolutions(null);
      });
  }, [framesKey, id, track]);

  useEffect(() => {
    if (resolutions) {
      setBestResolution(getBestResolution(project?.scenes?.[Number(track)]?.pictures, resolutions, projectRatio));
    }
  }, [framesKey, projectRatio, resolutions, project]);

  useEffect(() => {
    const handler = (evt, args) => {
      setVideoRenderingProgress(args.progress || 0);
    };
    const unsubscribe = window.EAEvents('FFMPEG_PROGRESS', handler);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  if (!project || !settings || !bestResolution) {
    return (
      <>
        <LoadingPage show={true} />
        <PageLayout>
          <HeaderBar leftActions={['BACK']} onAction={handleBack} title={t('Export')} withBorder />
          <PageContent></PageContent>
        </PageLayout>
      </>
    );
  }

  const progress = watch('mode') === 'frames' ? Math.min(frameRenderingProgress, 1) : Math.min(frameRenderingProgress / 2, 0.5) + Math.min(videoRenderingProgress / 2, 0.5);

  const handleExport = async (data) => {
    console.log('[EXPORT] handleExport data:', data);
    const files = project.scenes[Number(track)].pictures;

    // Define output resolution
    let resolution;
    if (projectRatio) {
      resolution = { width: Number(data.videoResolution) * projectRatio, height: Number(data.videoResolution) };
    } else {
      const maxResolution = getBestResolution(files, resolutions);
      resolution = { width: (Number(data.videoResolution) * maxResolution.width) / maxResolution.height, height: Number(data.videoResolution) };
    }

    resolution = floorResolution(resolution);

    setIsInfosOpened(true);
    setIsExporting(true);
    setFrameRenderingProgress(0);
    setVideoRenderingProgress(0);

    // Ask user to define output path
    const outputPath = await window.EA('EXPORT_SELECT_PATH', {
      type: 'FILE',
      format: data.format,
      translations: {
        EXPORT_VIDEO: t('Export as video'),
        DEFAULT_FILE_NAME: project?.title || t('video'),
        EXT_NAME: t('Video file'),
      },
    });

    // Cancel if result is null, (dialog closed)
    if (outputPath === null) {
      setIsInfosOpened(false);
      setIsExporting(false);
      return;
    }

    const createBuffer = async (bufferId, buffer) => {
      await window.EA('EXPORT_BUFFER', {
        project_id: id,
        buffer_id: bufferId,
        buffer,
      });
    };

    const exportSettings = {
      duplicateFramesCopy: true,
      duplicateFramesAuto: true,
      duplicateFramesAutoNumber: Math.ceil((project?.scenes?.[Number(track)]?.framerate || 24) / 2),
      forceFileExtension: 'jpg',
      resolution,
    };

    // Track export
    window.track('project_exported', { projectId: project.id, ...data, ...exportSettings });

    // Compute all frames
    const frames = await ExportFrames(id, Number(track), files, exportSettings, (p) => setFrameRenderingProgress(p), createBuffer);

    // Save frames / video on the disk
    await window.EA('EXPORT', {
      frames: frames.map(({ mimeType, bufferId, ...e }) => ({ ...e, buffer_id: bufferId, mime_type: mimeType })),
      output_path: outputPath,
      mode: data.mode,
      format: data.format,
      framerate: project?.scenes?.[Number(track)]?.framerate,
      project_id: id,
      track_id: track,
      event_key: settings.EVENT_KEY,
      add_ending_text: data.addEndingText,
      ending_text: project?.title ? `Filmą sukūrė: ${project.title}` : '',
      uploadToDrive: data.uploadToDrive,
      userEmail: data.userEmail,
    });

    setIsExporting(false);
  };

  return (
    <>
      <LoadingPage show={!settings || !bestResolution} />
      <PageLayout>
        <HeaderBar leftActions={['BACK']} onAction={handleBack} title={t('Export')} withBorder />
        <PageContent>
          {settings && (
            <form id="export" onSubmit={handleSubmit(handleExport)}>
              <FormLayout>
                <FormGroup label={t('Email (optional, for Drive link)')} description={t('If you want to receive the Google Drive link by email, enter your address.')}>
                  <Input {...register('userEmail')} placeholder={t('your@email.com')} type="email" style={{ width: '100%', padding: '8px', fontSize: '1em' }} />
                </FormGroup>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                  <button type="submit" className="ea-export-btn" disabled={isInfosOpened} style={{ padding: '12px 32px', fontSize: '1.1em', borderRadius: '8px', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
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
          onCancel={() => {
            setIsInfosOpened(false);
            setIsExporting(false);
          }}
        />
      )}
    </>
  );
};

export default withTranslation()(Export);
