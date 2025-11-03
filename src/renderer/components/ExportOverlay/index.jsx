import ActionCard from '@components/ActionCard';
import useProjects from '@hooks/useProjects';
import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { withTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';

import IconDone from './assets/done.svg?jsx';
import IconQuit from './assets/quit.svg?jsx';

import * as style from './style.module.css';

const ExportOverlay = ({
  t,
  publicCode = null,
  onCancel = null,
  isExporting = false,
  progress = 0,
  driveLink = null,
  exportBaseName = null,
}) => {
  const { actions: projectsActions } = useProjects();
  const navigate = useNavigate();
  const defaultCanvasId = useId();
  const canvasId = useMemo(
    () => (exportBaseName ? `ea-qr-${exportBaseName}` : `ea-qr-${defaultCanvasId.replace(/:/g, '-')}`),
    [exportBaseName, defaultCanvasId],
  );
  const hasSavedQrRef = useRef(false);

  useLayoutEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    window.track?.('export_overlay_state', { state: isExporting ? 'exporting' : 'done' });
  }, [isExporting]);

  useEffect(() => {
    if (isExporting || !driveLink || !exportBaseName) {
      hasSavedQrRef.current = false;
    }
  }, [isExporting, driveLink, exportBaseName]);

  useEffect(() => {
    if (isExporting || !driveLink || !exportBaseName || hasSavedQrRef.current) {
      return;
    }

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 8;
    const timers = new Set();

    const scheduleRetry = () => {
      if (cancelled || hasSavedQrRef.current || attempt >= maxAttempts) {
        return;
      }
      attempt += 1;
      const timer = setTimeout(() => {
        timers.delete(timer);
        trySave();
      }, 150 * attempt);
      timers.add(timer);
    };

    const trySave = () => {
      if (cancelled || hasSavedQrRef.current) {
        return;
      }
      const canvas = document.getElementById(canvasId);
      if (!(canvas instanceof HTMLCanvasElement)) {
        scheduleRetry();
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        scheduleRetry();
        return;
      }
      let hasDarkPixel = false;
      try {
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) {
            hasDarkPixel = true;
            break;
          }
        }
      } catch (_) {
        scheduleRetry();
        return;
      }
      if (!hasDarkPixel) {
        scheduleRetry();
        return;
      }

      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (_) {
        scheduleRetry();
        return;
      }

      if (!dataUrl || dataUrl === 'data:image/png;base64,' || dataUrl === 'data:,') {
        scheduleRetry();
        return;
      }

      if (typeof window?.EA !== 'function') {
        hasSavedQrRef.current = true;
        return;
      }

      window
        .EA('SAVE_QR_IMAGE', { dataUrl, exportBaseName, uploadToDrive: Boolean(driveLink) })
        .then((response) => {
          if (cancelled) {
            return;
          }
          if (!response?.success) {
            hasSavedQrRef.current = false;
            scheduleRetry();
            return;
          }
          hasSavedQrRef.current = true;
        })
        .catch(() => {
          if (!cancelled) {
            hasSavedQrRef.current = false;
            scheduleRetry();
          }
        });
    };

    trySave();

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [canvasId, driveLink, exportBaseName, isExporting]);

  const handleCreateProject = async () => {
    const title = t('New project');
    const project = await projectsActions.create(title);
    navigate(`/animator/${project.id}/0`);
    window.track?.('project_created', { projectId: project.id });
  };

  const formattedCode = publicCode
    ? publicCode
        .split('')
        .reduce((acc, char, index) => acc + (index && index % 2 === 0 ? ' ' : '') + char, '')
        .trim()
    : null;

  return (
    <div className={style.background}>
      {onCancel && (
        <button type='button' onClick={onCancel} className={style.quit} aria-label={t('Back')}>
          <IconQuit />
        </button>
      )}
      <div className={`${style.container} ${isExporting ? style.loading : style.complete}`}>
        {publicCode && (
          <div className={style.publicCode}>
            <span className={style.publicCodeLabel}>{t("You'll be able to get your film using this code:")}</span>
            <span className={style.publicCodeValue}>{formattedCode}</span>
          </div>
        )}

        {isExporting ? (
          <>
            <span className={style.loader} />
            <h2 className={style.title}>{t('Your movie is being created!')}</h2>
            <p className={style.subtitle}>{t('Hang tight while we prepare everything for you.')}</p>
            <div className={style.progress}>{`${Math.min(100, Math.max(0, Math.round(progress * 100)))}%`}</div>
            <p className={style.helper}>{t('Export will take a while, please be patient')}</p>
          </>
        ) : (
          <>
            <div className={style.doneIcon}>
              <IconDone />
            </div>
            <h2 className={style.title}>{t('Your movie is done!')}</h2>
            <p className={style.subtitle}>{t('One of our personnel will guide you now.')}</p>

            {driveLink && (
              <div className={style.driveBlock}>

                <div className={style.qrWrapper}>
                  <QRCodeCanvas id={canvasId} value={driveLink} size={180} includeMargin fgColor='#000000' bgColor='#ffffff' />
                </div>
                <p className={style.qrHint}>{t('Scan the QR code to open the link on another device.')}</p>
              </div>
            )}

            {publicCode && (
              <div className={style.actionCardWrapper}>
                <ActionCard onClick={handleCreateProject} title={t('Create new project')} sizeAuto />
              </div>
            )}

            <button type='button' className={style.actionButton} onClick={() => navigate('/')}>
              {t('Done')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default withTranslation()(ExportOverlay);
