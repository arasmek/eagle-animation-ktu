import Button from '@components/Button';
import CustomSlider from '@components/CustomSlider';
import PreviewIndicator from '@components/PreviewIndicator';
import Tooltip from '@components/Tooltip';
import faArrowsRepeat from '@icons/faArrowsRepeat';
import faCamera from '@icons/faCamera';
import faDiamondHalfStroke from '@icons/faDiamondHalfStroke';
import faForwardFast from '@icons/faForwardFast';
import faFrame from '@icons/faFrame';
import faImageCircleMinus from '@icons/faImageCircleMinus';
import faImageCirclePlus from '@icons/faImageCirclePlus';
import faImageEye from '@icons/faImageEye';
import faImageEyeSlash from '@icons/faImageEyeSlash';
import faImageSlash from '@icons/faImageSlash';
import faPlay from '@icons/faPlay';
import faStop from '@icons/faStop';
import { useCallback, useEffect, useRef, useState } from 'react';
import { withTranslation } from 'react-i18next';

import * as style from './style.module.css';

const HOLD_DURATION_MS = 1000;

const ControlBar = ({
  gridStatus = false,
  differenceStatus = false,
  onionValue = 1,
  isPlaying = false,
  isTakingPicture = false,
  isCameraReady = false,
  shortPlayStatus = false,
  loopStatus = false,
  fps = 12,
  framePosition = false,
  frameQuantity = 0,
  canDeduplicate = false,
  isCurrentFrameHidden = false,
  gridModes = [],
  onAction = null,
  totalAnimationFrames = 0,
  t,
}) => {
  const handleAction = useCallback(
    (action, args) => () => {
      if (onAction) {
        onAction(action, args);
      }
    },
    [onAction],
  );

  const [isCameraHoldActive, setIsCameraHoldActive] = useState(false);
  const holdTimerRef = useRef(null);
  const holdTriggeredRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!holdTriggeredRef.current) {
      setIsCameraHoldActive(false);
    }
    holdTriggeredRef.current = false;
  }, []);

  const startHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    holdTriggeredRef.current = false;
    setIsCameraHoldActive(true);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      holdTriggeredRef.current = true;
      setIsCameraHoldActive(false);
      handleAction('CAMERA_SETTINGS')();
    }, HOLD_DURATION_MS);
  }, [handleAction]);

  useEffect(() => cancelHold, [cancelHold]);

  const handleCameraHoldPointerDown = (event) => {
    event.preventDefault();
    startHold();
  };

  const handleCameraHoldPointerCancel = (event) => {
    event.preventDefault();
    cancelHold();
  };

  const handleCameraHoldKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    startHold();
  };

  const handleCameraHoldKeyUp = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    cancelHold();
  };

  return (
    <div className={style.container}>
      <div
        className={`${style.hiddenHoldArea} ${isCameraHoldActive ? style.hiddenHoldAreaActive : ''}`}
        role="button"
        tabIndex={0}
        aria-label={t('Hold to open camera settings')}
        onPointerDown={handleCameraHoldPointerDown}
        onPointerUp={handleCameraHoldPointerCancel}
        onPointerLeave={handleCameraHoldPointerCancel}
        onPointerCancel={handleCameraHoldPointerCancel}
        onPointerOut={handleCameraHoldPointerCancel}
        onKeyDown={handleCameraHoldKeyDown}
        onKeyUp={handleCameraHoldKeyUp}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className={style.hiddenHoldPulse} />
      </div>
      <div className={`${style.group} ${style.toolsGroup}`}>
        <div className={style.sliderGroup}>
          <span className={style.sliderLabel}>{t('Onion blending')}</span>
          <div className={`${style.slider} ${differenceStatus ? style.sliderDisabled : ''}`} id="onion" data-tooltip-content={t('Onion blending')}>
            <CustomSlider step={0.01} min={0} max={1} value={onionValue} onChange={differenceStatus ? () => {} : (value) => handleAction('ONION_CHANGE', value)()} />
          </div>
        </div>
        {!isPlaying && framePosition !== false && (
          <Button
            title={isCurrentFrameHidden ? t('Unhide frame') : t('Hide frame')}
            label={isCurrentFrameHidden ? t('Unhide frame') : t('Hide frame')}
            onClick={handleAction('HIDE_FRAME')}
            icon={isCurrentFrameHidden ? faImageEye : faImageEyeSlash}
          />
        )}
        {!isPlaying && framePosition !== false && canDeduplicate && (
          <Button title={t('Deduplicate frame')} label={t('Deduplicate frame')} onClick={handleAction('DEDUPLICATE')} icon={faImageCircleMinus} />
        )}
        {!isPlaying && framePosition !== false && (
          <Button title={t('Duplicate frame')} label={t('Duplicate frame')} onClick={handleAction('DUPLICATE')} icon={faImageCirclePlus} />
        )}
        {!isPlaying && framePosition !== false && (
          <Button title={t('Remove frame')} label={t('Remove frame')} onClick={handleAction('DELETE_FRAME')} icon={faImageSlash} />
        )}
        <Button title={t('Difference')} label={t('Difference')} selected={differenceStatus} onClick={handleAction('DIFFERENCE')} icon={faDiamondHalfStroke} />
        {(gridModes.includes('GRID') || gridModes.includes('CENTER') || gridModes.includes('MARGINS')) && (
          <Button title={gridStatus ? t('Disable grid') : t('Enable grid')} label={gridStatus ? t('Disable grid') : t('Enable grid')} selected={gridStatus} onClick={handleAction('GRID')} icon={faFrame} />
        )}
      </div>
      <div className={`${style.group} ${style.captureGroup}`}>
        <Button
          disabled={isTakingPicture || !isCameraReady}
          onClick={handleAction('TAKE_PICTURE')}
          color="primary"
          icon={faCamera}
          title={t('Take a picture')}
          label={t('Take a picture')}
        />
      </div>
      <div className={`${style.group} ${style.playbackGroup}`}>
        <div className={style.previewWrapper}>
          <PreviewIndicator framePosition={framePosition} frameQuantity={frameQuantity} animationFrameQuantity={totalAnimationFrames} fps={fps} />
        </div>
        <Button
          selectedColor="warning"
          title={!isPlaying ? t('Play') : t('Stop')}
          label={!isPlaying ? t('Play') : t('Stop')}
          selected={isPlaying}
          onClick={handleAction('PLAY')}
          icon={isPlaying ? faStop : faPlay}
        />
        <Button title={t('Loop')} label={t('Loop')} onClick={handleAction('LOOP')} selected={loopStatus} icon={faArrowsRepeat} />
        <Button title={t('Short play')} label={t('Short play')} onClick={handleAction('SHORT_PLAY')} selected={shortPlayStatus} icon={faForwardFast} />
        <Tooltip anchorId="onion" />
        <Tooltip anchorId={`preview-indicator`} />
      </div>
    </div>
  );
};

export default withTranslation()(ControlBar);
