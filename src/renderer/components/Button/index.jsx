import Tooltip from '@components/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { uniqueId } from 'lodash';
import { useMemo } from 'react';

import * as style from './style.module.css';

const Button = ({
  icon,
  onClick,
  title = '',
  label = '',
  disabled = false,
  selected = false,
  color = 'normal',
  selectedColor = 'normal',
  tooltipPosition = 'TOP',
  ...rest
}) => {
  const uid = useMemo(() => uniqueId(), []);
  const tooltipId = `button-${uid}`;
  const { className, ...containerProps } = rest;
  const handleClick = () => {
    if (disabled) {
      return;
    }
    onClick && onClick();
  };
  return (
    <div {...containerProps} className={`${style.mainContainer} ${className || ''}`}>
      <div
        {...(title ? { 'data-tooltip-content': title, id: `button-${uid}` } : {})}
        id={tooltipId}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        className={`${style.button} ${color === 'primary' && style.colorPrimary} ${selected && selectedColor === 'normal' ? style.selected : ''} ${selected && selectedColor === 'warning' ? style.selectedWarning : ''}  ${disabled ? style.disabled : ''}`}
        aria-label={title || label}
      >
        <FontAwesomeIcon icon={icon} />
      </div>
      {label && <span className={style.label}>{label}</span>}
      {title && <Tooltip place={tooltipPosition.toLowerCase()} anchorId={tooltipId} />}
    </div>
  );
};

export default Button;
