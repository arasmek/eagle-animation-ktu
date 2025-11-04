import Button from '@components/Button';
import HeaderBar from '@components/HeaderBar';
import Logo from '@components/Logo';
import PageContent from '@components/PageContent';
import PageLayout from '@components/PageLayout';
import useProjects from '@hooks/useProjects';
import useSettings from '@hooks/useSettings';
import Camera from '@icons/faCamera';
import { useEffect, useRef, useState } from 'react';
import { useTranslation, withTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import * as style from './Welcome.module.css';

const WelcomeView = ({ t }) => {
  const [userName, setUserName] = useState('');
  const { actions: projectsActions } = useProjects();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const nameInputRef = useRef(null);
  const { actions } = useSettings();
  const { i18n } = useTranslation();

  const [adVideoSrc, setAdVideoSrc] = useState(null);
  const [tutorialVideoSrc, setTutorialVideoSrc] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const overlayVideoRef = useRef(null);
  const adHoldTimerRef = useRef(null);
  const adHoldTriggeredRef = useRef(false);
  const [adHoldActive, setAdHoldActive] = useState(false);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ad = await window.EA('GET_RESOURCE_FILE_URL', { rel: 'videos/ad.mp4' });
        setAdVideoSrc(ad || null);
      } catch (e) {
        console.error('Video load failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const tutorialRel = i18n.language === 'lt' ? 'videos/TutorialLT.mp4' : 'videos/TutorialEN.mp4';
        const tutorial = await window.EA('GET_RESOURCE_FILE_URL', { rel: tutorialRel });
        setTutorialVideoSrc(tutorial || null);
      } catch (e) {
        console.error('Tutorial video load failed', e);
        setTutorialVideoSrc(null);
      }
    })();
  }, [i18n.language]);

  const openVideo = (src) => {
    if (!src) return;
    setCurrentVideo(src);
    setOverlayVisible(true);
    setTimeout(() => {
      if (overlayVideoRef.current) {
        try {
          overlayVideoRef.current.src = src;
          overlayVideoRef.current.currentTime = 0;
          overlayVideoRef.current.muted = false;
          overlayVideoRef.current.play().catch(() => {});
        } catch {}
      }
    }, 100);
  };

  const closeOverlay = () => {
    if (overlayVideoRef.current) {
      try {
        overlayVideoRef.current.pause();
        overlayVideoRef.current.removeAttribute('src');
        overlayVideoRef.current.load();
      } catch {}
    }
    setOverlayVisible(false);
    setCurrentVideo(null);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'lt' : 'en';
    actions.setSettings({ LANGUAGE: newLang });
  };

  const handleBegin = async () => {
    if (!userName.trim()) {
      setError(t ? t('Please enter your name.') : 'Please enter your name.');
      return;
    }
    const project = await projectsActions.create(userName.trim());
    navigate(`/animator/${project.id}/0`);
    window.track && window.track('project_created', { projectId: project.id });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleBegin();
  };

  const cancelAdHold = () => {
    if (adHoldTimerRef.current) {
      clearTimeout(adHoldTimerRef.current);
      adHoldTimerRef.current = null;
    }
    if (!adHoldTriggeredRef.current) {
      setAdHoldActive(false);
    }
    adHoldTriggeredRef.current = false;
  };

  const startAdHold = () => {
    if (adHoldTimerRef.current) {
      clearTimeout(adHoldTimerRef.current);
    }
    adHoldTriggeredRef.current = false;
    setAdHoldActive(true);
    adHoldTimerRef.current = window.setTimeout(() => {
      adHoldTimerRef.current = null;
      adHoldTriggeredRef.current = true;
      setAdHoldActive(false);
      openVideo(adVideoSrc);
    }, 1000);
  };

  const handleAdPointerDown = (event) => {
    if (event) {
      event.preventDefault();
    }
    startAdHold();
  };

  const handleAdPointerUp = (event) => {
    if (event) {
      event.preventDefault();
    }
    cancelAdHold();
  };

  const handleAdKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    startAdHold();
  };

  const handleAdKeyUp = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    cancelAdHold();
  };

  return (
    <>
      <PageLayout>
        <div className={style.layout}>
          <div className={style.languageCorner}>
            {tutorialVideoSrc && (
              <button className={style.helpButton} onClick={() => openVideo(tutorialVideoSrc)} title={t ? t('Need help? tooltip') : 'Play tutorial'} aria-label={t ? t('Need help?') : 'Need help?'}>
                ?
              </button>
            )}
            <button onClick={toggleLanguage} className={style.languageButton}>
              {i18n.language === 'en' ? 'LIETUVIŠKAI' : 'ENGLISH'}
            </button>
          </div>
          <PageContent>
            <div className={style.contentWrapper}>
              <h2 className={style.heroTitle}>{t ? t('Stop motion workshop') : 'Stop motion workshop'}</h2>
              <input
                ref={nameInputRef}
                type="text"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={t ? t('Your name') : 'Your name'}
                className={style.nameInput}
              />
              {error && <div className={style.errorMessage}>{error}</div>}

              <Button onClick={handleBegin} className={style.primaryButton} icon={Camera} />

              {adVideoSrc && (
                <div className={style.hiddenAdZone}>
                  <button
                    className={`${style.videoButtonHidden} ${adHoldActive ? style.adHoldActive : ''}`}
                    onPointerDown={handleAdPointerDown}
                    onPointerUp={handleAdPointerUp}
                    onPointerLeave={handleAdPointerUp}
                    onPointerCancel={handleAdPointerUp}
                    onKeyDown={handleAdKeyDown}
                    onKeyUp={handleAdKeyUp}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {t ? t('Hold to watch intro video') : 'Hold to watch intro video'}
                  </button>
                </div>
              )}
            </div>
          </PageContent>
          <div className={style.footerLink}>
            <Link to="/home">{t ? t('Old home') : 'Old home'}</Link>
          </div>
        </div>
      </PageLayout>

      <div onClick={closeOverlay} className={style.overlay} style={{ display: overlayVisible ? 'flex' : 'none' }}>
        <video ref={overlayVideoRef} playsInline loop controls={false} className={style.overlayVideo} />
      </div>
    </>
  );
};

export default withTranslation()(WelcomeView);
