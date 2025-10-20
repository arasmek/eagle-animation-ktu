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
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { withTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

const Export = ({ t }) => {
  const { id, track } = useParams();
  const navigate = useNavigate();
  const { project } = useProject({ id });
  const { settings } = useSettings();

  const emailRef = useRef(null);

  const [isInfosOpened, setIsInfosOpened] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [frameRenderingProgress, setFrameRenderingProgress] = useState(0);
  const [videoRenderingProgress, setVideoRenderingProgress] = useState(0);
  const [resolutions, setResolutions] = useState(null);
  const [bestResolution, setBestResolution] = useState(null);
  const [driveLink, setDriveLink] = useState(null);
  const [exportBaseName, setExportBaseName] = useState(null);


  const { register, handleSubmit, watch } = useForm({
    mode: 'all',
    defaultValues: { mode: 'video', format: 'h264', videoResolution: 1080, addEndingText: true, uploadToDrive: true, userEmail: '' },
  });

  const projectRatio = parseRatio(project?.scenes?.[Number(track)]?.ratio)?.value || null;
  const framesKey = JSON.stringify(project?.scenes?.[Number(track)]?.pictures);

  useEffect(() => {
    if (!settings || !project) return;

    const input = emailRef.current;
    input?.focus();
  }, [settings, project]);

  useEffect(() => {
    GetFrameResolutions(id, Number(track), project?.scenes?.[Number(track)]?.pictures)
      .then(setResolutions)
      .catch(() => setResolutions(null));
  }, [framesKey, id, track]);

  useEffect(() => {
    if (resolutions) setBestResolution(getBestResolution(project?.scenes?.[Number(track)]?.pictures, resolutions, projectRatio));
  }, [resolutions, projectRatio, framesKey, project]);

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
  const progress = watch('mode') === 'frames' ? Math.min(frameRenderingProgress, 1) : Math.min(frameRenderingProgress / 2, 0.5) + Math.min(videoRenderingProgress / 2, 0.5);

  const handleExport = async (data) => {
    const files = project.scenes[Number(track)].pictures;
    let resolution = projectRatio
      ? { width: Number(data.videoResolution) * projectRatio, height: Number(data.videoResolution) }
      : (() => {
          const maxResolution = getBestResolution(files, resolutions);
          return { width: (Number(data.videoResolution) * maxResolution.width) / maxResolution.height, height: Number(data.videoResolution) };
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
      duplicateFramesAutoNumber: 10,
      forceFileExtension: 'jpg',
      resolution,
    };

    window.track('project_exported', { projectId: project.id, ...data, ...exportSettings });

    const frames = await ExportFrames(id, Number(track), files, exportSettings, (p) => setFrameRenderingProgress(p), createBuffer);

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
      ending_text: project?.title ? `${project.title}` : '',
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
            <form onSubmit={handleSubmit(handleExport)}>
              <FormLayout>
                <FormGroup label={t('Email')} description={t('If you want to receive the Google Drive link by email, enter your address.')}>
                  <Input
                    placeholder={t('your@email.com')}
                    type="email"
                    style={{ width: '100%', padding: '8px', fontSize: '1em' }}
                    {...register('userEmail')}
                    ref={(el) => (register('userEmail').ref(el), (emailRef.current = el))}
                  />
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
