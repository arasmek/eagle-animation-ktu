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
  const canvasId = useMemo(() => {
    if (exportBaseName) {
      return `ea-qr-${exportBaseName}`;
    }
    return `ea-qr-${defaultCanvasId.replace(/:/g, '-')}`;
  }, [exportBaseName, defaultCanvasId]);
  const hasSavedQrRef = useRef(false);

  const handleCreateProject = async () => {
    const title = t('New project');
    const project = await projectsActions.create(title);
    navigate(`/animator/${project.id}/0`);
    window.track('project_created', { projectId: project.id });
  };

  useLayoutEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  });

  useEffect(() => {
    console.log('[ExportOverlay] props updated', { isExporting, driveLink, exportBaseName });
  }, [isExporting, driveLink, exportBaseName]);

  useEffect(() => {
    if (isExporting || !driveLink || !exportBaseName) {
      hasSavedQrRef.current = false;
      console.log('[ExportOverlay] reset hasSavedQrRef', { isExporting, driveLinkPresent: Boolean(driveLink), exportBaseName });
    }
  }, [isExporting, driveLink, exportBaseName]);

  useEffect(() => {
    if (isExporting || !driveLink || !exportBaseName) {
      console.log('[ExportOverlay] skip capture - missing data', {
        isExporting,
        driveLinkPresent: Boolean(driveLink),
        exportBaseName,
      });
      return;
    }
    if (hasSavedQrRef.current) {
      console.log('[ExportOverlay] skip capture - already saved');
      return;
    }

    console.log('[ExportOverlay] attempting capture', { isExporting, driveLink, exportBaseName });
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 8;
    const pendingTimers = new Set();

    const scheduleRetry = () => {
      if (cancelled || hasSavedQrRef.current || attempt >= maxAttempts) {
        return;
      }
      attempt += 1;
      const delay = 150 * attempt;
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        trySave();
      }, delay);
      pendingTimers.add(timer);
    };

    function trySave() {
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
      } catch (err) {
        // getImageData may fail if canvas is not ready yet; retry
      }
      if (!hasDarkPixel) {
        scheduleRetry();
        return;
      }
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (err) {
        console.warn('[ExportOverlay] canvas.toDataURL failed', err);
        scheduleRetry();
        return;
      }
      if (!dataUrl || dataUrl === 'data:image/png;base64,' || dataUrl === 'data:,') {
        console.warn('[ExportOverlay] Empty QR data URL, retrying', { attempt });
        scheduleRetry();
        return;
      }
      if (typeof window?.EA !== 'function') {
        hasSavedQrRef.current = true;
        return;
      }
      console.log('[ExportOverlay] Sending SAVE_QR_IMAGE', { exportBaseName, attempt });
      window
        .EA('SAVE_QR_IMAGE', { dataUrl, exportBaseName })
        .then((response) => {
          if (cancelled) {
            return;
          }
          if (!response?.success) {
            console.error('SAVE_QR_IMAGE failed', response?.error);
            hasSavedQrRef.current = false;
            scheduleRetry();
            return;
          }
          console.log('[ExportOverlay] SAVE_QR_IMAGE success', response?.path);
          hasSavedQrRef.current = true;
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          console.error('SAVE_QR_IMAGE error', error);
          hasSavedQrRef.current = false;
          scheduleRetry();
        });
    }

    trySave();

    return () => {
      cancelled = true;
      pendingTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [canvasId, driveLink, exportBaseName, isExporting]);

  return (
    <div className={style.background}>
      {onCancel && (
        <div onClick={onCancel} className={style.quit}>
          <IconQuit />
        </div>
      )}
      {publicCode && (
        <div className={style.code}>
          {t("You'll be able to get your film using this code:")}
          <div className={style.codeValue}>
            {publicCode
              .split('')
              .reduce((acc, e, i) => acc + (i && i % 2 === 0 ? ' ' : '') + e, '')
              .trim()}
          </div>
        </div>
      )}
      {isExporting && (
        <div className={`${style.progressContainer} ${!publicCode && style.containerCenter}`}>
          <span className={style.loader} />
          <div className={style.progress}>{Math.min(100, Math.max(0, Math.round(progress * 100)))}%</div>
        </div>
      )}
      {!isExporting && (
        <div className={`${style.doneContainer} ${!publicCode && style.containerCenter}`}>
          <div className={style.done}>
            <IconDone />
          </div>
          {driveLink && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#fff', maxWidth: '320px' }}>
              <div style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: '0.5rem' }}>{t('Download from Google Drive')}</div>
              <a
                href={driveLink}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#fff', textDecoration: 'underline', wordBreak: 'break-word', display: 'inline-block', marginBottom: '0.75rem' }}
              >
                {t('Open link')}
              </a>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px' }}>
                  <QRCodeCanvas id={canvasId} value={driveLink} size={160} includeMargin fgColor="#000000" bgColor="#ffffff" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {isExporting && <div className={style.info}>{t('Export will take a while, please be patient')}</div>}
      {!isExporting && (
        <div className={`${style.doneContainer} ${!publicCode && style.containerCenter}`}>
          {publicCode && <ActionCard onClick={handleCreateProject} title={t('Create new project')} sizeAuto />}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 24px',
                fontSize: '1em',
                borderRadius: '6px',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('Back to Welcome')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default withTranslation()(ExportOverlay);
