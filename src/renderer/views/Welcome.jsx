import Button from '@components/Button';
import HeaderBar from '@components/HeaderBar';
import Logo from '@components/Logo';
import PageContent from '@components/PageContent';
import PageLayout from '@components/PageLayout';
import useProjects from '@hooks/useProjects';
import useSettings from '@hooks/useSettings';
import Camera from '@icons/faCamera';
import { useEffect, useRef, useState } from 'react';
import { withTranslation } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    if (nameInputRef.current) nameInputRef.current.focus();
  }, []);

  // Load both videos from /resources/videos/
  useEffect(() => {
    (async () => {
      try {
        const ad = await window.EA('GET_RESOURCE_FILE_URL', { rel: 'videos/ad.mp4' });
        const tutorial = await window.EA('GET_RESOURCE_FILE_URL', { rel: 'videos/tutorial.mp4' });
        setAdVideoSrc(ad || null);
        setTutorialVideoSrc(tutorial || null);
      } catch (e) {
        console.error('Video load failed', e);
      }
    })();
  }, []);

  const openVideo = (src) => {
    if (!src) return;
    setCurrentVideo(src);
    setOverlayVisible(true);
    setTimeout(() => {
      try {
        if (overlayVideoRef.current) {
          overlayVideoRef.current.src = src;
          overlayVideoRef.current.currentTime = 0;
          overlayVideoRef.current.muted = false;
          overlayVideoRef.current.play().catch(() => {});
        }
      } catch {}
    }, 100);
  };

  const closeOverlay = () => {
    try {
      if (overlayVideoRef.current) {
        overlayVideoRef.current.pause();
        overlayVideoRef.current.removeAttribute('src');
        overlayVideoRef.current.load();
      }
    } catch {}
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

  return (
    <>
      <PageLayout>
        <HeaderBar withBorder>
          <Logo />
        </HeaderBar>

        <PageContent>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '70vh',
              gap: '16px',
            }}
          >
            {/* Buttons to open videos */}
            {adVideoSrc && (
              <button
                onClick={() => openVideo(adVideoSrc)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-theme-light)',
                  background: 'var(--color-theme-extra-dark)',
                  color: 'var(--color-white)',
                  cursor: 'pointer',
                }}
              >
                {t ? t('Watch Intro Video') : 'Watch Intro Video'}
              </button>
            )}
            {tutorialVideoSrc && (
              <button
                onClick={() => openVideo(tutorialVideoSrc)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-theme-light)',
                  background: 'var(--color-theme-extra-dark)',
                  color: 'var(--color-white)',
                  cursor: 'pointer',
                }}
              >
                {t ? t('Watch Tutorial') : 'Watch Tutorial'}
              </button>
            )}

            <h2
              style={{
                color: 'var(--color-white)',
                fontWeight: 600,
                fontSize: '2rem',
                marginBottom: '24px',
              }}
            >
              {t ? t('Enter your name to begin') : 'Enter your name to begin'}
            </h2>

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
              style={{
                padding: '8px',
                fontSize: '1rem',
                marginBottom: '12px',
                width: '240px',
                textAlign: 'center',
                borderRadius: '8px',
                border: '1px solid var(--color-theme-light)',
                background: 'var(--color-theme-extra-dark)',
                color: 'var(--color-white)',
              }}
            />

            {error && (
              <div style={{ color: 'var(--color-alert)', marginBottom: '8px' }}>{error}</div>
            )}

            <Button onClick={handleBegin} style={{ marginTop: '8px' }} icon={Camera} />

            <button
              onClick={toggleLanguage}
              style={{
                marginTop: '24px',
                padding: '6px 12px',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: '1px solid var(--color-theme-light)',
                background: 'var(--color-theme-extra-dark)',
                color: 'var(--color-white)',
                cursor: 'pointer',
              }}
            >
              {i18n.language === 'en' ? 'LIETUVIŲ' : 'ENGLISH'}
            </button>

            <div style={{ marginTop: '32px', fontSize: '0.9rem', color: '#888' }}>
              <Link to="/home" style={{ textDecoration: 'underline', color: '#888' }}>
                {t ? t('Old home') : 'Old home'}
              </Link>
            </div>
          </div>
        </PageContent>
      </PageLayout>

      {/* Fullscreen overlay for video playback */}
      <div
        onClick={closeOverlay}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
          display: overlayVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          cursor: 'pointer',
        }}
      >
        <video
          ref={overlayVideoRef}
          playsInline
          loop
          controls={false}
          style={{ width: '100%', height: '100%', outline: 'none' }}
        />
      </div>
    </>
  );
};

export default withTranslation()(WelcomeView);
