import Button from '@components/Button';
import HeaderBar from '@components/HeaderBar';
import Logo from '@components/Logo';
import PageContent from '@components/PageContent';
import PageLayout from '@components/PageLayout';
import useProjects from '@hooks/useProjects';
import Camera from '@icons/faCamera';
import { useState } from 'react';
import { withTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

const WelcomeView = ({ t }) => {
  const [userName, setUserName] = useState('');
  const { actions: projectsActions } = useProjects();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleBegin = async () => {
    if (!userName.trim()) {
      setError('Please enter your name.');
      return;
    }
    const project = await projectsActions.create(userName.trim());
    navigate(`/animator/${project.id}/0`);
    window.track && window.track('project_created', { projectId: project.id });
  };

  return (
    <PageLayout>
      <HeaderBar withBorder>
        <Logo />
      </HeaderBar>
      <PageContent>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
          <h2 style={{ color: 'var(--color-white)', fontWeight: 600, fontSize: '2rem', marginBottom: '24px' }}>{t ? t('Enter your name to begin') : 'Enter your name to begin'}</h2>
          <input
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              setError('');
            }}
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
