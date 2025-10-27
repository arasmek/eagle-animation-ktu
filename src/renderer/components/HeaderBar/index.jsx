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
          return <ActionButton type={type} key={type} onClick={() => triggerAction(type)} tooltipPosition="NONE" />;
        })}
      </div>
    </div>
  );
};

export default HeaderBar;
