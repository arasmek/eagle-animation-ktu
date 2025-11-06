import Button from '@components/Button';
import faArrowLeft from '@icons/faArrowLeft';
import faDownLeftAndUpRightToCenter from '@icons/faDownLeftAndUpRightToCenter';
import faFileExport from '@icons/faFileExport';
import faFilmGear from '@icons/faFilmGear';
import faGear from '@icons/faGear';
import faKeyboard from '@icons/faKeyboard';
import faUpRightAndDownLeftFromCenter from '@icons/faUpRightAndDownLeftFromCenter';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { withTranslation } from 'react-i18next';

import * as style from './style.module.css';

const LONG_PRESS_MS = 1000;

const ActionButton = withTranslation()(({ type, tooltipPosition = 'LEFT', onClick = () => {}, t }) => {
  const titles = {
    BACK: t('Back'),
    SETTINGS: t('Settings'),
    SHORTCUTS: t('Shortcuts'),
    PROJECT_SETTINGS: t('Edit project'),
    EXPORT: t('Export'),
    ENTER_FULLSCREEN: t('Fullscreen'),
    EXIT_FULLSCREEN: t('Exit fullscreen'),
  };

  const icons = {
    BACK: faArrowLeft,
    SETTINGS: faGear,
    SHORTCUTS: faKeyboard,
    PROJECT_SETTINGS: faFilmGear,
    EXPORT: faFileExport,
    ENTER_FULLSCREEN: faUpRightAndDownLeftFromCenter,
    EXIT_FULLSCREEN: faDownLeftAndUpRightToCenter,
  };

  return <Button title={titles?.[type] || null} onClick={onClick} icon={icons?.[type] || null} tooltipPosition={tooltipPosition} />;
});

