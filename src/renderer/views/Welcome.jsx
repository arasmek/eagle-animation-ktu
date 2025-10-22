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
  const [videoSrc, setVideoSrc] = useState(null);

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  // Load welcome video from resources/videos/ad.mp4 (dev + packaged)
  useEffect(() => {
    (async () => {
      try {
        const url = await window.EA('GET_RESOURCE_FILE_URL', { rel: 'videos/ad.mp4' });
        setVideoSrc(url || null);
      } catch (e) {
        setVideoSrc(null);
      }
    })();
  }, []);

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

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBegin();
    }
  };

  return (
    <PageLayout>
      <HeaderBar withBorder>
        <Logo />
      </HeaderBar>
      <PageContent>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '16px' }}>
          {videoSrc && (
            <div style={{ width: '640px', maxWidth: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.35)' }}>
              <video autoPlay loop muted playsInline controls={false} style={{ width: '100%', display: 'block' }}>
                <source src={videoSrc} type="video/mp4" />
              </video>
            </div>
          )}
          <h2 style={{ color: 'var(--color-white)', fontWeight: 600, fontSize: '2rem', marginBottom: '24px' }}>{t ? t('Enter your name to begin') : 'Enter your name to begin'}</h2>
          <input
            ref={nameInputRef}
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown} // <- listen for Enter
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
          {error && <div style={{ color: 'var(--color-alert)', marginBottom: '8px' }}>{error}</div>}
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
  );
};

export default withTranslation()(WelcomeView);