const HeaderBar = ({ onAction = null, leftActions = [], rightActions = [], children = null, leftChildren = null, rightChildren = null, title = '', withBorder = false }) => {
  const [customExportHoldActive, setCustomExportHoldActive] = useState(false);
  const customExportTimerRef = useRef(null);
  const customExportTriggeredRef = useRef(false);
  const [settingsHoldActive, setSettingsHoldActive] = useState(false);
  const settingsHoldTimerRef = useRef(null);
  const settingsHoldTriggeredRef = useRef(false);
  const [projectSettingsHoldActive, setProjectSettingsHoldActive] = useState(false);
  const projectSettingsHoldTimerRef = useRef(null);
  const projectSettingsHoldTriggeredRef = useRef(false);

  const triggerAction = useCallback(
    (action) => {
      if (onAction) {
        onAction(action);
      }
    },
    [onAction],
  );

  const cancelCustomExportHold = useCallback(() => {
    if (customExportTimerRef.current) {
      clearTimeout(customExportTimerRef.current);
      customExportTimerRef.current = null;
    }
    if (!customExportTriggeredRef.current) {
      setCustomExportHoldActive(false);
    }
    customExportTriggeredRef.current = false;
  }, []);

  const startCustomExportHold = useCallback(() => {
    if (customExportTimerRef.current) {
      clearTimeout(customExportTimerRef.current);
    }
    customExportTriggeredRef.current = false;
    setCustomExportHoldActive(true);
    customExportTimerRef.current = window.setTimeout(() => {
      customExportTimerRef.current = null;
      customExportTriggeredRef.current = true;
      setCustomExportHoldActive(false);
      triggerAction('CUSTOM_EXPORT');
    }, LONG_PRESS_MS);
  }, [triggerAction]);

  useEffect(() => cancelCustomExportHold, [cancelCustomExportHold]);

  const handleCustomExportPointerDown = (event) => {
    event.preventDefault();
    startCustomExportHold();
  };

  const handleCustomExportPointerCancel = (event) => {
    event.preventDefault();
    cancelCustomExportHold();
  };

  const handleCustomExportKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    startCustomExportHold();
  };

  const handleCustomExportKeyUp = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    cancelCustomExportHold();
  };

  const filteredRightActions = rightActions.filter((action) => action !== 'CUSTOM_EXPORT');

  const cancelSettingsHold = useCallback(() => {
    if (settingsHoldTimerRef.current) {
      clearTimeout(settingsHoldTimerRef.current);
      settingsHoldTimerRef.current = null;
    }
    if (!settingsHoldTriggeredRef.current) {
      setSettingsHoldActive(false);
    }
    settingsHoldTriggeredRef.current = false;
  }, []);

  const startSettingsHold = useCallback(() => {
    if (settingsHoldTimerRef.current) {
      clearTimeout(settingsHoldTimerRef.current);
    }
    settingsHoldTriggeredRef.current = false;
    setSettingsHoldActive(true);
    settingsHoldTimerRef.current = window.setTimeout(() => {
      settingsHoldTimerRef.current = null;
      settingsHoldTriggeredRef.current = true;
      setSettingsHoldActive(false);
      triggerAction('SETTINGS');
    }, LONG_PRESS_MS);
  }, [triggerAction]);

  useEffect(() => cancelSettingsHold, [cancelSettingsHold]);

  const handleSettingsPointerDown = (event) => {
    event.preventDefault();
    startSettingsHold();
  };

  const handleSettingsPointerCancel = (event) => {
    event.preventDefault();
    cancelSettingsHold();
  };

  const handleSettingsKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    startSettingsHold();
  };

  const handleSettingsKeyUp = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    cancelSettingsHold();
  };

  const cancelProjectSettingsHold = useCallback(() => {
    if (projectSettingsHoldTimerRef.current) {
      clearTimeout(projectSettingsHoldTimerRef.current);
      projectSettingsHoldTimerRef.current = null;
    }
    if (!projectSettingsHoldTriggeredRef.current) {
      setProjectSettingsHoldActive(false);
    }
    projectSettingsHoldTriggeredRef.current = false;
  }, []);

  const startProjectSettingsHold = useCallback(() => {
    if (projectSettingsHoldTimerRef.current) {
      clearTimeout(projectSettingsHoldTimerRef.current);
    }
    projectSettingsHoldTriggeredRef.current = false;
    setProjectSettingsHoldActive(true);
    projectSettingsHoldTimerRef.current = window.setTimeout(() => {
      projectSettingsHoldTimerRef.current = null;
      projectSettingsHoldTriggeredRef.current = true;
      setProjectSettingsHoldActive(false);
      triggerAction('PROJECT_SETTINGS');
    }, LONG_PRESS_MS);
  }, [triggerAction]);

  useEffect(() => cancelProjectSettingsHold, [cancelProjectSettingsHold]);

  const handleProjectSettingsPointerDown = (event) => {
    event.preventDefault();
    startProjectSettingsHold();
  };

  const handleProjectSettingsPointerCancel = (event) => {
    event.preventDefault();
    cancelProjectSettingsHold();
  };

  const handleProjectSettingsKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    startProjectSettingsHold();
  };

  const handleProjectSettingsKeyUp = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    cancelProjectSettingsHold();
  };

  return (
    <div className={`${style.headerBar} ${withBorder && style.withBorder}`}>
      <div className={`${style.side} ${style.left}`}>
        {leftActions.map((type) => (
          <ActionButton type={type} key={type} onClick={() => triggerAction(type)} tooltipPosition="NONE" />
        ))}
        {leftChildren}
      </div>
      {(children || title) && (
        <div className={style.center}>
          {children && children}
          {!children && title && <div className={style.title}>{title}</div>}
        </div>
      )}
      <div className={`${style.side} ${style.right}`}>
        {rightChildren}
        {filteredRightActions.map((type) => {
          if (type === 'EXPORT') {
            return (
              <Fragment key="EXPORT">
                <div
                  className={`${style.hiddenHoldArea} ${customExportHoldActive ? style.hiddenHoldAreaActive : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Hold to open custom export"
                  onPointerDown={handleCustomExportPointerDown}
                  onPointerUp={handleCustomExportPointerCancel}
                  onPointerLeave={handleCustomExportPointerCancel}
                  onPointerCancel={handleCustomExportPointerCancel}
                  onPointerOut={handleCustomExportPointerCancel}
                  onKeyDown={handleCustomExportKeyDown}
                  onKeyUp={handleCustomExportKeyUp}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span className={style.hiddenHoldPulse} />
                </div>
                <ActionButton type={type} onClick={() => triggerAction(type)} tooltipPosition="NONE" />
              </Fragment>
            );
          }
          if (type === 'SETTINGS') {
            return (
              <div
                key="SETTINGS"
                className={`${style.holdableButton} ${settingsHoldActive ? style.holdableButtonActive : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Hold to open settings"
                onPointerDown={handleSettingsPointerDown}
                onPointerUp={handleSettingsPointerCancel}
                onPointerLeave={handleSettingsPointerCancel}
                onPointerCancel={handleSettingsPointerCancel}
                onPointerOut={handleSettingsPointerCancel}
                onKeyDown={handleSettingsKeyDown}
                onKeyUp={handleSettingsKeyUp}
                onContextMenu={(event) => event.preventDefault()}
              >
                <ActionButton type={type} onClick={() => {}} tooltipPosition="NONE" />
              </div>
            );
          }
          if (type === 'PROJECT_SETTINGS') {
            return (
              <div
                key="PROJECT_SETTINGS"
                className={`${style.holdableButton} ${projectSettingsHoldActive ? style.holdableButtonActive : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Hold to open project settings"
                onPointerDown={handleProjectSettingsPointerDown}
                onPointerUp={handleProjectSettingsPointerCancel}
                onPointerLeave={handleProjectSettingsPointerCancel}
                onPointerCancel={handleProjectSettingsPointerCancel}
                onPointerOut={handleProjectSettingsPointerCancel}
                onKeyDown={handleProjectSettingsKeyDown}
                onKeyUp={handleProjectSettingsKeyUp}
                onContextMenu={(event) => event.preventDefault()}
              >
                <ActionButton type={type} onClick={() => {}} tooltipPosition="NONE" />
              </div>
            );
          }
          return <ActionButton type={type} key={type} onClick={() => triggerAction(type)} tooltipPosition="NONE" />;
        })}
      </div>
    </div>
  );
};

export default HeaderBar;
